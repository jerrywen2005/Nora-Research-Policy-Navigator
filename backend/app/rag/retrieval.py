"""Find the chunks that answer a question. Design: docs/rag.md, "Retrieval design".

    question ─┬─ vector search (cosine on embeddings) → top 20 ┐
              └─ keyword search (BM25)               → top 20 ┴─ RRF merge → top 20
                                                       → cross-encoder rerank → top 5

Only chunks of active, authoritative documents are searched, and only the chosen topic's when
the user asked from a topic page.
"""

import re
import threading
from dataclasses import dataclass

from rank_bm25 import BM25Okapi
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session, joinedload

from app.models import Document, DocumentChunk, DocumentStatus, Topic
from app.rag.embeddings import EmbeddingProvider
from app.rag.reranking import Reranker

CANDIDATES = 20  # from each search, and how many the reranker reads
TOP_K = 5  # chunks shown to the LLM
RRF_K = 60  # the standard constant in 1 / (k + rank)
# The confidence gate: if the best reranker score is below this, the sources don't cover the
# question, so Nora refers instead of answering. Set from the evaluation (2026-11-10, 197
# policies): off-topic questions scored at most 0.030, the lowest correctly retrieved real one
# 0.051. Re-tune it whenever the reranker, the chunking or the document set changes.
GATE_THRESHOLD = 0.04

MODES = ("dense", "keyword", "hybrid", "rerank")


@dataclass(frozen=True)
class Hit:
    chunk_id: int
    score: float  # higher is better, but each search uses its own scale


def tokenize(text: str) -> list[str]:
    """Lowercase words and numbers, keeping codes like "200.03" and "0501" whole."""
    return re.findall(r"[a-z0-9]+(?:\.[0-9]+)*", text.lower())


def searchable(query: Select, topic: str | None) -> Select:
    """Limit a chunk query to active, authoritative documents (and one topic, if given)."""
    query = query.join(Document, DocumentChunk.document_id == Document.id).where(
        Document.status == DocumentStatus.ACTIVE, Document.is_authoritative
    )
    if topic:
        query = query.where(Document.topics.any(Topic.slug == topic))
    return query


def dense_search(
    session: Session, question_vector: list[float], k: int = CANDIDATES, topic: str | None = None
) -> list[Hit]:
    """Chunks whose embeddings are closest in meaning. Score: cosine similarity, -1 to 1."""
    distance = DocumentChunk.embedding.cosine_distance(question_vector)
    rows = session.execute(
        searchable(select(DocumentChunk.id, distance.label("distance")), topic)
        .order_by(distance)
        .limit(k)
    ).all()
    return [Hit(row.id, 1 - row.distance) for row in rows]


class KeywordIndex:
    """BM25 over every chunk, held in memory. Rare words (ITAR, FCOI, 200.03) count the most.

    Postgres has no BM25; its ts_rank found the right policy for far fewer questions on our
    evaluation (docs/rag.md, build log). At a few thousand chunks the index builds in about a
    second and searches in milliseconds.
    """

    def __init__(self, session: Session) -> None:
        self.fingerprint = chunk_fingerprint(session)
        rows = session.execute(
            select(DocumentChunk.id, DocumentChunk.context, DocumentChunk.text).order_by(
                DocumentChunk.id
            )
        ).all()
        self.chunk_ids = [row.id for row in rows]
        corpus = [tokenize(f"{row.context}\n{row.text}") for row in rows]
        self.bm25 = BM25Okapi(corpus) if corpus else None

    def search(self, question: str, allowed: set[int], k: int = CANDIDATES) -> list[Hit]:
        """The top k allowed chunks that share a word with the question. Score: BM25, 0 and up."""
        if self.bm25 is None:
            return []
        scores = self.bm25.get_scores(tokenize(question))
        ranked = sorted(
            (
                Hit(chunk_id, float(score))
                for chunk_id, score in zip(self.chunk_ids, scores, strict=True)
                if score > 0 and chunk_id in allowed
            ),
            key=lambda hit: -hit.score,
        )
        return ranked[:k]


def chunk_fingerprint(session: Session) -> tuple[int, int | None]:
    """Changes whenever ingestion adds or replaces chunks: new chunks always get new ids."""
    count, last_id = session.execute(
        select(func.count(DocumentChunk.id), func.max(DocumentChunk.id))
    ).one()
    return count, last_id


_index: KeywordIndex | None = None
_index_lock = threading.Lock()


def keyword_index(session: Session) -> KeywordIndex:
    """The process's index, rebuilt if the chunks changed since it was built."""
    global _index
    with _index_lock:
        if _index is None or _index.fingerprint != chunk_fingerprint(session):
            _index = KeywordIndex(session)
        return _index


def keyword_search(
    session: Session, question: str, k: int = CANDIDATES, topic: str | None = None
) -> list[Hit]:
    allowed = set(session.scalars(searchable(select(DocumentChunk.id), topic)))
    return keyword_index(session).search(question, allowed, k)


def rrf(*rankings: list[Hit], k: int = RRF_K) -> list[Hit]:
    """Reciprocal Rank Fusion: merge ranked lists by rank, since their scores aren't comparable.

    Each list gives a chunk 1 / (k + rank), so one near the top of both lists wins. Score: at
    most about 0.033 (first in both lists).
    """
    fused: dict[int, float] = {}
    for ranking in rankings:
        for rank, hit in enumerate(ranking, start=1):
            fused[hit.chunk_id] = fused.get(hit.chunk_id, 0.0) + 1 / (k + rank)
    return [Hit(chunk_id, score) for chunk_id, score in sorted(fused.items(), key=lambda i: -i[1])]


def load_chunks(session: Session, hits: list[Hit]) -> list[tuple[DocumentChunk, float]]:
    """The hits' chunks with their documents and offices, in the hits' order."""
    chunks = session.scalars(
        select(DocumentChunk)
        .options(joinedload(DocumentChunk.document).joinedload(Document.office))
        .where(DocumentChunk.id.in_([hit.chunk_id for hit in hits]))
    ).all()
    by_id = {chunk.id: chunk for chunk in chunks}
    return [(by_id[hit.chunk_id], hit.score) for hit in hits]


def rerank(session: Session, question: str, candidates: list[Hit], reranker: Reranker) -> list[Hit]:
    """Rescore candidates by reading the question and each chunk together. Score: 0 to 1."""
    if not candidates:
        return []
    chunks = load_chunks(session, candidates)
    scores = reranker.score(question, [f"{c.context}\n{c.text}" for c, _ in chunks])
    rescored = [Hit(chunk.id, score) for (chunk, _), score in zip(chunks, scores, strict=True)]
    return sorted(rescored, key=lambda hit: -hit.score)


def search(
    session: Session,
    question: str,
    mode: str,
    embedder: EmbeddingProvider,
    reranker: Reranker,
    *,
    topic: str | None = None,
    k: int = TOP_K,
) -> list[Hit]:
    """One retrieval method's top k. "rerank" is the full pipeline; the others are its stages,
    kept so the evaluation can compare them."""
    if mode == "dense":
        return dense_search(session, embedder.embed_query(question), k, topic)
    if mode == "keyword":
        return keyword_search(session, question, k, topic)
    merged = rrf(
        dense_search(session, embedder.embed_query(question), topic=topic),
        keyword_search(session, question, topic=topic),
    )[:CANDIDATES]
    if mode == "hybrid":
        return merged[:k]
    if mode == "rerank":
        return rerank(session, question, merged, reranker)[:k]
    raise ValueError(f"Unknown retrieval mode: {mode!r}")


def retrieve(
    session: Session,
    question: str,
    embedder: EmbeddingProvider,
    reranker: Reranker,
    *,
    topic: str | None = None,
) -> list[tuple[DocumentChunk, float]]:
    """The full pipeline: the top chunks for a question, best first, with reranker scores."""
    return load_chunks(
        session, search(session, question, "rerank", embedder, reranker, topic=topic)
    )

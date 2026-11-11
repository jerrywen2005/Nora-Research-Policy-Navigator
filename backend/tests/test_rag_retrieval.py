import pytest
from sqlalchemy import select

from app.models import DocumentChunk
from app.rag import retrieval
from app.rag.embeddings import FakeEmbeddingProvider
from app.rag.ingest import ingest_document
from app.rag.reranking import FakeReranker
from app.rag.retrieval import (
    Hit,
    dense_search,
    keyword_index,
    keyword_search,
    rerank,
    retrieve,
    rrf,
    search,
    tokenize,
)

embedder = FakeEmbeddingProvider()
reranker = FakeReranker()


def titles(db_session, hits: list[Hit]) -> list[str]:
    chunks = {c.id: c for c in db_session.scalars(select(DocumentChunk)).all()}
    return [chunks[hit.chunk_id].document.title for hit in hits]


def test_tokenize_keeps_policy_codes_whole():
    assert tokenize("What does OSP 200.04 say? SOP 0501!") == [
        "what", "does", "osp", "200.04", "say", "sop", "0501",
    ]  # fmt: skip


def test_dense_search_finds_similar_text_in_searchable_documents_only(db_session, corpus):
    hits = dense_search(db_session, embedder.embed_query("export license for a laptop abroad"))

    assert set(titles(db_session, hits)) == {
        "Export Controls Policy",
        "Mouse Cage Density Standard",
    }
    assert titles(db_session, hits)[0] == "Export Controls Policy"
    assert hits[0].score > hits[-1].score
    animals_only = dense_search(
        db_session, embedder.embed_query("laptop"), topic="animal-care-and-use"
    )
    assert set(titles(db_session, animals_only)) == {"Mouse Cage Density Standard"}


def test_keyword_search_ranks_rare_words_first_and_skips_non_matches(db_session, corpus):
    hits = keyword_search(db_session, "Is ITAR relevant to my lab?")

    # "lab" appears four times in the animal policy, "itar" once in the export policy; BM25
    # weights the rare word, so the export chunk still ranks first.
    assert titles(db_session, hits)[0] == "Export Controls Policy"
    assert all(hit.score > 0 for hit in hits)
    assert keyword_search(db_session, "pizza") == []
    assert keyword_search(db_session, "ITAR", topic="animal-care-and-use") == []


def test_keyword_index_rebuilds_when_chunks_change(db_session, corpus):
    first = keyword_index(db_session)
    assert keyword_index(db_session) is first

    corpus["export"].content_text = "## 1. Scope\nDeemed exports to foreign nationals."
    corpus["export"].content_hash = None
    ingest_document(db_session, corpus["export"], embedder)

    assert keyword_index(db_session) is not first
    assert titles(db_session, keyword_search(db_session, "deemed")) == ["Export Controls Policy"]


def test_keyword_search_with_no_chunks(db_session, content):
    retrieval._index = None
    assert keyword_search(db_session, "anything") == []
    retrieval._index = None


def test_rrf_merges_by_rank():
    merged = rrf([Hit(1, 9.0), Hit(2, 8.0)], [Hit(2, 0.9), Hit(3, 0.8)], k=60)

    assert [hit.chunk_id for hit in merged] == [2, 1, 3]
    assert merged[0].score == pytest.approx(1 / 62 + 1 / 61)
    assert merged[1].score == pytest.approx(1 / 61)


def test_rerank_orders_by_reranker_score(db_session, corpus):
    candidates = dense_search(db_session, embedder.embed_query("animal cage density"))
    reranked = rerank(db_session, "laptop export license abroad", candidates, reranker)

    assert titles(db_session, reranked)[0] == "Export Controls Policy"
    assert [h.score for h in reranked] == sorted((h.score for h in reranked), reverse=True)
    assert rerank(db_session, "anything", [], reranker) == []


def test_search_modes_and_retrieve(db_session, corpus):
    question = "Do I need an export license to take a laptop abroad?"
    for mode in retrieval.MODES:
        hits = search(db_session, question, mode, embedder, reranker, k=2)
        assert len(hits) == 2
        assert titles(db_session, hits)[0] == "Export Controls Policy", mode

    [(chunk, score), *_] = retrieve(db_session, question, embedder, reranker)
    assert chunk.document.title == "Export Controls Policy"
    assert chunk.section_heading == "2. Travel"
    assert 0 < score <= 1

    with pytest.raises(ValueError, match="Unknown retrieval mode"):
        search(db_session, question, "magic", embedder, reranker)

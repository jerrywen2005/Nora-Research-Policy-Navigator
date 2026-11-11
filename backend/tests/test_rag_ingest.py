import hashlib

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.models import DocumentChunk, DocumentStatus
from app.rag.embeddings import FakeEmbeddingProvider
from app.rag.ingest import ingest_all, ingest_document

POLICY = (
    "## Title\nExport Controls Policy\n"
    "## 1. Scope\nApplies to ITAR items.\n"
    "## 2. Contacts\nExport office."
)


class CountingEmbedder(FakeEmbeddingProvider):
    def __init__(self) -> None:
        self.calls: list[list[str]] = []

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        self.calls.append(texts)
        return super().embed_documents(texts)


@pytest.fixture
def embedder() -> CountingEmbedder:
    return CountingEmbedder()


def make_policy(content, markdown: str = POLICY, **fields):
    return content.document(
        "Export Controls Policy",
        content_text=markdown,
        content_hash=hashlib.sha256(markdown.encode()).hexdigest(),
        **fields,
    )


def chunks_of(db_session: Session, document) -> list[DocumentChunk]:
    return db_session.scalars(
        select(DocumentChunk)
        .where(DocumentChunk.document_id == document.id)
        .order_by(DocumentChunk.chunk_index)
    ).all()


def test_ingest_document_stores_chunks_with_context_and_embeddings(
    db_session: Session, content, embedder
):
    document = make_policy(content)

    assert ingest_document(db_session, document, embedder) is True

    chunks = chunks_of(db_session, document)
    assert [(c.chunk_index, c.section_heading, c.text) for c in chunks] == [
        (0, "1. Scope", "Applies to ITAR items."),
        (1, "2. Contacts", "Export office."),
    ]
    assert chunks[0].context == "Export Controls Policy > 1. Scope"
    assert chunks[0].word_count == 4
    assert chunks[0].content_hash == document.content_hash
    assert len(chunks[0].embedding) == 384
    assert embedder.calls == [
        [
            "Export Controls Policy > 1. Scope\nApplies to ITAR items.",
            "Export Controls Policy > 2. Contacts\nExport office.",
        ]
    ]
    assert [c.section_heading for c in document.chunks] == ["1. Scope", "2. Contacts"]
    # The keyword-search column is generated from the context and the text.
    matches = db_session.scalar(
        text(
            "SELECT count(*) FROM document_chunks WHERE document_id = :id "
            "AND search_vector @@ plainto_tsquery('english', 'itar')"
        ),
        {"id": document.id},
    )
    assert matches == 1


def test_ingest_document_skips_unchanged_text_and_replaces_changed_text(
    db_session: Session, content, embedder
):
    document = make_policy(content)
    ingest_document(db_session, document, embedder)

    assert ingest_document(db_session, document, embedder) is False
    assert len(embedder.calls) == 1

    document.content_text = "## 1. Scope\nNew text."
    document.content_hash = None  # falls back to hashing the text
    assert ingest_document(db_session, document, embedder) is True
    assert [c.text for c in chunks_of(db_session, document)] == ["New text."]


def test_ingest_all_only_ingests_active_documents(db_session: Session, content, embedder):
    active = make_policy(content)
    make_policy(content, status=DocumentStatus.DRAFT, source_url="https://example.org/draft")

    assert ingest_all(db_session, embedder) == (1, 0)
    assert ingest_all(db_session, embedder) == (0, 1)
    count = db_session.scalar(select(func.count()).select_from(DocumentChunk))
    assert count == len(chunks_of(db_session, active)) == 2

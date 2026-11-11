"""Ingestion: chunk each document's text, embed the chunks and store them in document_chunks.

Run it after seeding or changing documents (`python -m app.rag`). It only re-processes documents
whose text changed since their chunks were made, so running it again is cheap.
"""

import hashlib

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import Document, DocumentChunk, DocumentStatus
from app.rag.chunking import chunk_markdown, context_header
from app.rag.embeddings import EmbeddingProvider


def text_hash(document: Document) -> str:
    return document.content_hash or hashlib.sha256(document.content_text.encode()).hexdigest()


def ingest_document(session: Session, document: Document, embedder: EmbeddingProvider) -> bool:
    """Replace the document's chunks if its text changed. Returns whether it did. Doesn't commit."""
    current = text_hash(document)
    stored = session.scalars(
        select(DocumentChunk.content_hash).where(DocumentChunk.document_id == document.id).limit(1)
    ).first()
    if stored == current:
        return False

    chunks = chunk_markdown(document.content_text)
    contexts = [context_header(document.title, chunk.section) for chunk in chunks]
    vectors = embedder.embed_documents(
        [f"{context}\n{chunk.text}" for context, chunk in zip(contexts, chunks, strict=True)]
    )
    # Delete first: swapping the relationship list could insert the new rows before deleting the
    # old ones and hit the unique (document_id, chunk_index) constraint.
    session.execute(delete(DocumentChunk).where(DocumentChunk.document_id == document.id))
    session.add_all(
        DocumentChunk(
            document_id=document.id,
            chunk_index=index,
            section_heading=chunk.section,
            context=context,
            text=chunk.text,
            word_count=len(chunk.text.split()),
            content_hash=current,
            embedding=vector,
        )
        for index, (chunk, context, vector) in enumerate(
            zip(chunks, contexts, vectors, strict=True)
        )
    )
    session.flush()
    session.expire(document, ["chunks"])
    return True


def ingest_all(session: Session, embedder: EmbeddingProvider) -> tuple[int, int]:
    """Ingest every active document. Returns (re-chunked, unchanged). Doesn't commit."""
    documents = session.scalars(
        select(Document).where(Document.status == DocumentStatus.ACTIVE).order_by(Document.id)
    ).all()
    changed = sum(ingest_document(session, document, embedder) for document in documents)
    return changed, len(documents) - changed

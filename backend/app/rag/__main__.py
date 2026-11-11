"""Chunk and embed every changed document: `python -m app.rag` from backend/."""

from app.config import get_settings
from app.db import SessionLocal
from app.rag.embeddings import get_embedding_provider
from app.rag.ingest import ingest_all

with SessionLocal() as session:
    changed, unchanged = ingest_all(session, get_embedding_provider(get_settings()))
    session.commit()
print(f"Ingestion done: {changed} documents re-chunked, {unchanged} unchanged.")

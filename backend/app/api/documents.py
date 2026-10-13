from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, defer, joinedload, selectinload

from app.auth import get_current_user
from app.db import get_session
from app.models import Document, DocumentStatus, Topic
from app.schemas.content import DocumentDetail, DocumentPage

# Any signed-in user may browse and search; there is no anonymous access.
router = APIRouter(tags=["documents"], dependencies=[Depends(get_current_user)])

SessionDep = Annotated[Session, Depends(get_session)]


def search_documents(
    session: Session,
    *,
    q: str | None = None,
    topic: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[Document], int]:
    """Active documents, optionally in one topic and matching a keyword query.

    `q` uses Postgres web-search syntax (plain words, "quoted phrases", -excluded) and results are
    ranked by relevance; without `q` they are ordered by title. Returns one page and the total.
    """
    stmt = select(Document).where(Document.status == DocumentStatus.ACTIVE)
    if topic:
        stmt = stmt.where(Document.topics.any((Topic.slug == topic) & Topic.is_active))
    order_by = [Document.title, Document.id]
    if q:
        query = func.websearch_to_tsquery("english", q)
        stmt = stmt.where(Document.search_vector.op("@@")(query))
        order_by.insert(0, func.ts_rank_cd(Document.search_vector, query).desc())

    total = session.scalar(select(func.count()).select_from(stmt.subquery()))
    documents = session.scalars(
        stmt.options(
            defer(Document.content_text),
            joinedload(Document.office),
            selectinload(Document.topics),
        )
        .order_by(*order_by)
        .limit(limit)
        .offset(offset)
    ).all()
    return list(documents), total


@router.get("/documents", response_model=DocumentPage)
def list_documents(
    session: SessionDep,
    topic: Annotated[str | None, Query(description="Topic slug")] = None,
    q: Annotated[str | None, Query(max_length=500, description="Keywords")] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> DocumentPage:
    q = q.strip() if q else None
    documents, total = search_documents(session, q=q, topic=topic, limit=limit, offset=offset)
    return DocumentPage(items=documents, total=total)


@router.get("/documents/{document_id}", response_model=DocumentDetail)
def get_document(document_id: int, session: SessionDep) -> Document:
    document = session.scalars(
        select(Document)
        .options(joinedload(Document.office), selectinload(Document.topics))
        .where(Document.id == document_id, Document.status == DocumentStatus.ACTIVE)
    ).one_or_none()
    if document is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    return document

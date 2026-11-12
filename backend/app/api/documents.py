from collections.abc import Collection
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, literal_column, select
from sqlalchemy.orm import Session, defer, joinedload, selectinload

from app.analytics.logging import EventType, log_event
from app.auth import CurrentUser, get_current_user
from app.db import get_session
from app.models import Document, DocumentStatus, Tag, Topic, document_tags, document_topics
from app.schemas.content import DocumentDetail, DocumentPage, DocumentRef

# Any signed-in user may browse and search; there is no anonymous access.
router = APIRouter(tags=["documents"], dependencies=[Depends(get_current_user)])

SessionDep = Annotated[Session, Depends(get_session)]

RELATED_LIMIT = 5

# The names of a document's active topics and its tags, as one string per document.
_topic_names = (
    select(func.string_agg(Topic.name, " "))
    .join(document_topics, document_topics.c.topic_id == Topic.id)
    .where(document_topics.c.document_id == Document.id, Topic.is_active)
    .correlate(Document)
    .scalar_subquery()
)
_tag_names = (
    select(func.string_agg(Tag.name, " "))
    .join(document_tags, document_tags.c.tag_id == Tag.id)
    .where(document_tags.c.document_id == Document.id)
    .correlate(Document)
    .scalar_subquery()
)
# What `q` searches: title (A) > summary, topic and tag names (B) > body (C). Topic and tag
# names are computed per query rather than stored, so renaming a tag needs no reindex.
_names_vector = func.to_tsvector("english", func.concat_ws(" ", _topic_names, _tag_names))
# The weight must be Postgres's "char" type, which a bound string parameter isn't.
_search_vector = Document.search_vector.op("||")(
    func.setweight(_names_vector, literal_column("'B'::\"char\""))
)


def search_documents(
    session: Session,
    *,
    q: str | None = None,
    topic: str | None = None,
    tag: str | None = None,
    limit: int = 20,
    offset: int = 0,
    statuses: Collection[str] = (DocumentStatus.ACTIVE,),
    newest_first: bool = False,
) -> tuple[list[Document], int]:
    """Documents with one of `statuses`, optionally in one topic, with one tag, matching `q`.

    `q` uses Postgres web-search syntax (plain words, "quoted phrases", -excluded) and results are
    ranked by relevance; without `q` they are ordered by title, or by last update when
    `newest_first`. Returns one page and the total.
    """
    stmt = select(Document).where(Document.status.in_(statuses))
    if topic:
        stmt = stmt.where(Document.topics.any((Topic.slug == topic) & Topic.is_active))
    if tag:
        stmt = stmt.where(Document.tags.any(Tag.slug == tag))
    order_by = [Document.updated_at.desc()] if newest_first else []
    order_by += [Document.title, Document.id]
    if q:
        query = func.websearch_to_tsquery("english", q)
        stmt = stmt.where(_search_vector.op("@@")(query))
        order_by.insert(0, func.ts_rank_cd(_search_vector, query).desc())

    total = session.scalar(select(func.count()).select_from(stmt.subquery()))
    documents = session.scalars(
        stmt.options(
            defer(Document.content_text),
            joinedload(Document.office),
            selectinload(Document.topics),
            selectinload(Document.tags),
        )
        .order_by(*order_by)
        .limit(limit)
        .offset(offset)
    ).all()
    return list(documents), total


def related_documents(session: Session, document: Document) -> list[Document]:
    """Up to five other active documents sharing a tag: most shared tags first, then by title."""
    tag_ids = [tag.id for tag in document.tags]
    if not tag_ids:
        return []
    shared = func.count(document_tags.c.tag_id)
    return list(
        session.scalars(
            select(Document)
            .join(document_tags, document_tags.c.document_id == Document.id)
            .where(
                document_tags.c.tag_id.in_(tag_ids),
                Document.id != document.id,
                Document.status == DocumentStatus.ACTIVE,
            )
            .group_by(Document.id)
            .order_by(shared.desc(), Document.title, Document.id)
            .limit(RELATED_LIMIT)
        )
    )


@router.get("/documents", response_model=DocumentPage)
def list_documents(
    user: CurrentUser,
    session: SessionDep,
    topic: Annotated[str | None, Query(description="Topic slug")] = None,
    tag: Annotated[str | None, Query(description="Tag slug")] = None,
    q: Annotated[str | None, Query(max_length=500, description="Keywords")] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> DocumentPage:
    q = q.strip() if q else None
    documents, total = search_documents(
        session, q=q, topic=topic, tag=tag, limit=limit, offset=offset
    )
    if q and offset == 0:  # a search, counted once rather than again for each page
        log_event(session, user, EventType.SEARCH, query=q, result_count=total)
    return DocumentPage(items=documents, total=total)


@router.get("/documents/{document_id}", response_model=DocumentDetail)
def get_document(document_id: int, user: CurrentUser, session: SessionDep) -> DocumentDetail:
    document = session.scalars(
        select(Document)
        .options(
            joinedload(Document.office),
            selectinload(Document.topics),
            selectinload(Document.tags),
        )
        .where(Document.id == document_id, Document.status == DocumentStatus.ACTIVE)
    ).one_or_none()
    if document is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    detail = DocumentDetail.model_validate(document)
    detail.related_documents = [
        DocumentRef.model_validate(related) for related in related_documents(session, document)
    ]
    log_event(session, user, EventType.DOCUMENT_VIEW, document_id=document.id)
    return detail

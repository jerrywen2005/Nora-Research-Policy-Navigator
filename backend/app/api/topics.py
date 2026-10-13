from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_user
from app.db import get_session
from app.models import Document, DocumentStatus, Topic, document_topics
from app.schemas.content import OfficeOut, TopicDetail, TopicOut

# Any signed-in user may browse; there is no anonymous access.
router = APIRouter(tags=["topics"], dependencies=[Depends(get_current_user)])

SessionDep = Annotated[Session, Depends(get_session)]

# Number of active documents in each topic, as a correlated subquery.
_document_count = (
    select(func.count())
    .select_from(document_topics)
    .join(Document, Document.id == document_topics.c.document_id)
    .where(
        document_topics.c.topic_id == Topic.id,
        Document.status == DocumentStatus.ACTIVE,
    )
    .correlate(Topic)
    .scalar_subquery()
)


def _topic_out(topic: Topic, document_count: int) -> TopicOut:
    return TopicOut(
        id=topic.id,
        slug=topic.slug,
        name=topic.name,
        description=topic.description,
        document_count=document_count,
    )


@router.get("/topics", response_model=list[TopicOut])
def list_topics(session: SessionDep) -> list[TopicOut]:
    """Active topics in display order."""
    rows = session.execute(
        select(Topic, _document_count).where(Topic.is_active).order_by(Topic.sort_order, Topic.name)
    ).all()
    return [_topic_out(topic, count) for topic, count in rows]


@router.get("/topics/{slug}", response_model=TopicDetail)
def get_topic(slug: str, session: SessionDep) -> TopicDetail:
    row = session.execute(
        select(Topic, _document_count)
        .options(joinedload(Topic.default_office))
        .where(Topic.slug == slug, Topic.is_active)
    ).one_or_none()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Topic not found")
    topic, count = row
    office = OfficeOut.model_validate(topic.default_office) if topic.default_office else None
    return TopicDetail(**_topic_out(topic, count).model_dump(), office=office)

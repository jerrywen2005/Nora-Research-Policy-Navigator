"""FAQs (workflow E: F8, NF7). See docs/api.md, "FAQs" and "Admin: FAQs".

Admins write FAQs and move them through draft → published → archived, the same lifecycle as
documents. Researchers only see published FAQs, and only their active sources.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import Select, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.auth import get_current_user, require_role
from app.db import get_session
from app.models import Document, DocumentStatus, Faq, FaqStatus, Role, Topic, User
from app.schemas.faqs import AdminFaq, CreateFaqRequest, FaqOut, UpdateFaqRequest

# Any signed-in user may read published FAQs.
router = APIRouter(tags=["faqs"], dependencies=[Depends(get_current_user)])
admin_router = APIRouter(
    prefix="/admin/faqs",
    tags=["admin: faqs"],
    dependencies=[Depends(require_role(Role.ADMIN))],
)

SessionDep = Annotated[Session, Depends(get_session)]
AdminUser = Annotated[User, Depends(require_role(Role.ADMIN))]
TopicSlug = Annotated[str | None, Query(description="Topic slug")]


def _select(*, active_sources_only: bool = False) -> Select:
    documents = Faq.documents
    if active_sources_only:
        documents = documents.and_(Document.status == DocumentStatus.ACTIVE)
    return (
        select(Faq)
        .options(
            joinedload(Faq.topic),
            joinedload(Faq.updated_by_user),
            selectinload(documents),
        )
        .order_by(Faq.sort_order, Faq.question)
        # Reload the sources even if this session already holds the FAQ with other ones.
        .execution_options(populate_existing=True)
    )


def _in_topic(query: Select, topic: str | None) -> Select:
    if topic is None:
        return query
    return query.join(Faq.topic).where(Topic.slug == topic)


@router.get("/faqs", response_model=list[FaqOut])
def list_faqs(session: SessionDep, topic: TopicSlug = None) -> list[FaqOut]:
    """Published FAQs, optionally for one topic's page."""
    query = _select(active_sources_only=True).where(Faq.status == FaqStatus.PUBLISHED)
    faqs = session.scalars(_in_topic(query, topic)).unique()
    return [FaqOut.model_validate(faq) for faq in faqs]


# ---- Admin ----


def _get(session: Session, faq_id: int) -> Faq:
    faq = session.scalars(_select().where(Faq.id == faq_id)).unique().one_or_none()
    if faq is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "FAQ not found")
    return faq


def _save(session: Session, faq: Faq, user: User) -> AdminFaq:
    faq.updated_by = user.id
    session.commit()
    # Reload so server-set columns (updated_at) and relationships are current.
    session.expire(faq)
    return AdminFaq.model_validate(_get(session, faq.id))


def _conflict(detail: str) -> HTTPException:
    return HTTPException(status.HTTP_409_CONFLICT, detail)


def _invalid(detail: str) -> HTTPException:
    return HTTPException(422, detail)  # the constant was renamed in newer Starlette


def _topic(session: Session, topic_id: int) -> Topic:
    topic = session.get(Topic, topic_id)
    if topic is None:
        raise _invalid("Unknown topic id")
    return topic


def _documents(session: Session, ids: list[int]) -> list[Document]:
    unique = list(dict.fromkeys(ids))
    documents = session.scalars(select(Document).where(Document.id.in_(unique))).all()
    if len(documents) != len(unique):
        raise _invalid("Unknown document id")
    return list(documents)


@admin_router.get("", response_model=list[AdminFaq])
def list_admin_faqs(
    session: SessionDep,
    status_: Annotated[FaqStatus | None, Query(alias="status")] = None,
    topic: TopicSlug = None,
) -> list[AdminFaq]:
    query = _select()
    if status_ is not None:
        query = query.where(Faq.status == status_)
    faqs = session.scalars(_in_topic(query, topic)).unique()
    return [AdminFaq.model_validate(faq) for faq in faqs]


@admin_router.get("/{faq_id}", response_model=AdminFaq)
def get_admin_faq(faq_id: int, session: SessionDep) -> AdminFaq:
    return AdminFaq.model_validate(_get(session, faq_id))


@admin_router.post("", response_model=AdminFaq, status_code=status.HTTP_201_CREATED)
def create_faq(body: CreateFaqRequest, session: SessionDep, user: AdminUser) -> AdminFaq:
    """Create a draft."""
    faq = Faq(
        question=body.question,
        answer=body.answer,
        topic=_topic(session, body.topic_id) if body.topic_id is not None else None,
        documents=_documents(session, body.document_ids),
        sort_order=body.sort_order,
        status=FaqStatus.DRAFT,
        created_by=user.id,
    )
    session.add(faq)
    session.flush()
    return _save(session, faq, user)


@admin_router.patch("/{faq_id}", response_model=AdminFaq)
def update_faq(
    faq_id: int, body: UpdateFaqRequest, session: SessionDep, user: AdminUser
) -> AdminFaq:
    """Edit an FAQ. Omitted fields stay as they are; document_ids replaces the whole list."""
    faq = _get(session, faq_id)
    fields = body.model_fields_set
    for name in ("question", "answer", "document_ids", "sort_order"):
        if name in fields and getattr(body, name) is None:
            raise _invalid(f"{name} can't be null")

    if "question" in fields:
        faq.question = body.question
    if "answer" in fields:
        faq.answer = body.answer
    if "sort_order" in fields:
        faq.sort_order = body.sort_order
    if "topic_id" in fields:
        if body.topic_id is None:
            if faq.status == FaqStatus.PUBLISHED:
                raise _invalid("A published FAQ must have a topic")
            faq.topic = None
        else:
            faq.topic = _topic(session, body.topic_id)
    if "document_ids" in fields:
        faq.documents = _documents(session, body.document_ids)
    return _save(session, faq, user)


@admin_router.post("/{faq_id}/publish", response_model=AdminFaq)
def publish_faq(faq_id: int, session: SessionDep, user: AdminUser) -> AdminFaq:
    """draft → published. Needs a topic."""
    faq = _get(session, faq_id)
    if faq.status != FaqStatus.DRAFT:
        raise _conflict(f"Only drafts can be published; this FAQ is {faq.status}")
    if faq.topic is None:
        raise _conflict("Add a topic before publishing")
    faq.status = FaqStatus.PUBLISHED
    return _save(session, faq, user)


@admin_router.post("/{faq_id}/archive", response_model=AdminFaq)
def archive_faq(faq_id: int, session: SessionDep, user: AdminUser) -> AdminFaq:
    """draft or published → archived. Researchers stop seeing it."""
    faq = _get(session, faq_id)
    if faq.status == FaqStatus.ARCHIVED:
        raise _conflict("This FAQ is already archived")
    faq.status = FaqStatus.ARCHIVED
    return _save(session, faq, user)


@admin_router.post("/{faq_id}/restore", response_model=AdminFaq)
def restore_faq(faq_id: int, session: SessionDep, user: AdminUser) -> AdminFaq:
    """archived → draft, so it's reviewed and published again."""
    faq = _get(session, faq_id)
    if faq.status != FaqStatus.ARCHIVED:
        raise _conflict("Only archived FAQs can be restored")
    faq.status = FaqStatus.DRAFT
    return _save(session, faq, user)


@admin_router.delete("/{faq_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_faq(
    faq_id: int,
    session: SessionDep,
    confirm: Annotated[bool, Query(description="Must be true: the delete is permanent")] = False,
) -> Response:
    """Permanently delete an archived FAQ (NF7). Needs `confirm=true`."""
    if not confirm:
        raise _invalid("Permanent delete needs confirm=true")
    faq = _get(session, faq_id)
    if faq.status != FaqStatus.ARCHIVED:
        raise _conflict("Archive the FAQ before deleting it permanently")
    session.delete(faq)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

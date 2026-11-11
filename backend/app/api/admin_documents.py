"""Admin content management (workflow D: F12, NF7). See docs/api.md, "Admin: content management".

Admins edit metadata and move documents through draft → active → archived. Document text always
comes from the Research Policy Repository, so it's never edited here.
"""

import hashlib
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.api.documents import search_documents
from app.auth import require_role
from app.db import get_session
from app.models import DocType, Document, DocumentStatus, Office, Role, Tag, Topic, User
from app.policy_repository import (
    RepositoryClient,
    RepositoryError,
    extract_article,
    get_repository_client,
    inventory_policy,
    official_url,
    parse_article_id,
)
from app.schemas.admin_documents import (
    AdminDocumentDetail,
    AdminDocumentPage,
    ImportDocumentRequest,
    UpdateDocumentRequest,
)

router = APIRouter(
    prefix="/admin/documents",
    tags=["admin: documents"],
    dependencies=[Depends(require_role(Role.ADMIN))],
)

SessionDep = Annotated[Session, Depends(get_session)]
AdminUser = Annotated[User, Depends(require_role(Role.ADMIN))]
RepositoryDep = Annotated[RepositoryClient, Depends(get_repository_client)]


def _get(session: Session, document_id: int) -> Document:
    document = session.scalars(
        select(Document)
        .options(
            joinedload(Document.office),
            joinedload(Document.updated_by_user),
            selectinload(Document.topics),
            selectinload(Document.tags),
        )
        .where(Document.id == document_id)
    ).one_or_none()
    if document is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    return document


def _save(session: Session, document: Document, user: User) -> AdminDocumentDetail:
    document.updated_by = user.id
    session.commit()
    # Reload so server-set columns (updated_at) and relationships are current.
    session.expire(document)
    return AdminDocumentDetail.model_validate(_get(session, document.id))


def _conflict(detail: str) -> HTTPException:
    return HTTPException(status.HTTP_409_CONFLICT, detail)


def _invalid(detail: str) -> HTTPException:
    return HTTPException(422, detail)  # the constant was renamed in newer Starlette


def _find_by_article(session: Session, article_id: int) -> Document | None:
    """The document for a Repository article, whichever link form it was stored with."""
    candidates = session.scalars(
        select(Document).where(Document.source_url.contains(str(article_id)))
    )
    for document in candidates:
        if parse_article_id(document.source_url) == article_id:
            return document
    return None


def _by_ids(session: Session, model: type, ids: list[int], label: str) -> list:
    unique = list(dict.fromkeys(ids))
    rows = session.scalars(select(model).where(model.id.in_(unique))).all()
    if len(rows) != len(unique):
        raise _invalid(f"Unknown {label} id")
    by_id = {row.id: row for row in rows}
    return [by_id[i] for i in unique]


@router.get("", response_model=AdminDocumentPage)
def list_admin_documents(
    session: SessionDep,
    status_: Annotated[DocumentStatus | None, Query(alias="status")] = None,
    topic: Annotated[str | None, Query(description="Topic slug")] = None,
    q: Annotated[str | None, Query(max_length=500, description="Keywords")] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> AdminDocumentPage:
    q = q.strip() if q else None
    documents, total = search_documents(
        session,
        q=q,
        topic=topic,
        limit=limit,
        offset=offset,
        statuses=[status_] if status_ else list(DocumentStatus),
        newest_first=True,
    )
    return AdminDocumentPage(items=documents, total=total)


@router.get("/{document_id}", response_model=AdminDocumentDetail)
def get_admin_document(document_id: int, session: SessionDep) -> AdminDocumentDetail:
    return AdminDocumentDetail.model_validate(_get(session, document_id))


@router.post("", response_model=AdminDocumentDetail, status_code=status.HTTP_201_CREATED)
def import_document(
    body: ImportDocumentRequest, session: SessionDep, user: AdminUser, repository: RepositoryDep
) -> AdminDocumentDetail:
    """Import a Repository article by its link, as a draft."""
    article_id = parse_article_id(body.source_url)
    if article_id is None:
        raise _invalid("Not a Research Policy Repository article link (policies.unc.edu)")
    existing = _find_by_article(session, article_id)
    if existing is not None:
        raise _conflict(f"This article is already document {existing.id}")
    try:
        article = extract_article(repository.fetch_article(article_id))
    except RepositoryError as error:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(error)) from error

    document = Document(
        title=article.title[:500],
        doc_type=DocType.OTHER,
        source_url=official_url(article_id),
        content_text=article.content_text,
        content_hash=hashlib.sha256(article.content_text.encode()).hexdigest(),
        status=DocumentStatus.DRAFT,
        is_authoritative=False,
        created_by=user.id,
    )
    # Start from the Link's inventory when it lists the article: its category and tags.
    policy = inventory_policy(article_id)
    if policy is not None:
        document.topics = list(
            session.scalars(select(Topic).where(Topic.slug == policy.topic_slug))
        )
        document.tags = list(session.scalars(select(Tag).where(Tag.name.in_(policy.tag_names))))
    session.add(document)
    session.flush()
    return _save(session, document, user)


@router.patch("/{document_id}", response_model=AdminDocumentDetail)
def update_document(
    document_id: int, body: UpdateDocumentRequest, session: SessionDep, user: AdminUser
) -> AdminDocumentDetail:
    """Edit metadata. Omitted fields stay as they are; lists replace the whole list."""
    document = _get(session, document_id)
    fields = body.model_fields_set
    active = document.status == DocumentStatus.ACTIVE
    for name in ("doc_type", "topic_ids", "tag_ids", "is_authoritative"):
        if name in fields and getattr(body, name) is None:
            raise _invalid(f"{name} can't be null")

    if "doc_type" in fields:
        document.doc_type = body.doc_type
    if "is_authoritative" in fields:
        document.is_authoritative = body.is_authoritative
    if "office_id" in fields:
        if body.office_id is None:
            if active:
                raise _invalid("A published document must have an office")
            document.office = None
        else:
            document.office = _by_ids(session, Office, [body.office_id], "office")[0]
    if "topic_ids" in fields:
        if not body.topic_ids and active:
            raise _invalid("A published document must have at least one topic")
        document.topics = _by_ids(session, Topic, body.topic_ids, "topic")
    if "tag_ids" in fields:
        document.tags = _by_ids(session, Tag, body.tag_ids, "tag")
    return _save(session, document, user)


@router.post("/{document_id}/publish", response_model=AdminDocumentDetail)
def publish_document(document_id: int, session: SessionDep, user: AdminUser) -> AdminDocumentDetail:
    """draft → active. Needs an office and at least one topic."""
    document = _get(session, document_id)
    if document.status != DocumentStatus.DRAFT:
        raise _conflict(f"Only drafts can be published; this document is {document.status}")
    missing = [
        name
        for name, value in (("an office", document.office), ("a topic", document.topics))
        if not value
    ]
    if missing:
        raise _conflict(f"Add {' and '.join(missing)} before publishing")
    document.status = DocumentStatus.ACTIVE
    return _save(session, document, user)


@router.post("/{document_id}/archive", response_model=AdminDocumentDetail)
def archive_document(document_id: int, session: SessionDep, user: AdminUser) -> AdminDocumentDetail:
    """draft or active → archived. Researchers and answers stop seeing it."""
    document = _get(session, document_id)
    if document.status == DocumentStatus.ARCHIVED:
        raise _conflict("This document is already archived")
    document.status = DocumentStatus.ARCHIVED
    return _save(session, document, user)


@router.post("/{document_id}/restore", response_model=AdminDocumentDetail)
def restore_document(document_id: int, session: SessionDep, user: AdminUser) -> AdminDocumentDetail:
    """archived → draft, so it's reviewed and published again."""
    document = _get(session, document_id)
    if document.status != DocumentStatus.ARCHIVED:
        raise _conflict("Only archived documents can be restored")
    document.status = DocumentStatus.DRAFT
    return _save(session, document, user)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: int,
    session: SessionDep,
    confirm: Annotated[bool, Query(description="Must be true: the delete is permanent")] = False,
) -> Response:
    """Permanently delete an archived document (NF7). Needs `confirm=true`."""
    if not confirm:
        raise _invalid("Permanent delete needs confirm=true")
    document = _get(session, document_id)
    if document.status != DocumentStatus.ARCHIVED:
        raise _conflict("Archive the document before deleting it permanently")
    # Documents this one replaced keep existing; they just lose the pointer to it.
    for older in session.scalars(select(Document).where(Document.replaced_by_id == document.id)):
        older.replaced_by_id = None
    session.delete(document)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

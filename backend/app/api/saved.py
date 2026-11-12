from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import Select, delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session, defer, joinedload, selectinload

from app.auth import CurrentUser
from app.db import get_session
from app.models import Document, DocumentStatus, Outcome, Question, QuestionCitation, SavedItem
from app.rag.answer import Citation
from app.schemas.ask import CitationOut
from app.schemas.content import DocumentSummary, OfficeOut
from app.schemas.feedback import SavedItemOut, SavedQuestion, SaveRequest

router = APIRouter(tags=["saved"])

SessionDep = Annotated[Session, Depends(get_session)]

# Every query below is scoped to the signed-in user (NF6): nobody can list, add or remove another
# user's saved items, or save another user's question.


def _items(user_id: int) -> Select[tuple[SavedItem]]:
    """The user's saved items with what the response needs loaded, newest first."""
    return (
        select(SavedItem)
        .where(SavedItem.user_id == user_id)
        .options(
            selectinload(SavedItem.document).options(
                defer(Document.content_text),
                joinedload(Document.office),
                selectinload(Document.topics),
            ),
            selectinload(SavedItem.question).options(
                selectinload(Question.referred_office),
                selectinload(Question.citations).options(
                    selectinload(QuestionCitation.chunk),
                    selectinload(QuestionCitation.document).options(defer(Document.content_text)),
                ),
            ),
        )
        # id breaks ties between items saved in the same transaction.
        .order_by(SavedItem.created_at.desc(), SavedItem.id.desc())
    )


def _citation_out(citation: QuestionCitation) -> CitationOut:
    """A cited source as POST /api/ask showed it; `number` is the `[n]` in the answer."""
    chunk = citation.chunk
    return CitationOut(
        number=citation.rank,
        document_id=citation.document_id,
        title=citation.document.title,
        # Re-chunking the policy since then deleted the chunk; the title and link still work.
        section=chunk.section_heading if chunk else "",
        source_url=citation.document.source_url,
        snippet=Citation(citation.rank, chunk).snippet if chunk else "",
    )


def _to_out(item: SavedItem) -> SavedItemOut:
    if item.document is not None:
        return SavedItemOut(
            id=item.id,
            created_at=item.created_at,
            kind="document",
            document=DocumentSummary.model_validate(item.document),
            question=None,
        )
    question = item.question
    return SavedItemOut(
        id=item.id,
        created_at=item.created_at,
        kind="question",
        document=None,
        question=SavedQuestion(
            id=question.id,
            question_text=question.question_text,
            # Shown as it was when asked; the log keeps "error" for the dashboard.
            outcome="no_answer" if question.outcome == Outcome.ERROR else question.outcome,
            answer_text=question.answer_text,
            citations=[_citation_out(c) for c in question.citations if c.was_cited],
            referral=(
                OfficeOut.model_validate(question.referred_office)
                if question.referred_office
                else None
            ),
            created_at=question.created_at,
        ),
    )


@router.get("/saved", response_model=list[SavedItemOut])
def list_saved(user: CurrentUser, session: SessionDep) -> list[SavedItemOut]:
    """The signed-in user's saved documents and questions, newest first."""
    return [_to_out(item) for item in session.scalars(_items(user.id))]


@router.post("/saved", response_model=SavedItemOut, status_code=status.HTTP_201_CREATED)
def save(body: SaveRequest, user: CurrentUser, session: SessionDep, response: Response):
    """Save a document or one of the user's own questions. A repeat save returns the same item."""
    if body.document_id is not None:
        exists = session.scalar(
            select(Document.id).where(
                Document.id == body.document_id, Document.status == DocumentStatus.ACTIVE
            )
        )
        if exists is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
        target, conflict_on = SavedItem.document_id, "document_id"
        value = body.document_id
    else:
        exists = session.scalar(
            select(Question.id).where(Question.id == body.question_id, Question.user_id == user.id)
        )
        if exists is None:
            # Same response whether the question doesn't exist or belongs to someone else.
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Question not found")
        target, conflict_on = SavedItem.question_id, "question_id"
        value = body.question_id

    # ON CONFLICT on the partial unique index, so two quick saves can't create two rows.
    new_id = session.scalar(
        insert(SavedItem)
        .values(user_id=user.id, **{conflict_on: value})
        .on_conflict_do_nothing(
            index_elements=["user_id", conflict_on], index_where=target.is_not(None)
        )
        .returning(SavedItem.id)
    )
    session.commit()
    if new_id is None:
        response.status_code = status.HTTP_200_OK

    item = session.scalars(
        _items(user.id).where(target == value), execution_options={"populate_existing": True}
    ).one()
    return _to_out(item)


@router.delete("/saved/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def unsave(item_id: int, user: CurrentUser, session: SessionDep) -> Response:
    """Remove one of the signed-in user's saved items."""
    result = session.execute(
        delete(SavedItem).where(SavedItem.id == item_id, SavedItem.user_id == user.id)
    )
    if result.rowcount == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Saved item not found")
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.auth import CurrentUser
from app.db import get_session
from app.models import Feedback, Question
from app.schemas.feedback import FeedbackOut, FeedbackRequest

router = APIRouter(tags=["feedback"])

SessionDep = Annotated[Session, Depends(get_session)]

# Every query below is scoped to the signed-in user (NF6): nobody can read, change or even detect
# another user's question or feedback through these endpoints.


@router.put("/questions/{question_id}/feedback", response_model=FeedbackOut)
def rate_answer(
    question_id: int, body: FeedbackRequest, user: CurrentUser, session: SessionDep
) -> Feedback:
    """Rate an answer helpful or not. Replaces the user's earlier rating of the same question."""
    asked_by_user = session.scalar(
        select(Question.id).where(Question.id == question_id, Question.user_id == user.id)
    )
    if asked_by_user is None:
        # Same response whether the question doesn't exist or belongs to someone else.
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Question not found")

    insert_stmt = insert(Feedback).values(
        question_id=question_id, user_id=user.id, helpful=body.helpful, comment=body.comment
    )
    upsert = insert_stmt.on_conflict_do_update(
        constraint="uq_feedback_question_id_user_id",
        set_={
            "helpful": insert_stmt.excluded.helpful,
            "comment": insert_stmt.excluded.comment,
            # clock_timestamp(), not now(): now() is the transaction's start time.
            "updated_at": func.clock_timestamp(),
        },
    ).returning(Feedback)
    feedback = session.scalars(upsert, execution_options={"populate_existing": True}).one()
    session.commit()
    return feedback


@router.delete("/questions/{question_id}/feedback", status_code=status.HTTP_204_NO_CONTENT)
def remove_rating(question_id: int, user: CurrentUser, session: SessionDep) -> Response:
    """Undo the user's rating of a question."""
    result = session.execute(
        delete(Feedback).where(Feedback.question_id == question_id, Feedback.user_id == user.id)
    )
    if result.rowcount == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Feedback not found")
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

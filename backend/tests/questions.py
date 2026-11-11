"""Test helper: a logged question, as POST /api/ask would write it."""

from sqlalchemy.orm import Session

from app.models import Outcome, Question


def add_question(
    session: Session,
    user_id: int | None,
    *,
    text: str = "Do I need IRB approval?",
    outcome: Outcome = Outcome.ANSWERED,
    answer_text: str | None = "Usually yes. [1]",
) -> Question:
    question = Question(
        user_id=user_id,
        question_text=text,
        outcome=outcome,
        confidence=0.8,
        answer_text=answer_text,
        prompt_version="test",
        latency_ms=10,
    )
    session.add(question)
    session.flush()
    return question

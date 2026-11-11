from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.feedback import COMMENT_MAX_LENGTH


class FeedbackRequest(BaseModel):
    """`PUT /api/questions/{question_id}/feedback` request in docs/api.md."""

    helpful: bool
    comment: str | None = Field(default=None, max_length=COMMENT_MAX_LENGTH)

    @field_validator("comment")
    @classmethod
    def _blank_is_null(cls, comment: str | None) -> str | None:
        if comment is None:
            return None
        return comment.strip() or None


class FeedbackOut(BaseModel):
    """`Feedback` in docs/api.md."""

    model_config = ConfigDict(from_attributes=True)

    question_id: int
    helpful: bool
    comment: str | None
    created_at: datetime
    updated_at: datetime

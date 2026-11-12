"""`Analytics` in docs/api.md ("Admin analytics"). Aggregates only: no user ids or names (NF6)."""

from datetime import date

from pydantic import BaseModel, Field

from app.schemas.content import OfficeOut, TopicRef


class Activity(BaseModel):
    active_users: int
    logins: int


class Interactions(BaseModel):
    topic_views: int
    document_views: int
    searches: int
    questions: int


class TopicCount(BaseModel):
    topic: TopicRef
    count: int


class DocumentCount(BaseModel):
    document_id: int
    title: str
    count: int


class TextCount(BaseModel):
    text: str
    count: int


class ZeroResultSearches(BaseModel):
    total: int
    top_terms: list[TextCount]


class QuestionsByOutcome(BaseModel):
    answered: int
    referred: int
    out_of_scope: int
    no_answer: int
    error: int


class OfficeCount(BaseModel):
    office: OfficeOut
    count: int


class FeedbackSummary(BaseModel):
    rated: int
    helpful: int
    helpful_share: float | None


class DailyActivity(BaseModel):
    date: date
    logins: int
    topic_views: int
    document_views: int
    searches: int
    questions: int


class DailyTopicQuestions(BaseModel):
    date: date
    topic: TopicRef | None
    count: int


class Analytics(BaseModel):
    # `from` is a Python keyword; FastAPI serializes by alias, so the JSON key is "from".
    from_: date = Field(serialization_alias="from")
    to: date
    min_distinct_users: int
    activity: Activity
    interactions: Interactions
    top_topics: list[TopicCount]
    top_documents: list[DocumentCount]
    most_cited_documents: list[DocumentCount]
    top_search_terms: list[TextCount]
    zero_result_searches: ZeroResultSearches
    top_questions: list[TextCount]
    questions_by_outcome: QuestionsByOutcome
    referrals_by_office: list[OfficeCount]
    feedback: FeedbackSummary
    daily: list[DailyActivity]
    daily_questions_by_topic: list[DailyTopicQuestions]

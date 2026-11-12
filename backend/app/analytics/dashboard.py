"""The admin dashboard's numbers (product.md measures 1-9). Contract: docs/api.md.

Every measure is one SQL aggregate over a date range; Python only reshapes the aggregated rows.
Both GET /api/admin/analytics and the CSV export call `compute`, so they always agree.

Privacy (NF6): nothing here returns a user id or name. Users are only ever counted, and free
text is listed only when at least MIN_DISTINCT_USERS different people used it.
"""

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import ColumnElement, Select, distinct, func, select, union
from sqlalchemy.orm import Session

from app.models import (
    Document,
    EventType,
    Feedback,
    Office,
    Outcome,
    Question,
    QuestionCitation,
    Topic,
    UsageEvent,
)
from app.schemas.analytics import (
    Activity,
    Analytics,
    DailyActivity,
    DailyTopicQuestions,
    DocumentCount,
    FeedbackSummary,
    Interactions,
    OfficeCount,
    QuestionsByOutcome,
    TextCount,
    TopicCount,
    ZeroResultSearches,
)
from app.schemas.content import OfficeOut, TopicRef

# Days are UNC's calendar days, whatever time zone the server runs in.
TIMEZONE = "America/New_York"
# Free text (search terms, questions) is shown only if this many different people used it.
# Proposed 2026-11-11, awaiting confirmation (docs/decisions.md).
MIN_DISTINCT_USERS = 2
TOP_N = 10
MAX_RANGE_DAYS = 366


def today() -> date:
    return datetime.now(ZoneInfo(TIMEZONE)).date()


def _bounds(start: date, end: date) -> tuple[datetime, datetime]:
    """[start of `start`, start of the day after `end`), in UNC's time zone."""
    zone = ZoneInfo(TIMEZONE)
    return (
        datetime.combine(start, time.min, zone),
        datetime.combine(end + timedelta(days=1), time.min, zone),
    )


def _day(column: ColumnElement) -> ColumnElement:
    """The UNC calendar day of a timestamptz column."""
    return func.date(func.timezone(TIMEZONE, column))


def compute(session: Session, start: date, end: date) -> Analytics:
    """Every dashboard measure for `start`..`end`, both inclusive."""
    lo, hi = _bounds(start, end)
    in_range_event = (UsageEvent.created_at >= lo) & (UsageEvent.created_at < hi)
    in_range_question = (Question.created_at >= lo) & (Question.created_at < hi)

    def events(event_type: EventType) -> ColumnElement:
        return in_range_event & (UsageEvent.event_type == event_type)

    # ---- 1 and 2: users, logins and interaction counts ----
    by_type = dict(
        session.execute(
            select(UsageEvent.event_type, func.count())
            .where(in_range_event)
            .group_by(UsageEvent.event_type)
        ).all()
    )
    question_count = session.scalar(select(func.count()).where(in_range_question)) or 0
    people = union(
        select(UsageEvent.user_id).where(in_range_event, UsageEvent.user_id.is_not(None)),
        select(Question.user_id).where(in_range_question, Question.user_id.is_not(None)),
    ).subquery()
    active_users = session.scalar(select(func.count()).select_from(people))

    # ---- 3: most viewed topics and documents, most cited documents ----
    topic_views = func.count().label("n")
    top_topics = session.execute(
        select(Topic.id, Topic.slug, Topic.name, topic_views)
        .join(UsageEvent, UsageEvent.topic_id == Topic.id)
        .where(events(EventType.TOPIC_VIEW))
        .group_by(Topic.id)
        .order_by(topic_views.desc(), Topic.name)
        .limit(TOP_N)
    ).all()

    document_views = func.count().label("n")
    top_documents = session.execute(
        select(Document.id, Document.title, document_views)
        .join(UsageEvent, UsageEvent.document_id == Document.id)
        .where(events(EventType.DOCUMENT_VIEW))
        .group_by(Document.id)
        .order_by(document_views.desc(), Document.title)
        .limit(TOP_N)
    ).all()

    # An answer citing two sections of one policy cites that policy once.
    citing_questions = func.count(distinct(QuestionCitation.question_id)).label("n")
    most_cited = session.execute(
        select(Document.id, Document.title, citing_questions)
        .join(QuestionCitation, QuestionCitation.document_id == Document.id)
        .join(Question, Question.id == QuestionCitation.question_id)
        .where(in_range_question, QuestionCitation.was_cited)
        .group_by(Document.id)
        .order_by(citing_questions.desc(), Document.title)
        .limit(TOP_N)
    ).all()

    # ---- 4 and 5: search terms, and searches that found nothing ----
    def common_terms(*conditions: ColumnElement) -> list[TextCount]:
        searches = func.count().label("n")
        rows = session.execute(
            select(UsageEvent.query, searches)
            .where(events(EventType.SEARCH), *conditions)
            .group_by(UsageEvent.query)
            .having(func.count(distinct(UsageEvent.user_id)) >= MIN_DISTINCT_USERS)
            .order_by(searches.desc(), UsageEvent.query)
            .limit(TOP_N)
        ).all()
        return [TextCount(text=text, count=n) for text, n in rows]

    no_results = UsageEvent.result_count == 0
    zero_result_total = session.scalar(
        select(func.count()).where(events(EventType.SEARCH), no_results)
    )

    # ---- 6: questions asked most often (same text after trimming and lowercasing) ----
    question_key = func.lower(func.btrim(Question.question_text))
    times_asked = func.count().label("n")
    top_questions = session.execute(
        select(question_key, times_asked)
        .where(in_range_question)
        .group_by(question_key)
        .having(func.count(distinct(Question.user_id)) >= MIN_DISTINCT_USERS)
        .order_by(times_asked.desc(), question_key)
        .limit(TOP_N)
    ).all()

    # ---- 7: outcomes, and referrals by office ----
    outcomes = dict(
        session.execute(
            select(Question.outcome, func.count())
            .where(in_range_question)
            .group_by(Question.outcome)
        ).all()
    )
    referrals = func.count().label("n")
    referral_rows = session.execute(
        select(Office, referrals)
        .join(Question, Question.referred_office_id == Office.id)
        .where(in_range_question)
        .group_by(Office.id)
        .order_by(referrals.desc(), Office.name)
        .limit(TOP_N)
    ).all()

    # ---- 8: feedback on the questions asked in the range ----
    rated, helpful = session.execute(
        select(func.count(), func.count().filter(Feedback.helpful))
        .select_from(Feedback)
        .join(Question, Question.id == Feedback.question_id)
        .where(in_range_question)
    ).one()

    # ---- 9: patterns over time ----
    event_day = _day(UsageEvent.created_at)
    question_day = _day(Question.created_at)
    per_day: dict[date, dict[str, int]] = {}
    for day, event_type, n in session.execute(
        select(event_day, UsageEvent.event_type, func.count())
        .where(in_range_event)
        .group_by(event_day, UsageEvent.event_type)
    ):
        per_day.setdefault(day, {})[event_type] = n
    for day, n in session.execute(
        select(question_day, func.count()).where(in_range_question).group_by(question_day)
    ):
        per_day.setdefault(day, {})["questions"] = n

    questions_by_topic: Select = (
        select(question_day, Topic.id, Topic.slug, Topic.name, func.count())
        .select_from(Question)
        .outerjoin(Topic, Topic.id == Question.topic_id)
        .where(in_range_question)
        .group_by(question_day, Topic.id)
        # Oldest first; within a day, topics A to Z, then questions asked without a topic.
        .order_by(question_day, Topic.name.nulls_last())
    )

    return Analytics(
        from_=start,
        to=end,
        min_distinct_users=MIN_DISTINCT_USERS,
        activity=Activity(active_users=active_users, logins=by_type.get(EventType.LOGIN, 0)),
        interactions=Interactions(
            topic_views=by_type.get(EventType.TOPIC_VIEW, 0),
            document_views=by_type.get(EventType.DOCUMENT_VIEW, 0),
            searches=by_type.get(EventType.SEARCH, 0),
            questions=question_count,
        ),
        top_topics=[
            TopicCount(topic=TopicRef(id=id_, slug=slug, name=name), count=n)
            for id_, slug, name, n in top_topics
        ],
        top_documents=[
            DocumentCount(document_id=id_, title=title, count=n) for id_, title, n in top_documents
        ],
        most_cited_documents=[
            DocumentCount(document_id=id_, title=title, count=n) for id_, title, n in most_cited
        ],
        top_search_terms=common_terms(),
        zero_result_searches=ZeroResultSearches(
            total=zero_result_total, top_terms=common_terms(no_results)
        ),
        top_questions=[TextCount(text=text, count=n) for text, n in top_questions],
        questions_by_outcome=QuestionsByOutcome(
            **{str(outcome): outcomes.get(outcome, 0) for outcome in Outcome}
        ),
        referrals_by_office=[
            OfficeCount(office=OfficeOut.model_validate(office), count=n)
            for office, n in referral_rows
        ],
        feedback=FeedbackSummary(
            rated=rated,
            helpful=helpful,
            helpful_share=round(helpful / rated, 3) if rated else None,
        ),
        daily=[
            DailyActivity(
                date=day,
                logins=counts.get(EventType.LOGIN, 0),
                topic_views=counts.get(EventType.TOPIC_VIEW, 0),
                document_views=counts.get(EventType.DOCUMENT_VIEW, 0),
                searches=counts.get(EventType.SEARCH, 0),
                questions=counts.get("questions", 0),
            )
            for day in (start + timedelta(days=i) for i in range((end - start).days + 1))
            for counts in [per_day.get(day, {})]
        ],
        daily_questions_by_topic=[
            DailyTopicQuestions(
                date=day,
                topic=TopicRef(id=id_, slug=slug, name=name) if id_ is not None else None,
                count=n,
            )
            for day, id_, slug, name, n in session.execute(questions_by_topic)
        ],
    )

"""The dashboard as CSV (measure 10): one section per measure. Layout: docs/api.md."""

import csv
import io

from app.schemas.analytics import Analytics

# Characters that make Excel or Sheets treat a cell as a formula. Search terms and questions are
# typed by researchers, so a cell starting with one gets a leading ' (CSV injection).
_FORMULA_START = ("=", "+", "-", "@", "\t", "\r")


def _cell(value) -> str | int | float:
    if value is None:
        return ""
    if isinstance(value, str) and value.startswith(_FORMULA_START):
        return "'" + value
    return value


def to_csv(data: Analytics) -> str:
    out = io.StringIO()
    writer = csv.writer(out, lineterminator="\r\n")

    def section(title: str, header: list[str], rows: list[list]) -> None:
        if out.tell():
            writer.writerow([])
        writer.writerow([title])
        writer.writerow(header)
        writer.writerows([_cell(value) for value in row] for row in rows)

    section(
        "Summary",
        ["measure", "value"],
        [
            ["from", data.from_.isoformat()],
            ["to", data.to.isoformat()],
            ["min_distinct_users", data.min_distinct_users],
            ["active_users", data.activity.active_users],
            ["logins", data.activity.logins],
            ["topic_views", data.interactions.topic_views],
            ["document_views", data.interactions.document_views],
            ["searches", data.interactions.searches],
            ["questions", data.interactions.questions],
            ["feedback_rated", data.feedback.rated],
            ["feedback_helpful", data.feedback.helpful],
            ["feedback_helpful_share", data.feedback.helpful_share],
        ],
    )
    section(
        "Top topics",
        ["topic_slug", "topic_name", "views"],
        [[t.topic.slug, t.topic.name, t.count] for t in data.top_topics],
    )
    section(
        "Top documents viewed",
        ["document_id", "title", "views"],
        [[d.document_id, d.title, d.count] for d in data.top_documents],
    )
    section(
        "Most cited documents",
        ["document_id", "title", "citations"],
        [[d.document_id, d.title, d.count] for d in data.most_cited_documents],
    )
    section(
        "Top search terms",
        ["term", "searches"],
        [[t.text, t.count] for t in data.top_search_terms],
    )
    section(
        "Zero-result search terms",
        ["term", "searches"],
        [[t.text, t.count] for t in data.zero_result_searches.top_terms],
    )
    section(
        "Most asked questions",
        ["question", "times_asked"],
        [[t.text, t.count] for t in data.top_questions],
    )
    section(
        "Questions by outcome",
        ["outcome", "questions"],
        [[outcome, n] for outcome, n in data.questions_by_outcome.model_dump().items()],
    )
    section(
        "Referrals by office",
        ["office", "questions"],
        [[r.office.name, r.count] for r in data.referrals_by_office],
    )
    section(
        "Daily activity",
        ["date", "logins", "topic_views", "document_views", "searches", "questions"],
        [
            [d.date.isoformat(), d.logins, d.topic_views, d.document_views, d.searches, d.questions]
            for d in data.daily
        ],
    )
    section(
        "Daily questions by topic",
        ["date", "topic_slug", "topic_name", "questions"],
        [
            [
                d.date.isoformat(),
                d.topic.slug if d.topic else None,
                d.topic.name if d.topic else None,
                d.count,
            ]
            for d in data.daily_questions_by_topic
        ],
    )
    return out.getvalue()

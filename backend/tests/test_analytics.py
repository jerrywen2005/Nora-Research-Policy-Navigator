import csv
import io
import json
from datetime import date, datetime
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.analytics import dashboard
from app.models import (
    EventType,
    Feedback,
    Outcome,
    Question,
    QuestionCitation,
    Role,
    Topic,
    UsageEvent,
    User,
)
from tests.conftest import login
from tests.questions import add_question

UNC = ZoneInfo("America/New_York")
WEEK = {"from": "2026-11-01", "to": "2026-11-07"}


def at(day: int, hour: int = 12, minute: int = 0, month: int = 11) -> datetime:
    """A time on a 2026 day in UNC's time zone."""
    return datetime(2026, month, day, hour, minute, tzinfo=UNC)


@pytest.fixture
def admin(client: TestClient, make_user, db_session: Session) -> TestClient:
    """A signed-in admin, starting from no logged activity at all.

    Your dev database may already hold events and questions; they're deleted inside this test's
    transaction, so the numbers only reflect what the test creates.
    """
    db_session.execute(delete(UsageEvent))
    db_session.execute(delete(Question))
    make_user("boss", role=Role.ADMIN)
    login(client, "boss")  # its login event is today, outside every range used here
    return client


@pytest.fixture
def log(db_session: Session):
    def add(user: User | None, event_type: EventType, when: datetime, **fields) -> None:
        db_session.add(
            UsageEvent(
                user_id=user.id if user else None, event_type=event_type, created_at=when, **fields
            )
        )
        db_session.flush()

    return add


@pytest.fixture
def ask(db_session: Session):
    def add(user: User, text: str, when: datetime, outcome=Outcome.ANSWERED, **fields) -> Question:
        question = add_question(db_session, user.id, text=text, outcome=outcome)
        question.created_at = when
        for name, value in fields.items():
            setattr(question, name, value)
        db_session.flush()
        return question

    return add


@pytest.fixture
def week(admin, make_user, content, log, ask, db_session):
    """A week of activity by three researchers, plus noise just outside it."""
    alice, bob, carol = make_user("alice"), make_user("bob"), make_user("carol")
    ohre = content.office("Office of Human Research Ethics")
    osp = content.office("Office of Sponsored Programs")
    hsr = content.topic("human-subjects-research", name="Human Subjects Research")
    export = content.topic("export-controls", name="Export Controls")
    a_policy = content.document("A Policy")
    b_policy = content.document("B Policy")

    # 1: logins
    log(alice, EventType.LOGIN, at(1, 9))
    log(bob, EventType.LOGIN, at(1, 10))
    log(alice, EventType.LOGIN, at(2, 9))
    # 3: topic and document views (the two documents tie, so A sorts first)
    for user, day in [(alice, 1), (bob, 1), (alice, 2)]:
        log(user, EventType.TOPIC_VIEW, at(day), topic_id=hsr.id)
    log(bob, EventType.TOPIC_VIEW, at(2), topic_id=export.id)
    for document in [b_policy, a_policy, b_policy, a_policy]:
        log(alice, EventType.DOCUMENT_VIEW, at(3), document_id=document.id)
    # 4 and 5: searches. "rare term" is searched twice but by one person, so it stays hidden.
    for user, term, results in [
        (alice, "irb", 5),
        (bob, "irb", 5),
        (alice, "rare term", 3),
        (alice, "rare term", 3),
        (alice, "nothing here", 0),
        (bob, "nothing here", 0),
        (carol, "lonely miss", 0),
    ]:
        log(user, EventType.SEARCH, at(4), query=term, result_count=results)

    # 6-8: questions, citations and feedback
    q1 = ask(alice, "Do I need IRB?", at(1), topic_id=hsr.id)
    q1.citations = [
        QuestionCitation(rank=1, document_id=a_policy.id, score=0.9, was_cited=True),
        QuestionCitation(rank=2, document_id=a_policy.id, score=0.8, was_cited=True),
        QuestionCitation(rank=3, document_id=b_policy.id, score=0.7, was_cited=False),
    ]
    q2 = ask(bob, "  do i need IRB?  ", at(2), topic_id=hsr.id)
    q2.citations = [QuestionCitation(rank=1, document_id=b_policy.id, score=0.9, was_cited=True)]
    q3 = ask(alice, "Export a laptop?", at(2), Outcome.REFERRED, referred_office_id=osp.id)
    rare = {"topic_id": export.id, "referred_office_id": ohre.id}
    ask(carol, "A rare question", at(3), Outcome.NO_ANSWER, **rare)
    ask(carol, "LLM fell over", at(3), Outcome.ERROR, referred_office_id=ohre.id)
    db_session.add_all(
        [
            Feedback(question_id=q1.id, user_id=alice.id, helpful=True),
            Feedback(question_id=q2.id, user_id=bob.id, helpful=False),
            Feedback(question_id=q3.id, user_id=alice.id, helpful=True),
        ]
    )

    # Noise just outside the week, which must not count anywhere.
    log(alice, EventType.SEARCH, at(31, 23, 59, month=10), query="irb", result_count=0)
    log(bob, EventType.TOPIC_VIEW, at(8, 0, 0), topic_id=export.id)
    early = ask(bob, "Do I need IRB?", at(31, 23, 59, month=10))
    db_session.add(Feedback(question_id=early.id, user_id=bob.id, helpful=False))
    db_session.flush()
    return {"hsr": hsr, "export": export, "a": a_policy, "b": b_policy, "ohre": ohre, "osp": osp}


def ref(topic: Topic) -> dict:
    return {"id": topic.id, "slug": topic.slug, "name": topic.name}


def get(client: TestClient, **params) -> dict:
    response = client.get("/api/admin/analytics", params=params or WEEK)
    assert response.status_code == 200, response.text
    return response.json()


# ---- Every measure ----


def test_activity_and_interaction_counts(admin, week):
    body = get(admin)

    assert (body["from"], body["to"], body["min_distinct_users"]) == ("2026-11-01", "2026-11-07", 2)
    # Alice, Bob and Carol; Carol only searched and asked. The admin's login is today.
    assert body["activity"] == {"active_users": 3, "logins": 3}
    assert body["interactions"] == {
        "topic_views": 4,
        "document_views": 4,
        "searches": 7,
        "questions": 5,
    }


def test_top_topics_documents_and_most_cited(admin, week):
    body = get(admin)

    hsr, export = week["hsr"], week["export"]
    assert body["top_topics"] == [
        {"topic": ref(hsr), "count": 3},
        {"topic": ref(export), "count": 1},
    ]
    assert body["top_documents"] == [
        {"document_id": week["a"].id, "title": "A Policy", "count": 2},
        {"document_id": week["b"].id, "title": "B Policy", "count": 2},
    ]
    # Q1 cites A Policy twice (one answer), Q2 cites B Policy; Q1's uncited B doesn't count.
    assert body["most_cited_documents"] == [
        {"document_id": week["a"].id, "title": "A Policy", "count": 1},
        {"document_id": week["b"].id, "title": "B Policy", "count": 1},
    ]


def test_search_terms_and_zero_result_searches(admin, week):
    body = get(admin)

    # Ties sort A to Z; "rare term" (2 searches, 1 person) and "lonely miss" stay hidden.
    assert body["top_search_terms"] == [
        {"text": "irb", "count": 2},
        {"text": "nothing here", "count": 2},
    ]
    assert body["zero_result_searches"] == {
        "total": 3,
        "top_terms": [{"text": "nothing here", "count": 2}],
    }


def test_most_asked_questions_group_by_trimmed_lowercase_text(admin, week):
    # Alice's "Do I need IRB?" and Bob's "  do i need IRB?  " are the same question.
    assert get(admin)["top_questions"] == [{"text": "do i need irb?", "count": 2}]


def test_outcomes_and_referrals(admin, week):
    body = get(admin)

    assert body["questions_by_outcome"] == {
        "answered": 2,
        "referred": 1,
        "no_answer": 1,
        "error": 1,
    }
    ohre, osp = week["ohre"], week["osp"]
    assert body["referrals_by_office"] == [
        {
            "office": {"id": ohre.id, "name": ohre.name, "email": None, "phone": None, "url": None},
            "count": 2,
        },
        {
            "office": {"id": osp.id, "name": osp.name, "email": None, "phone": None, "url": None},
            "count": 1,
        },
    ]


def test_feedback_counts_ratings_on_questions_asked_in_the_range(admin, week):
    assert get(admin)["feedback"] == {"rated": 3, "helpful": 2, "helpful_share": 0.667}


def test_daily_series_has_every_day(admin, week):
    daily = get(admin)["daily"]

    assert [d["date"] for d in daily] == [f"2026-11-0{n}" for n in range(1, 8)]
    assert daily[0] == {
        "date": "2026-11-01",
        "logins": 2,
        "topic_views": 2,
        "document_views": 0,
        "searches": 0,
        "questions": 1,
    }
    assert daily[3]["searches"] == 7
    assert daily[6] == {
        "date": "2026-11-07",
        "logins": 0,
        "topic_views": 0,
        "document_views": 0,
        "searches": 0,
        "questions": 0,
    }


def test_daily_questions_by_topic(admin, week):
    hsr, export = week["hsr"], week["export"]

    assert get(admin)["daily_questions_by_topic"] == [
        {"date": "2026-11-01", "topic": ref(hsr), "count": 1},
        {"date": "2026-11-02", "topic": ref(hsr), "count": 1},
        {"date": "2026-11-02", "topic": None, "count": 1},
        {"date": "2026-11-03", "topic": ref(export), "count": 1},
        {"date": "2026-11-03", "topic": None, "count": 1},
    ]


def test_top_lists_stop_at_ten(admin, make_user, content, log):
    users = [make_user(f"user{n}") for n in range(2)]
    for n in range(12):
        topic = content.topic(f"topic-{n:02}")
        for user in users:
            log(user, EventType.TOPIC_VIEW, at(1), topic_id=topic.id)
            log(user, EventType.SEARCH, at(1), query=f"term {n:02}", result_count=1)

    body = get(admin)

    assert [t["topic"]["slug"] for t in body["top_topics"]] == [f"topic-{n:02}" for n in range(10)]
    assert len(body["top_search_terms"]) == 10


def test_deleted_topic_drops_out_of_lists_but_stays_in_totals(admin, week, db_session):
    db_session.execute(delete(Topic).where(Topic.id == week["export"].id))

    body = get(admin)

    assert [t["topic"]["slug"] for t in body["top_topics"]] == ["human-subjects-research"]
    assert body["interactions"]["topic_views"] == 4


# ---- Dates ----


def test_both_ends_are_inclusive_in_unc_time(admin, make_user, log):
    user = make_user("edge")
    log(user, EventType.LOGIN, at(1, 0, 0))  # first moment of Nov 1, Eastern
    log(user, EventType.LOGIN, at(7, 23, 59))  # last minute of Nov 7, Eastern
    log(user, EventType.LOGIN, at(31, 23, 59, month=10))  # just before
    log(user, EventType.LOGIN, at(8, 0, 0))  # just after (05:00 UTC, still Nov 8)

    body = get(admin)

    assert body["activity"]["logins"] == 2
    assert [d["logins"] for d in body["daily"]] == [1, 0, 0, 0, 0, 0, 1]


def test_single_day_range(admin, week):
    body = get(admin, **{"from": "2026-11-04", "to": "2026-11-04"})

    assert body["interactions"]["searches"] == 7
    assert len(body["daily"]) == 1


def test_empty_range_gives_zeros_and_empty_lists(admin, week):
    body = get(admin, **{"from": "2025-01-01", "to": "2025-01-02"})

    assert body["activity"] == {"active_users": 0, "logins": 0}
    assert body["interactions"] == dict.fromkeys(
        ["topic_views", "document_views", "searches", "questions"], 0
    )
    for key in [
        "top_topics",
        "top_documents",
        "most_cited_documents",
        "top_search_terms",
        "top_questions",
        "referrals_by_office",
        "daily_questions_by_topic",
    ]:
        assert body[key] == []
    assert body["zero_result_searches"] == {"total": 0, "top_terms": []}
    assert set(body["questions_by_outcome"].values()) == {0}
    assert body["feedback"] == {"rated": 0, "helpful": 0, "helpful_share": None}
    assert len(body["daily"]) == 2


def test_default_range_is_the_last_30_days(admin, monkeypatch):
    monkeypatch.setattr(dashboard, "today", lambda: date(2026, 11, 7))

    body = get(admin, unused="x")  # no from or to

    assert (body["from"], body["to"]) == ("2026-10-09", "2026-11-07")
    assert len(body["daily"]) == 30


def test_only_from_or_only_to(admin, monkeypatch):
    monkeypatch.setattr(dashboard, "today", lambda: date(2026, 11, 7))

    assert get(admin, **{"from": "2026-11-05"})["to"] == "2026-11-07"
    assert get(admin, to="2026-10-31")["from"] == "2026-10-02"


def test_today_is_a_date_in_unc_time():
    assert isinstance(dashboard.today(), date)


@pytest.mark.parametrize(
    "params",
    [
        {"from": "2026-11-07", "to": "2026-11-06"},  # to before from
        {"from": "2025-01-01", "to": "2026-01-02"},  # 367 days
        {"from": "11/01/2026", "to": "2026-11-07"},  # not YYYY-MM-DD
        {"from": "2026-02-30"},  # not a date
    ],
)
def test_invalid_ranges_are_422(admin, params):
    assert admin.get("/api/admin/analytics", params=params).status_code == 422


def test_a_full_leap_year_is_allowed(admin):
    assert get(admin, **{"from": "2028-01-01", "to": "2028-12-31"})["to"] == "2028-12-31"


# ---- Access ----


def test_requires_sign_in(client: TestClient):
    assert client.get("/api/admin/analytics").status_code == 401


def test_researchers_are_forbidden(client: TestClient):
    login(client, "researcher-only")
    assert client.get("/api/admin/analytics").status_code == 403


# ---- Privacy (NF6) ----


def test_no_user_identity_anywhere(admin, week, db_session):
    text = admin.get("/api/admin/analytics", params=WEEK).text
    people = db_session.query(User).filter(User.onyen.in_(["alice", "bob", "carol", "boss"])).all()

    for person in people:
        assert person.onyen not in text
    keys = set()

    def collect(value):
        if isinstance(value, dict):
            keys.update(value)
            for item in value.values():
                collect(item)
        elif isinstance(value, list):
            for item in value:
                collect(item)

    collect(json.loads(text))
    assert not {k for k in keys if "user" in k or "onyen" in k or "email" in k} - {
        "active_users",
        "min_distinct_users",
        "email",  # an office's contact email, not a person's
    }


# ---- CSV export (measure 10) ----


def sections(text: str) -> dict[str, list[list[str]]]:
    """Parse the export into {title: [header, *rows]}; sections are split by a blank row."""
    parsed: dict[str, list[list[str]]] = {}
    title = None
    for row in csv.reader(io.StringIO(text)):
        if not row:
            title = None
        elif title is None:
            title = row[0]
            parsed[title] = []
        else:
            parsed[title].append(row)
    return parsed


def export(client: TestClient, **params):
    response = client.get("/api/admin/analytics/export.csv", params=params or WEEK)
    assert response.status_code == 200, response.text
    return response


def test_export_headers_and_filename(admin, week):
    response = export(admin)

    assert response.headers["content-type"] == "text/csv; charset=utf-8"
    assert response.headers["content-disposition"] == (
        'attachment; filename="nora-analytics_2026-11-01_to_2026-11-07.csv"'
    )


def test_export_has_every_section_in_order(admin, week):
    assert list(sections(export(admin).text)) == [
        "Summary",
        "Top topics",
        "Top documents viewed",
        "Most cited documents",
        "Top search terms",
        "Zero-result search terms",
        "Most asked questions",
        "Questions by outcome",
        "Referrals by office",
        "Daily activity",
        "Daily questions by topic",
    ]


def test_export_matches_the_json(admin, week):
    body = get(admin)
    csv_sections = sections(export(admin).text)

    summary = dict(csv_sections["Summary"][1:])
    assert summary == {
        "from": "2026-11-01",
        "to": "2026-11-07",
        "min_distinct_users": "2",
        "active_users": str(body["activity"]["active_users"]),
        "logins": str(body["activity"]["logins"]),
        "topic_views": "4",
        "document_views": "4",
        "searches": "7",
        "questions": "5",
        "feedback_rated": "3",
        "feedback_helpful": "2",
        "feedback_helpful_share": "0.667",
    }
    assert csv_sections["Top topics"] == [
        ["topic_slug", "topic_name", "views"],
        ["human-subjects-research", "Human Subjects Research", "3"],
        ["export-controls", "Export Controls", "1"],
    ]
    assert csv_sections["Top documents viewed"][1:] == [
        [str(week["a"].id), "A Policy", "2"],
        [str(week["b"].id), "B Policy", "2"],
    ]
    assert csv_sections["Most cited documents"][0] == ["document_id", "title", "citations"]
    assert csv_sections["Top search terms"][1:] == [["irb", "2"], ["nothing here", "2"]]
    assert csv_sections["Zero-result search terms"][1:] == [["nothing here", "2"]]
    assert csv_sections["Most asked questions"] == [
        ["question", "times_asked"],
        ["do i need irb?", "2"],
    ]
    assert csv_sections["Questions by outcome"][1:] == [
        ["answered", "2"],
        ["referred", "1"],
        ["no_answer", "1"],
        ["error", "1"],
    ]
    assert csv_sections["Referrals by office"][1:] == [
        ["Office of Human Research Ethics", "2"],
        ["Office of Sponsored Programs", "1"],
    ]
    daily = csv_sections["Daily activity"]
    assert daily[0] == ["date", "logins", "topic_views", "document_views", "searches", "questions"]
    assert daily[1] == ["2026-11-01", "2", "2", "0", "0", "1"]
    assert len(daily) == 1 + 7
    assert csv_sections["Daily questions by topic"][1:] == [
        ["2026-11-01", "human-subjects-research", "Human Subjects Research", "1"],
        ["2026-11-02", "human-subjects-research", "Human Subjects Research", "1"],
        ["2026-11-02", "", "", "1"],
        ["2026-11-03", "export-controls", "Export Controls", "1"],
        ["2026-11-03", "", "", "1"],
    ]


def test_export_of_an_empty_range_keeps_every_header(admin):
    csv_sections = sections(export(admin, **{"from": "2025-01-01", "to": "2025-01-01"}).text)

    assert dict(csv_sections["Summary"][1:])["feedback_helpful_share"] == ""
    assert csv_sections["Top topics"] == [["topic_slug", "topic_name", "views"]]
    assert csv_sections["Daily questions by topic"] == [
        ["date", "topic_slug", "topic_name", "questions"]
    ]


@pytest.mark.parametrize("term", ["=HYPERLINK(1)", "+1", "-1", "@SUM(A1)", "\tx", "\rx"])
def test_export_neutralizes_formulas_in_free_text(admin, make_user, log, term):
    for user in [make_user("one"), make_user("two")]:
        log(user, EventType.SEARCH, at(1), query=term, result_count=1)

    rows = sections(export(admin).text)["Top search terms"][1:]

    assert rows == [["'" + term, "2"]]


def test_export_uses_the_same_rules_and_access(admin):
    assert (
        admin.get(
            "/api/admin/analytics/export.csv", params={"from": "2026-11-07", "to": "2026-11-01"}
        ).status_code
        == 422
    )
    admin.post("/api/auth/logout")
    assert admin.get("/api/admin/analytics/export.csv").status_code == 401
    login(admin, "researcher-only")
    assert admin.get("/api/admin/analytics/export.csv").status_code == 403


def test_export_has_no_user_identity(admin, week):
    text = export(admin).text

    for onyen in ["alice", "bob", "carol", "boss"]:
        assert onyen not in text

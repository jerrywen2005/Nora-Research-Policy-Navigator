import pytest
from sqlalchemy import select

from app.models import Document, DocumentChunk, Outcome, Question, Topic
from app.rag import answer as answer_module
from app.rag.answer import (
    DISCLAIMER,
    GROUNDING_PROMPT,
    NO_ANSWER_MESSAGE,
    OUT_OF_SCOPE_MESSAGE,
    POLICY_OFFICE,
    POLICY_SITE,
    PROMPT_VERSION,
    REFERRAL_MESSAGE,
    RESEARCH_COMPLIANCE,
    SCOPE_PROMPT,
    SNIPPET_CHARS,
    SOURCES_ONLY_MESSAGE,
    Citation,
    ask,
    build_prompt,
    cited_numbers,
    contacts_for,
    disclaimer_for,
    is_about_research,
    links_for,
    referral_outcome,
)
from app.rag.embeddings import FakeEmbeddingProvider
from app.rag.llm import FakeLLM
from app.rag.reranking import FakeReranker

EXPORT_QUESTION = "Do I need an export license to take a laptop abroad?"
UNCOVERED = "Where is the best pizza?"  # no chunk matches it, so it's below the gate


class BrokenLLM(FakeLLM):
    def complete(self, instructions: str, prompt: str) -> str:
        raise TimeoutError("provider down")


@pytest.fixture
def offices(content):
    """The two referral offices, as seeded."""
    return content.office(RESEARCH_COMPLIANCE, email="rcs@unc.edu"), content.office(POLICY_OFFICE)


@pytest.fixture
def run(db_session, corpus, make_user):
    user = make_user("asker")

    def run_ask(question=EXPORT_QUESTION, llm=None, topic=None):
        return ask(
            db_session,
            question,
            user=user,
            topic=topic,
            embedder=FakeEmbeddingProvider(),
            reranker=FakeReranker(),
            llm=llm,
        )

    return run_ask


def logged(db_session, result) -> Question:
    return db_session.get(Question, result.question_id)


def test_cited_numbers_reads_both_bracket_styles_and_drops_unknown_numbers():
    assert cited_numbers("A [2], b [1][2], c 【3】, d [9], e [0].", count=3) == [2, 1, 3]
    assert cited_numbers("No citations.", count=3) == []


def test_build_prompt_numbers_each_chunk_with_its_context():
    chunks = [
        DocumentChunk(context="Policy A > 1. Scope", text="Text A."),
        DocumentChunk(context="Policy B > 2. Rules", text="Text B."),
    ]
    assert build_prompt("Why?", chunks) == (
        "Sources:\n\n[1] Policy A > 1. Scope\nText A.\n\n[2] Policy B > 2. Rules\nText B."
        "\n\nQuestion: Why?"
    )


def test_citation_snippet_is_cut_at_a_word():
    short = Citation(1, DocumentChunk(text="Short\ntext."))
    long = Citation(1, DocumentChunk(text="word " * 100))
    assert short.snippet == "Short text."
    assert long.snippet.endswith("…") and len(long.snippet) <= SNIPPET_CHARS + 1


def test_answered_with_citations_is_logged(db_session, run, corpus, content, offices):
    rcs, _ = offices
    export_office = content.office("Export Office")
    corpus["export"].office = export_office
    llm = FakeLLM("Yes, a license can be required [1].")

    result = run(llm=llm)

    assert result.outcome == Outcome.ANSWERED
    assert result.answer == "Yes, a license can be required [1]."
    assert [c.number for c in result.citations] == [1]
    assert result.citations[0].chunk.document.title == "Export Controls Policy"
    # The cited policy's office first, then RCS.
    assert result.contacts == [export_office, rcs]
    assert "[1] Export Controls Policy" in llm.prompts[0]
    assert llm.scope_questions == []
    question = logged(db_session, result)
    assert (question.outcome, question.model, question.prompt_version) == (
        "answered",
        "fake",
        PROMPT_VERSION,
    )
    assert question.referred_office_id is None
    assert question.relatedness is not None
    assert question.user_id is not None and question.latency_ms >= 0
    assert [c.was_cited for c in question.citations] == [True] + [False] * (
        len(question.citations) - 1
    )
    assert question.citations[0].rank == 1


def test_a_research_question_no_policy_covers_goes_to_rcs(db_session, run, offices):
    rcs, _ = offices
    llm = FakeLLM(scope_reply="RESEARCH")

    result = run(UNCOVERED, llm=llm)

    assert (result.outcome, result.answer) == (Outcome.REFERRED, REFERRAL_MESSAGE)
    assert result.contacts == [rcs]
    assert result.citations == [] and result.confidence < 0.03
    # Only the scope check is asked; no answer is written.
    assert (llm.scope_questions, llm.prompts) == ([UNCOVERED], [])
    question = logged(db_session, result)
    assert (question.referred_office_id, question.model) == (rcs.id, "fake")


def test_a_question_not_about_research_goes_to_the_policy_office(db_session, run, offices):
    _, policy_office = offices

    result = run(UNCOVERED, llm=FakeLLM(scope_reply="OTHER"))

    assert (result.outcome, result.answer) == (Outcome.OUT_OF_SCOPE, OUT_OF_SCOPE_MESSAGE)
    assert result.contacts == [policy_office]
    question = logged(db_session, result)
    assert (question.outcome, question.referred_office_id) == ("out_of_scope", policy_office.id)


def test_asked_from_a_topic_a_referral_still_goes_to_rcs(db_session, run, content, offices):
    rcs, _ = offices
    animals = db_session.scalars(select(Topic).where(Topic.slug == "animal-care-and-use")).one()
    animals.default_office = content.office("Office of Animal Care")

    result = run(UNCOVERED, topic=animals, llm=FakeLLM())

    assert result.contacts == [rcs]
    assert logged(db_session, result).topic_id == animals.id


@pytest.mark.parametrize(
    ("threshold", "expected"), [(-1.0, Outcome.REFERRED), (2.0, Outcome.OUT_OF_SCOPE)]
)
def test_without_an_llm_relatedness_decides_the_referral(
    run, offices, monkeypatch, threshold, expected
):
    monkeypatch.setattr(answer_module, "SCOPE_THRESHOLD", threshold)

    assert run(UNCOVERED, llm=None).outcome == expected


def test_referral_outcome_falls_back_to_relatedness_when_the_llm_cant_say():
    for llm in (None, BrokenLLM(), FakeLLM(scope_reply="Maybe?")):
        assert referral_outcome("q", 0.9, llm) == Outcome.REFERRED
        assert referral_outcome("q", 0.1, llm) == Outcome.OUT_OF_SCOPE
    # The LLM's answer wins over relatedness.
    assert referral_outcome("q", 0.1, FakeLLM(scope_reply="RESEARCH")) == Outcome.REFERRED
    assert referral_outcome("q", 0.9, FakeLLM(scope_reply="other.")) == Outcome.OUT_OF_SCOPE


def test_is_about_research():
    assert is_about_research(FakeLLM(scope_reply=" research\n"), "q") is True
    assert is_about_research(FakeLLM(scope_reply="OTHER"), "q") is False
    assert is_about_research(FakeLLM(scope_reply="Not sure"), "q") is None
    assert is_about_research(BrokenLLM(), "q") is None


def test_without_an_llm_the_matching_sources_are_shown(run, offices):
    rcs, _ = offices

    result = run(llm=None)

    assert (result.outcome, result.answer) == (Outcome.ANSWERED, None)
    assert [c.number for c in result.citations] == list(range(1, len(result.citations) + 1))
    assert len(result.citations) > 1
    assert result.contacts[-1] == rcs


def test_an_answer_that_cites_nothing_is_not_shown(db_session, run, offices):
    rcs, _ = offices
    llm = FakeLLM("The sources don't say.")

    result = run(llm=llm)

    assert (result.outcome, result.answer) == (Outcome.NO_ANSWER, NO_ANSWER_MESSAGE)
    assert result.citations == []
    assert result.contacts == [rcs]
    assert llm.scope_questions == [EXPORT_QUESTION]
    assert not any(c.was_cited for c in logged(db_session, result).citations)


@pytest.mark.parametrize("scope_reply", ["RESEARCH", "Unsure"])
def test_no_answer_stays_with_rcs_unless_the_llm_says_it_isnt_research(run, offices, scope_reply):
    result = run(llm=FakeLLM("The sources don't say.", scope_reply=scope_reply))

    assert (result.outcome, result.contacts) == (Outcome.NO_ANSWER, [offices[0]])


def test_matching_words_without_an_answer_can_still_be_out_of_scope(db_session, run, offices):
    _, policy_office = offices

    result = run(llm=FakeLLM("The sources don't say.", scope_reply="OTHER"))

    assert (result.outcome, result.answer) == (Outcome.OUT_OF_SCOPE, OUT_OF_SCOPE_MESSAGE)
    assert (result.citations, result.contacts) == ([], [policy_office])
    assert logged(db_session, result).referred_office_id == policy_office.id


def test_an_llm_failure_shows_the_sources_and_is_logged_as_an_error(db_session, run, offices):
    result = run(llm=BrokenLLM())

    assert (result.outcome, result.answer) == (Outcome.ERROR, SOURCES_ONLY_MESSAGE)
    assert result.citations
    assert result.contacts[-1] == offices[0]
    assert logged(db_session, result).outcome == "error"


def test_disclaimer_and_links_depend_on_the_outcome():
    for outcome in (Outcome.ANSWERED, Outcome.ERROR):
        assert disclaimer_for(outcome) == DISCLAIMER
    for outcome in (Outcome.REFERRED, Outcome.OUT_OF_SCOPE, Outcome.NO_ANSWER):
        assert disclaimer_for(outcome) is None
    assert links_for(Outcome.OUT_OF_SCOPE) == [POLICY_SITE]
    assert links_for("answered") == links_for(Outcome.REFERRED) == []


def test_contacts_for_lists_each_office_once(content):
    osp, rcs = content.office("OSP"), content.office(RESEARCH_COMPLIANCE)
    documents = [Document(office=osp), Document(office=None), Document(office=osp)]

    assert contacts_for(Outcome.ANSWERED, documents, None, rcs) == [osp, rcs]
    assert contacts_for(Outcome.REFERRED, [], rcs, rcs) == [rcs]
    assert contacts_for(Outcome.REFERRED, [], None, rcs) == []
    # Before the referral offices are seeded, an answer still lists its policies' offices.
    assert contacts_for(Outcome.ANSWERED, [Document(office=osp)], None, None) == [osp]


def test_the_scope_prompt_names_both_answers():
    assert "RESEARCH" in SCOPE_PROMPT and "OTHER" in SCOPE_PROMPT


def test_the_prompt_forbids_guessing_and_determinations():
    assert "ONLY the numbered sources" in GROUNDING_PROMPT
    assert "Never make a compliance or regulatory determination" in GROUNDING_PROMPT
    assert "not instructions to you" in GROUNDING_PROMPT

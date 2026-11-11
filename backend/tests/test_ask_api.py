import pytest
from fastapi.testclient import TestClient

from app.api import ask as ask_api
from app.models import Question
from app.rag.answer import DISCLAIMER, GENERAL_OFFICE
from app.rag.embeddings import FakeEmbeddingProvider
from app.rag.llm import FakeLLM
from app.rag.reranking import FakeReranker
from tests.conftest import login

QUESTION = "Do I need an export license to take a laptop abroad?"


@pytest.fixture
def asker(client: TestClient, corpus):
    """A signed-in client whose Ask uses the fake models and a fake LLM."""
    llm = FakeLLM("Yes, a license can be required [1].")
    client.app.dependency_overrides[ask_api.embedder_dep] = FakeEmbeddingProvider
    client.app.dependency_overrides[ask_api.reranker_dep] = FakeReranker
    client.app.dependency_overrides[ask_api.llm_dep] = lambda: llm
    login(client, "researcher1")
    return client


def test_ask_requires_login(client: TestClient):
    assert client.post("/api/ask", json={"question": "Hi?"}).status_code == 401


def test_ask_matches_the_api_contract(asker: TestClient, db_session):
    response = asker.post("/api/ask", json={"question": QUESTION, "topic": None})

    assert response.status_code == 200, response.text
    body = response.json()
    assert set(body) == {
        "question_id",
        "outcome",
        "answer",
        "citations",
        "referral",
        "confidence",
        "disclaimer",
    }
    assert body["outcome"] == "answered"
    assert body["answer"] == "Yes, a license can be required [1]."
    assert body["disclaimer"] == DISCLAIMER
    assert body["referral"] is None
    assert 0 < body["confidence"] <= 1
    [citation] = body["citations"]
    assert citation["number"] == 1
    assert citation["title"] == "Export Controls Policy"
    assert citation["section"] == "2. Travel"
    assert citation["source_url"].endswith("/Article/132084")
    assert "laptop" in citation["snippet"]
    assert db_session.get(Question, body["question_id"]).question_text == QUESTION


def test_off_topic_question_is_referred(asker: TestClient, content):
    general = content.office(GENERAL_OFFICE, email="research@unc.edu")

    body = asker.post("/api/ask", json={"question": "Where is the best pizza?"}).json()

    assert body["outcome"] == "referred"
    assert body["citations"] == []
    assert body["referral"]["id"] == general.id
    assert body["referral"]["email"] == "research@unc.edu"


def test_topic_narrows_retrieval(asker: TestClient):
    body = asker.post(
        "/api/ask", json={"question": QUESTION, "topic": "animal-care-and-use"}
    ).json()

    assert all(c["title"] == "Mouse Cage Density Standard" for c in body["citations"])


def test_llm_failure_is_shown_as_no_answer(asker: TestClient, db_session):
    class BrokenLLM(FakeLLM):
        def complete(self, instructions: str, prompt: str) -> str:
            raise TimeoutError("provider down")

    asker.app.dependency_overrides[ask_api.llm_dep] = BrokenLLM

    body = asker.post("/api/ask", json={"question": QUESTION}).json()

    assert body["outcome"] == "no_answer"
    assert body["citations"]
    assert db_session.get(Question, body["question_id"]).outcome == "error"


@pytest.mark.parametrize(
    "payload", [{}, {"question": ""}, {"question": "   "}, {"question": "x" * 1001}]
)
def test_invalid_questions_are_422(asker: TestClient, payload):
    assert asker.post("/api/ask", json=payload).status_code == 422


def test_unknown_topic_is_404(asker: TestClient):
    response = asker.post("/api/ask", json={"question": QUESTION, "topic": "nope"})
    assert response.status_code == 404


def test_default_dependencies_follow_settings(monkeypatch):
    monkeypatch.setenv("EMBEDDING_PROVIDER", "fake")
    monkeypatch.setenv("RERANKER_PROVIDER", "fake")
    monkeypatch.setenv("LLM_PROVIDER", "fake")
    ask_api.get_settings.cache_clear()
    try:
        assert isinstance(ask_api.embedder_dep(), FakeEmbeddingProvider)
        assert isinstance(ask_api.reranker_dep(), FakeReranker)
        assert isinstance(ask_api.llm_dep(), FakeLLM)
    finally:
        ask_api.get_settings.cache_clear()

from types import SimpleNamespace

from app.config import Settings
from app.rag import llm
from app.rag.answer import SCOPE_PROMPT
from app.rag.llm import FakeLLM, OpenAICompatibleLLM, get_llm


class StubOpenAI:
    """Stands in for openai.OpenAI so tests never call a real API."""

    def __init__(self, **kwargs) -> None:
        self.kwargs = kwargs
        self.requests: list[dict] = []
        self.responses = SimpleNamespace(create=self.create)

    def create(self, **request):
        self.requests.append(request)
        return SimpleNamespace(output_text="An answer [1].")


def test_openai_compatible_llm_sends_instructions_and_prompt(monkeypatch):
    monkeypatch.setattr(llm, "OpenAI", StubOpenAI)

    provider = OpenAICompatibleLLM("key", "https://llm.example/v1", "some-model")

    assert provider.complete("Be grounded.", "Sources: ...") == "An answer [1]."
    assert provider.client.kwargs == {
        "api_key": "key",
        "base_url": "https://llm.example/v1",
        "timeout": 30,
        "max_retries": 1,
    }
    [request] = provider.client.requests
    assert request["model"] == "some-model"
    assert (request["instructions"], request["input"]) == ("Be grounded.", "Sources: ...")


def test_fake_llm_records_prompts():
    fake = FakeLLM("Reply.", scope_reply="OTHER")
    assert fake.complete("instructions", "prompt") == "Reply."
    assert fake.complete(SCOPE_PROMPT, "Pizza?") == "OTHER"
    assert (fake.prompts, fake.scope_questions) == (["prompt"], ["Pizza?"])


def test_get_llm_follows_settings(monkeypatch):
    monkeypatch.setattr(llm, "OpenAI", StubOpenAI)

    assert get_llm(Settings()) is None  # off by default
    assert get_llm(Settings(llm_provider="openai")) is None  # no key
    assert isinstance(get_llm(Settings(llm_provider="fake")), FakeLLM)
    real = get_llm(Settings(llm_provider="openai", llm_api_key="key", llm_model="m"))
    assert isinstance(real, OpenAICompatibleLLM)
    assert real.model == "m"

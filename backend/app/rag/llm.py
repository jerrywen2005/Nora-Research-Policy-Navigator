"""The LLM that writes answers from retrieved chunks. Design: docs/rag.md, "Interfaces".

UNC hasn't approved an LLM provider yet, so the app depends only on `LLMProvider`. The one real
implementation speaks the OpenAI API, which most providers (Groq, OpenAI, Azure OpenAI, local
servers) accept, so switching is a configuration change. With no provider configured, Ask
still retrieves and shows the matching sources, just without a written answer.
"""

from typing import Protocol

from openai import OpenAI

from app.config import Settings


class LLMProvider(Protocol):
    model: str

    def complete(self, instructions: str, prompt: str) -> str: ...


class OpenAICompatibleLLM:
    def __init__(self, api_key: str, base_url: str, model: str) -> None:
        self.model = model
        # One retry, then the caller falls back to showing sources: a researcher shouldn't wait
        # through several timeouts.
        self.client = OpenAI(api_key=api_key, base_url=base_url, timeout=30, max_retries=1)

    def complete(self, instructions: str, prompt: str) -> str:
        response = self.client.responses.create(
            model=self.model, instructions=instructions, input=prompt, temperature=0.1
        )
        return response.output_text


class FakeLLM:
    """A stand-in for tests: always gives the same answer, and the same reply to the scope check
    ("is this about research?")."""

    model = "fake"

    def __init__(self, reply: str = "Yes, this is covered [1].", scope_reply: str = "RESEARCH"):
        self.reply = reply
        self.scope_reply = scope_reply
        self.prompts: list[str] = []  # answer prompts
        self.scope_questions: list[str] = []

    def complete(self, instructions: str, prompt: str) -> str:
        from app.rag.answer import SCOPE_PROMPT  # app.rag.answer imports this module

        if instructions == SCOPE_PROMPT:
            self.scope_questions.append(prompt)
            return self.scope_reply
        self.prompts.append(prompt)
        return self.reply


def get_llm(settings: Settings) -> LLMProvider | None:
    """The configured LLM, or None when there's none (no key, or LLM_PROVIDER=none)."""
    if settings.llm_provider == "fake":
        return FakeLLM()
    if settings.llm_provider == "openai" and settings.llm_api_key:
        return OpenAICompatibleLLM(settings.llm_api_key, settings.llm_base_url, settings.llm_model)
    return None

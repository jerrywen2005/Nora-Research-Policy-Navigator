"""Rescore retrieved chunks by reading the question and each chunk together (a cross-encoder).

More accurate than comparing separate embeddings, and its score means "how relevant", which the
confidence gate needs; too slow to run on every chunk, so it only reads the top candidates.
Like embeddings, it runs locally through fastembed; tests use `FakeReranker`.
"""

import math
import re
from functools import lru_cache
from typing import Protocol

from fastembed.rerank.cross_encoder import TextCrossEncoder

from app.config import Settings

# Chosen over the smaller ms-marco-MiniLM-L-6-v2 in the tutorial's evaluation: it ranked better,
# and its scores separate off-topic questions from real ones (docs/rag.md, "Models").
RERANK_MODEL = "BAAI/bge-reranker-base"


class Reranker(Protocol):
    def score(self, question: str, texts: list[str]) -> list[float]:
        """One relevance score per text, from 0 (unrelated) to 1 (answers the question)."""
        ...


def sigmoid(x: float) -> float:
    return 1 / (1 + math.exp(-x))


class FastEmbedReranker:
    """bge-reranker-base on the CPU. The model (about 1 GB) downloads on first use."""

    def __init__(self, cache_dir: str) -> None:
        self.cache_dir = cache_dir
        self._model: TextCrossEncoder | None = None

    @property
    def model(self) -> TextCrossEncoder:
        if self._model is None:
            self._model = TextCrossEncoder(RERANK_MODEL, cache_dir=self.cache_dir)
        return self._model

    def score(self, question: str, texts: list[str]) -> list[float]:
        # The model returns raw scores (logits); the sigmoid maps them to 0–1.
        return [sigmoid(float(logit)) for logit in self.model.rerank(question, texts)]


def content_words(text: str) -> set[str]:
    """Words of four or more letters, so "the" and "is" don't count as overlap."""
    return set(re.findall(r"[a-z0-9]{4,}", text.lower()))


class FakeReranker:
    """A stand-in for tests: the share of the question's content words found in the text."""

    def score(self, question: str, texts: list[str]) -> list[float]:
        words = content_words(question)
        return [len(words & content_words(text)) / len(words) if words else 0 for text in texts]


@lru_cache
def _fastembed(cache_dir: str) -> FastEmbedReranker:
    return FastEmbedReranker(cache_dir)


def get_reranker(settings: Settings) -> Reranker:
    """The reranker the settings choose. The real model is loaded once per process."""
    if settings.reranker_provider == "fake":
        return FakeReranker()
    return _fastembed(settings.model_cache_dir)

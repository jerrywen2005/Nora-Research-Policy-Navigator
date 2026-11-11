"""Turn text into vectors. Design: docs/rag.md, "Models" and "Interfaces".

The app depends only on `EmbeddingProvider`. The real provider runs BAAI/bge-small-en-v1.5 locally
through fastembed (ONNX Runtime, no PyTorch), so no policy text or question leaves the server.
Tests use `FakeEmbeddingProvider`, which needs no model download.
"""

import hashlib
import math
import re
from functools import lru_cache
from typing import Protocol

from fastembed import TextEmbedding

from app.config import Settings
from app.models import EMBEDDING_DIMENSIONS

EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"
# bge models are trained to find passages for a query that starts with this instruction.
# Passages (chunks) are embedded without it.
QUERY_PREFIX = "Represent this sentence for searching relevant passages: "


class EmbeddingProvider(Protocol):
    def embed_documents(self, texts: list[str]) -> list[list[float]]: ...

    def embed_query(self, text: str) -> list[float]: ...


def normalize(vector: list[float]) -> list[float]:
    """Scale to length 1, so cosine similarity is a dot product. A zero vector stays zero."""
    length = math.sqrt(sum(x * x for x in vector))
    return [x / length for x in vector] if length else vector


class FastEmbedProvider:
    """bge-small-en-v1.5 on the CPU. The model (about 130 MB) downloads on first use."""

    def __init__(self, cache_dir: str) -> None:
        self.cache_dir = cache_dir
        self._model: TextEmbedding | None = None

    @property
    def model(self) -> TextEmbedding:
        if self._model is None:
            self._model = TextEmbedding(EMBEDDING_MODEL, cache_dir=self.cache_dir)
        return self._model

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [normalize(vector.tolist()) for vector in self.model.embed(texts)]

    def embed_query(self, text: str) -> list[float]:
        return self.embed_documents([QUERY_PREFIX + text])[0]


class FakeEmbeddingProvider:
    """A deterministic stand-in for tests: each word adds 1 to one of the vector's slots.

    Texts that share words get similar vectors, so retrieval tests behave sensibly, but it knows
    nothing about meaning ("benefits" and "insurance" are unrelated to it).
    """

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self.embed_query(text) for text in texts]

    def embed_query(self, text: str) -> list[float]:
        vector = [0.0] * EMBEDDING_DIMENSIONS
        for word in re.findall(r"[a-z0-9]+", text.lower()):
            slot = int.from_bytes(hashlib.sha256(word.encode()).digest()[:4], "big")
            vector[slot % EMBEDDING_DIMENSIONS] += 1.0
        return normalize(vector)


@lru_cache
def _fastembed(cache_dir: str) -> FastEmbedProvider:
    return FastEmbedProvider(cache_dir)


def get_embedding_provider(settings: Settings) -> EmbeddingProvider:
    """The provider the settings choose. The real model is loaded once per process."""
    if settings.embedding_provider == "fake":
        return FakeEmbeddingProvider()
    return _fastembed(settings.model_cache_dir)

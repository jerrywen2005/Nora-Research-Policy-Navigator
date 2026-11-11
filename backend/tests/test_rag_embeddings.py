import numpy as np
import pytest

from app.config import Settings
from app.models import EMBEDDING_DIMENSIONS
from app.rag import embeddings
from app.rag.embeddings import (
    QUERY_PREFIX,
    FakeEmbeddingProvider,
    FastEmbedProvider,
    get_embedding_provider,
    normalize,
)


def cosine(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b, strict=True))


def test_normalize():
    assert normalize([3.0, 4.0]) == [0.6, 0.8]
    assert normalize([0.0, 0.0]) == [0.0, 0.0]


def test_fake_provider_is_deterministic_and_rewards_shared_words():
    fake = FakeEmbeddingProvider()
    query = fake.embed_query("export controls for lab equipment")
    related, unrelated = fake.embed_documents(["Export Controls Policy", "Rodent cage density"])

    assert len(query) == EMBEDDING_DIMENSIONS
    assert query == fake.embed_query("export controls for lab equipment")
    assert cosine(query, related) > cosine(query, unrelated)


class StubTextEmbedding:
    """Stands in for fastembed.TextEmbedding so tests never download the model."""

    instances: list["StubTextEmbedding"] = []

    def __init__(self, model_name: str, cache_dir: str) -> None:
        self.model_name, self.cache_dir, self.seen = model_name, cache_dir, []
        StubTextEmbedding.instances.append(self)

    def embed(self, texts: list[str]):
        self.seen.extend(texts)
        return [np.array([3.0, 4.0]) for _ in texts]


@pytest.fixture
def stub_model(monkeypatch):
    StubTextEmbedding.instances = []
    monkeypatch.setattr(embeddings, "TextEmbedding", StubTextEmbedding)
    return StubTextEmbedding


def test_fastembed_provider_loads_once_prefixes_queries_and_normalizes(stub_model):
    provider = FastEmbedProvider("/tmp/models")

    assert provider.embed_documents(["a chunk"]) == [[0.6, 0.8]]
    assert provider.embed_query("a question") == [0.6, 0.8]

    [model] = stub_model.instances
    assert (model.model_name, model.cache_dir) == ("BAAI/bge-small-en-v1.5", "/tmp/models")
    assert model.seen == ["a chunk", QUERY_PREFIX + "a question"]


def test_get_embedding_provider_follows_settings_and_reuses_the_model(stub_model):
    embeddings._fastembed.cache_clear()

    assert isinstance(
        get_embedding_provider(Settings(embedding_provider="fake")), FakeEmbeddingProvider
    )
    real = get_embedding_provider(Settings(embedding_provider="fastembed", model_cache_dir="/m"))
    assert isinstance(real, FastEmbedProvider)
    assert get_embedding_provider(Settings(model_cache_dir="/m")) is real
    embeddings._fastembed.cache_clear()

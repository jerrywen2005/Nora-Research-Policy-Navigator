import pytest

from app.config import Settings
from app.rag import reranking
from app.rag.reranking import FakeReranker, FastEmbedReranker, get_reranker, sigmoid


def test_sigmoid_maps_logits_to_zero_one():
    assert sigmoid(0) == 0.5
    assert sigmoid(10) > 0.99
    assert sigmoid(-10) < 0.01


def test_fake_reranker_scores_word_overlap():
    assert FakeReranker().score("export laptop", ["Export rules", "laptop export", "pizza"]) == [
        0.5,
        1.0,
        0.0,
    ]
    assert FakeReranker().score("?", ["anything"]) == [0]


class StubCrossEncoder:
    instances: list["StubCrossEncoder"] = []

    def __init__(self, model_name: str, cache_dir: str) -> None:
        self.model_name, self.cache_dir = model_name, cache_dir
        StubCrossEncoder.instances.append(self)

    def rerank(self, question: str, texts: list[str]):
        return [0.0 for _ in texts]


@pytest.fixture
def stub_model(monkeypatch):
    StubCrossEncoder.instances = []
    monkeypatch.setattr(reranking, "TextCrossEncoder", StubCrossEncoder)
    return StubCrossEncoder


def test_fastembed_reranker_loads_once_and_applies_sigmoid(stub_model):
    reranker = FastEmbedReranker("/tmp/models")

    assert reranker.score("q", ["a", "b"]) == [0.5, 0.5]
    assert reranker.score("q", ["c"]) == [0.5]
    [model] = stub_model.instances
    assert (model.model_name, model.cache_dir) == ("BAAI/bge-reranker-base", "/tmp/models")


def test_get_reranker_follows_settings_and_reuses_the_model(stub_model):
    reranking._fastembed.cache_clear()

    assert isinstance(get_reranker(Settings(reranker_provider="fake")), FakeReranker)
    real = get_reranker(Settings(reranker_provider="fastembed", model_cache_dir="/m"))
    assert isinstance(real, FastEmbedReranker)
    assert get_reranker(Settings(model_cache_dir="/m")) is real
    reranking._fastembed.cache_clear()

from app.rag.embeddings import FakeEmbeddingProvider
from app.rag.evaluate import article_id, check_gate, evaluate, load_questions
from app.rag.reranking import FakeReranker
from app.seed.content import load_seed_documents


def test_eval_questions_point_at_real_inventory_articles():
    articles = {d["article_id"] for d in load_seed_documents()}
    questions = load_questions()

    assert len(questions) >= 20
    for item in questions:
        assert item["question"].strip()
        assert item["expected_articles"] is None or set(item["expected_articles"]) <= articles
    assert any(item["expected_articles"] is None for item in questions)


def test_article_id():
    assert article_id("https://policies.unc.edu/TDClient/2833/Portal/KB/Article/132084/x") == 132084
    assert article_id("https://example.org/page") is None
    assert article_id(None) is None


def test_evaluate_counts_hits_per_method_and_records_gate_scores(db_session, corpus):
    questions = [
        {
            "question": "Do I need an export license for a laptop abroad?",
            "expected_articles": [132084],
        },
        {"question": "What is the mouse cage density limit?", "expected_articles": [999]},
        {"question": "Where is the best pizza?", "expected_articles": None},
    ]

    result = evaluate(db_session, FakeEmbeddingProvider(), FakeReranker(), questions)

    assert (result.answerable, result.unanswerable) == (2, 1)
    assert result.retrieval == {mode: [1, 1] for mode in ("dense", "keyword", "hybrid", "rerank")}
    assert [(q[:9], answerable) for q, answerable, _ in result.best_scores] == [
        ("Do I need", True),
        ("What is t", True),
        ("Where is ", False),
    ]
    assert result.best_scores[2][2] < result.best_scores[0][2]


def test_check_gate():
    scores = [("good", True, 0.9), ("weak", True, 0.01), ("pizza", False, 0.02), ("x", False, 0.5)]

    gate = check_gate(scores, threshold=0.03)

    assert (gate["answered"], gate["referred"]) == (1, 1)
    assert gate["mistakes"] == [("weak", 0.01, "referred"), ("x", 0.5, "answered")]

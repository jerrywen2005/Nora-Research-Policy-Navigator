"""Measure retrieval and the confidence gate on a fixed question set. Design: docs/rag.md.

Each question in data/eval_questions.json lists the articles that answer it (any one counts), or
null if the policies don't cover it. For each retrieval method we count how often an expected
article is ranked first and how often it's among the top 5 chunks the LLM would see. No LLM is
called, so it's free to run after every retrieval or model change: `python -m app.rag eval`.

The questions are the team's own until the Link sends realistic ones; replace them then.
"""

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

from sqlalchemy.orm import Session

from app.rag.embeddings import EmbeddingProvider
from app.rag.reranking import Reranker
from app.rag.retrieval import MODES, load_chunks, search

QUESTIONS_FILE = Path(__file__).parent / "data" / "eval_questions.json"


def load_questions() -> list[dict]:
    return json.loads(QUESTIONS_FILE.read_text(encoding="utf-8"))


def article_id(source_url: str | None) -> int | None:
    """The knowledge base article ID in a policies.unc.edu link."""
    match = re.search(r"/Article/(\d+)", source_url or "")
    return int(match.group(1)) if match else None


@dataclass
class Evaluation:
    answerable: int = 0
    unanswerable: int = 0
    # mode -> [ranked first, in the top 5], over the answerable questions
    retrieval: dict[str, list[int]] = field(default_factory=lambda: {m: [0, 0] for m in MODES})
    # (question, is it answerable, best reranker score): what the gate decides on
    best_scores: list[tuple[str, bool, float]] = field(default_factory=list)


def evaluate(
    session: Session,
    embedder: EmbeddingProvider,
    reranker: Reranker,
    questions: list[dict] | None = None,
) -> Evaluation:
    result = Evaluation()
    for item in questions if questions is not None else load_questions():
        question, expected = item["question"], item["expected_articles"]
        if expected is None:
            result.unanswerable += 1
        else:
            result.answerable += 1
        for mode in MODES:
            hits = search(session, question, mode, embedder, reranker)
            if mode == "rerank":
                best = hits[0].score if hits else 0.0
                result.best_scores.append((question, expected is not None, best))
            if expected is None:
                continue
            articles = [
                article_id(chunk.document.source_url) for chunk, _ in load_chunks(session, hits)
            ]
            result.retrieval[mode][0] += bool(articles) and articles[0] in expected
            result.retrieval[mode][1] += any(a in expected for a in articles)
    return result


def check_gate(best_scores: list[tuple[str, bool, float]], threshold: float) -> dict:
    """What the gate would do at this threshold: refer when the best score is below it."""
    answered = sum(answerable and best >= threshold for _, answerable, best in best_scores)
    referred = sum(not answerable and best < threshold for _, answerable, best in best_scores)
    mistakes = [
        (question, best, "referred" if answerable else "answered")
        for question, answerable, best in best_scores
        if answerable != (best >= threshold)
    ]
    return {"answered": answered, "referred": referred, "mistakes": mistakes}

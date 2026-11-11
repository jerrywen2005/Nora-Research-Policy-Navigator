"""RAG commands, from backend/:

python -m app.rag                  # chunk and embed every changed document
python -m app.rag eval [--gate X]  # measure retrieval and the confidence gate
"""

import argparse

from app.config import get_settings
from app.db import SessionLocal
from app.rag.embeddings import get_embedding_provider
from app.rag.evaluate import check_gate, evaluate
from app.rag.ingest import ingest_all
from app.rag.reranking import get_reranker
from app.rag.retrieval import GATE_THRESHOLD

parser = argparse.ArgumentParser(prog="python -m app.rag")
parser.add_argument("command", nargs="?", choices=["ingest", "eval"], default="ingest")
parser.add_argument("--gate", type=float, default=GATE_THRESHOLD, help="gate threshold to test")
args = parser.parse_args()
settings = get_settings()

with SessionLocal() as session:
    if args.command == "ingest":
        changed, unchanged = ingest_all(session, get_embedding_provider(settings))
        session.commit()
        print(f"Ingestion done: {changed} documents re-chunked, {unchanged} unchanged.")
    else:
        result = evaluate(session, get_embedding_provider(settings), get_reranker(settings))
        n = result.answerable
        print(f"Retrieval, {n} answerable questions (is an expected article found?)")
        print(f"  {'method':8}  {'top-1':>6}  {'top-5':>6}")
        for mode, (top1, top5) in result.retrieval.items():
            print(f"  {mode:8}  {top1:>3}/{n}  {top5:>3}/{n}")
        gate = check_gate(result.best_scores, args.gate)
        print(f"\nGate at {args.gate} (best reranker score below it = refer, don't answer)")
        print(f"  answerable questions answered:    {gate['answered']}/{n}")
        print(f"  unanswerable questions referred:  {gate['referred']}/{result.unanswerable}")
        for question, best, wrongly in gate["mistakes"]:
            print(f"  {best:.4f}  wrongly {wrongly}: {question}")

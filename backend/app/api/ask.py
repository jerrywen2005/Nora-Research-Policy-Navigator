from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import CurrentUser
from app.config import get_settings
from app.db import get_session
from app.models import Outcome, Topic
from app.rag.answer import ask, disclaimer_for, links_for
from app.rag.embeddings import EmbeddingProvider, get_embedding_provider
from app.rag.llm import LLMProvider, get_llm
from app.rag.reranking import Reranker, get_reranker
from app.schemas.ask import AskRequest, AskResponse, CitationOut, LinkOut
from app.schemas.content import OfficeOut

router = APIRouter(tags=["ask"])

SessionDep = Annotated[Session, Depends(get_session)]


# Separate dependencies so tests can swap in the fakes.
def embedder_dep() -> EmbeddingProvider:
    return get_embedding_provider(get_settings())


def reranker_dep() -> Reranker:
    return get_reranker(get_settings())


def llm_dep() -> LLMProvider | None:
    return get_llm(get_settings())


@router.post("/ask", response_model=AskResponse)
def ask_question(
    body: AskRequest,
    user: CurrentUser,
    session: SessionDep,
    embedder: Annotated[EmbeddingProvider, Depends(embedder_dep)],
    reranker: Annotated[Reranker, Depends(reranker_dep)],
    llm: Annotated[LLMProvider | None, Depends(llm_dep)],
) -> AskResponse:
    """Answer a question from the policies with citations, or refer it to an office.

    A plain `def`: the models and the LLM call block, so FastAPI runs this in its thread pool.
    """
    topic = None
    if body.topic:
        topic = session.scalars(
            select(Topic).where(Topic.slug == body.topic, Topic.is_active)
        ).one_or_none()
        if topic is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Topic not found")

    result = ask(
        session,
        body.question,
        user=user,
        topic=topic,
        embedder=embedder,
        reranker=reranker,
        llm=llm,
    )
    session.commit()
    return AskResponse(
        question_id=result.question_id,
        # The researcher sees an LLM failure like any unanswered question: sources and an
        # office. The log keeps "error" for the dashboard.
        outcome="no_answer" if result.outcome == Outcome.ERROR else result.outcome,
        answer=result.answer,
        citations=[
            CitationOut(
                number=c.number,
                document_id=c.chunk.document_id,
                title=c.chunk.document.title,
                section=c.chunk.section_heading,
                source_url=c.chunk.document.source_url,
                snippet=c.snippet,
            )
            for c in result.citations
        ],
        contacts=[OfficeOut.model_validate(office) for office in result.contacts],
        confidence=round(result.confidence, 4),
        disclaimer=disclaimer_for(result.outcome),
        links=[LinkOut(title=link.title, url=link.url) for link in links_for(result.outcome)],
    )

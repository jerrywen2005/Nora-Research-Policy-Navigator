# Ask pipeline (RAG)

**Status:** Proposed 2026-10-11. Not yet built. The LLM and embedding providers are not chosen yet
(see the open questions in [decisions.md](decisions.md)).

## Ingestion

A script (later, an admin upload) does the following:
1. Takes a source document (PDF, HTML or text) plus metadata: title, type, office, topics, URL,
   citation.
2. Extracts the text and stores the `documents` row.
3. Splits it into chunks of a few hundred tokens, keeping section headings, with some overlap.
4. Embeds the chunks and stores them in `document_chunks`.

Re-ingesting a changed document replaces its chunks. Only `active` + `is_authoritative` documents
are retrieved for answers.

## Answering `POST /api/ask`

1. **Retrieve:** a hybrid search combining pgvector similarity and Postgres full-text search,
   returning the top-k chunks.
2. **Gate:** if the best score is below a threshold, or nothing relevant is found, skip the LLM.
   Return `outcome = no_answer` or `referred`, with the topic's office.
3. **Generate:** the LLM gets the question and the numbered chunks. It must answer only from the
   chunks, cite them by number, say when they don't cover the question, and never make a
   determination. The prompt is versioned (`prompt_version`).
4. **Check:** drop or flag answers that cite nothing, and map the citation numbers back to
   documents.
5. **Respond:** answer, citations (title, section, URL), confidence, outcome, referral office if
   any, and the standard disclaimer.
6. **Log:** write `questions` and `question_citations`.

## Interfaces

`EmbeddingProvider` and `LLMProvider` are small interfaces with real implementations and fake
ones. Tests use the fakes, so tests never call real AI APIs. API keys come from env vars.

## Evaluation

`python -m app.eval <scenarios file>` runs a set of test questions through the pipeline. For each
question it records the outcome, the cited documents and the answer. Each scenario lists the
expected outcome (answer or referral) and the expected source documents. We start with our own
scenarios and replace them with the Link's once they're provided. Run it before and after any
change to the prompt or retrieval.

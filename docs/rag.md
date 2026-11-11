# Ask pipeline (RAG)

**Status:** Design proposed 2026-10-11; build plan proposed 2026-10-27 (Anton), pending Jerry's
review. Not yet built. Owners: **Anton and Jerry**. The LLM and embedding providers are not chosen
yet (see the open questions in [decisions.md](decisions.md)).

The [Plan](#plan-2026-10-27) section says what we're building next and who does what. The
sections after it ([Ingestion](#ingestion) to [Evaluation](#evaluation)) are the target design for
Nora. Record what we actually decide and learn in the [Build log](#build-log).

**Terms used here:**
- **Ingestion:** the one-time preparation step that loads documents, done before anyone asks:
  fetch each policy, extract clean text (keeping headings), split it into chunks, embed each
  chunk, and store chunks and vectors. Re-run only when documents change; answering a question
  only embeds the question and searches what ingestion stored.
- **Chunk:** a section-sized piece of a document; the unit that's retrieved and cited.
- **Embedding:** a vector representing a text's meaning; similar meanings give nearby vectors.
- **Gate:** the checkpoint between retrieval and the LLM. If the best chunk's reranker score is
  below a threshold, the LLM isn't called; Nora says it couldn't find this in the policies and
  refers the user to the responsible office. It enforces "never guess" and makes refusals free.
  The threshold is set from the evaluation set.

## Plan (2026-10-27)

### Why now, and the deadline

The Oct 30 milestone was cancelled, so the next fixed dates are:
- **Mon Nov 2: team tech talk on RAG** (20 minutes including questions). The pipeline we build is
  also the talk's demo.
- **Nov 19: steering group showcase**, where Nora's Ask should give grounded answers on real
  documents.

### Two deliverables, one pipeline

The talk must be tutorial-style: a classmate should be able to rebuild the demo later from our
write-up, at their own pace. Nora can't be that demo, because running it needs Postgres, pgvector,
auth, migrations and our seed data. So we build the same pipeline twice, at two levels:

1. **Tutorial demo (for Nov 2):** a small standalone Python project, about 150 lines or a
   notebook, with no database server. It uses the same public UNC policies, and its README walks
   through each stage step by step. That README is the detailed "not presented" write-up the
   assignment asks for, and the slides link to it.
2. **Nora's production pipeline (for Nov 19):** the same stages built into FastAPI and Postgres,
   following the design below, with fake AI providers in tests, the confidence gate, citation
   checks, logging and the evaluation script. In the talk, this is the "what a real app adds"
   segment.

Priority this week is the tutorial demo. Nora's pipeline follows, reusing what we learn.

### Build stages

Build and commit one stage at a time. Each stage is also a section of the talk, with a short demo
of what changed.

| # | Stage | What it shows in the talk |
|---|---|---|
| 0 | Keyword search (done: `GET /api/documents?q=`) | The baseline: finds documents, can't answer questions |
| 1 | The problem: ask an LLM with no sources | It confidently invents UNC policy. Why RAG exists |
| 2 | Chunking | Splitting policies into retrievable pieces; chunk size trade-offs |
| 3 | Embeddings and vector search | Finding chunks by meaning, not exact words |
| 4 | Hybrid retrieval (BM25 + RRF) | Keyword search catches exact codes; embeddings catch paraphrases |
| 5 | Cross-encoder reranking | Re-scoring the top candidates by reading question and chunk together |
| 6 | Generation with citations | The LLM answers only from numbered chunks and cites them |
| 7 | Confidence gate and refusal | Saying "I don't know, contact this office" instead of guessing |
| 8 | Evaluation | A fixed question set, before/after numbers for each change |

The talk opens with stage 1's failure and ends with stage 8's numbers, showing the improvement.
Run the evaluation after each of stages 3, 4 and 5 so each retrieval step has its own numbers.

### Retrieval design (proposed 2026-10-27)

```
question
 ├─ dense search (cosine on embeddings) → top 20 ┐
 └─ keyword search (BM25)               → top 20 ┴─ RRF merge → top ~20
                                                     → cross-encoder rerank → top 4–5
                                                     → gate on rerank score: too low → refer to office
                                                     → LLM answers from those chunks, with citations
```

- **Dense vs keyword are different kinds of search, not two vector metrics.** Dense retrieval
  compares embeddings and matches meaning ("health insurance" finds "benefits"). Keyword search
  (BM25) scores exact word overlap, weighting rare words, so it reliably finds codes and acronyms
  like "SOP 1101", "FCOI" or "45 CFR 46" that embeddings blur. Our policies are full of these,
  which is why hybrid matters here.
- **The vector metric barely matters.** For normalized embeddings, cosine, dot product and
  Euclidean distance give the same ranking. Use the metric the embedding model was trained for
  (almost always cosine; pgvector's `<=>`). Quality comes from chunking, the embedding model,
  hybrid retrieval and reranking.
- **Merge with Reciprocal Rank Fusion (RRF), not by adding scores.** Cosine and BM25 scores are on
  different scales. RRF combines the two lists by rank: `score = Σ 1 / (60 + rank)`. No tuning
  needed.
- **Rerank with a cross-encoder.** It reads the question and a chunk together, so it's more
  accurate than comparing separate embeddings but too slow for every chunk; run it only on the
  ~20 merged candidates. Small rerankers run locally for free.
- **Gate on the reranker score.** It's a far better "is this relevant?" signal than cosine, so the
  confidence gate (refuse and refer instead of guessing) uses it. The threshold is set from the
  evaluation set.
- **BM25 vs `ts_rank`.** BM25 is a free, published algorithm. Postgres has no built-in BM25;
  `ts_rank` (what search uses today) is close. BM25 can run either in Python (a small library
  scoring chunks in memory; milliseconds at our scale, works anywhere) or inside Postgres through
  an extension, which must be installed on the database server, so on a UNC-managed Postgres it
  depends on what ITS provides (like pgvector). Plan: the tutorial uses a Python BM25 library to
  teach the real algorithm; Nora starts with `ts_rank` (already in the database, no new
  dependency, always in sync) behind a `keyword_search(question, k)` function, and switches to
  Python BM25 only if the evaluation shows a gain. The swap only touches that function: RRF uses
  ranks, not raw scores, and the gate uses the reranker score.
- **Vector storage.** Nora uses pgvector (a project rule, see CLAUDE.md): an HNSW index handles
  far more than our few thousand chunks, chunks sit next to their documents so edits and archiving
  stay in one transaction, retrieval filters (active, authoritative, topic) are plain SQL joins,
  and keyword search is in the same database. A hosted vector database would add sync code, a
  service to run and a privacy question (UNC content and researchers' queries on a third party),
  for no benefit at this scale. The tutorial uses plain NumPy (cosine over a few hundred chunks is
  one line), which shows exactly what vector search is, then points to pgvector as the production
  version.
- **No orchestration framework** (LangChain, LlamaIndex). They hide the steps the talk teaches,
  and our pipeline is small enough to write directly behind our own interfaces, which keeps the
  fake providers for tests simple.
- **Talk examples to capture:** a query where keyword search wins (an exact code), one where
  embeddings win (a paraphrase), and one where reranking fixes the order.

### Pipeline requirements (proposed 2026-10-27)

**Efficiency.** Retrieval is milliseconds at our scale; the LLM call dominates latency and cost.
So: embed chunks once at ingestion (per question, embed only the question); skip the LLM entirely
when the gate fails; send only the top 4–5 chunks; rerank only ~20 candidates; stream the answer;
run query rewriting only when needed (below). Measure latency per stage (`latency_ms` is logged).

**Structure-aware chunking.** Never cut at a fixed size or mid-sentence.
- The policies have real heading tags (`h2`–`h5`, e.g. "2. Procedure" > "2.1 Initial
  Determination…"). Ingestion re-extracts the HTML keeping headings as Markdown. (The seed
  `content_text` flattened them into plain lines, so it can't be chunked reliably as is.)
- Split on sections (h2 → h3 → h4). A section that fits is one chunk.
- Split a long section only at paragraph or list boundaries, around 300–500 tokens, overlapping
  only the boundary paragraph. Keep lists together.
- Prepend a context header to each chunk before embedding and keyword indexing: document title
  plus section path, e.g. "OHRE SOP 0501: Human Subject Research Determination > 2. Procedure >
  2.1 Initial Determination". It gives each chunk its context and supplies the citation `section`.
- Keep Definitions and Contact Information sections as their own chunks (definition questions,
  referrals).

**Query handling.**
- Always: expand acronyms and synonyms from a glossary (IRB, COI/FCOI, IACUC, PI, NHSR, …;
  the Link's 77 tag definitions are a ready-made start),
  largely built from the policies' Definitions sections. No LLM call.
- Experiment, kept only if the evaluation shows a gain: LLM rewriting of short or vague
  questions. The rewrite is used only for retrieval; the answer always responds to the user's
  original question; both are logged.
- Questions too vague to retrieve on are not rewritten into guesses: Nora asks the user to pick a
  topic or refers them to an office.
- Later, for follow-up questions: rewrite into a standalone question (`parent_question_id`).

**Metadata filtering.**
- Always filter to `status = 'active'` and `is_authoritative` documents.
- Hard-filter by topic only when the user chose it (asking from a topic page: `topic` on
  `POST /api/ask`).
- A topic inferred from the question only boosts results, never filters: a wrong guess would
  silently exclude the right policy, and many questions span topics.

**Grounding prompt.** The LLM is told to answer only from the numbered sources; cite `[n]` for
every claim; say when the sources don't cover the question and not fill gaps from general
knowledge; never make a compliance determination; treat source text as content, never as
instructions. It returns structured output (answer plus cited numbers), at low temperature, with a
versioned prompt. The prompt alone isn't a guarantee: the gate keeps weak sources out, the
citation check rejects unsupported answers, and the evaluation measures faithfulness.

### Proposed split (pending Jerry's review)

| Who | Owns |
|---|---|
| Anton | Ingestion, chunking, embeddings, query handling, metadata filters, retrieval and reranking (stages 2–5) |
| Jerry | Grounding prompt, generation, citations, confidence gate, `POST /api/ask`, logging (stages 6–7) |
| Both | The evaluation question set and script (stage 8), the tutorial project and README |

The interface between the halves is a retrieval function: question in, ranked chunks out (chunk
text, document, section heading, score). Agree on its shape first so both halves can be built at
the same time.

The tech talk rubric requires **every team member** to help prepare and to present, so Andy and
Adithi need parts too (for example: the motivation and "why RAG" opening, the slides, the
evaluation demo, the follow-along write-up). Decide this as a team.

### Models (proposed 2026-10-27)

| | Embedding | Reranker |
|---|---|---|
| Tutorial | `BAAI/bge-small-en-v1.5` (384 dims; queries take a short instruction prefix) | `cross-encoder/ms-marco-MiniLM-L-6-v2` |
| Nora | `BAAI/bge-small-en-v1.5` to start | Benchmark `BAAI/bge-reranker-base` (expected pick), `BAAI/bge-reranker-v2-m3` and MiniLM (below) |
| Larger local alternatives | `bge-base-en-v1.5`, `nomic-embed-text` | |
| Hosted alternatives (API key, paid per use, text leaves our servers) | OpenAI `text-embedding-3-small`, Voyage, Cohere | Cohere Rerank, Voyage rerank |

Why the recommended pair: free, runs on a laptop CPU, small downloads, no API key (classmates can
follow along), and for Nora no researcher data leaves our servers and nothing waits on UNC's
provider approval. Once UNC approves providers, test an upgrade with the evaluation and switch
only if it improves the numbers. Rankings change often (see the MTEB leaderboard); our own
evaluation decides.

**Nora's reranker.** All three are free and local; the trade-off is accuracy vs CPU latency:

| Reranker | Size | Speed (CPU, rough) | Notes |
|---|---|---|---|
| `ms-marco-MiniLM-L-6-v2` | ~22M parameters | fastest | good baseline; the tutorial's choice |
| `bge-reranker-base` | ~280M | ~10× slower than MiniLM | noticeably more accurate; the likely sweet spot |
| `bge-reranker-v2-m3` | ~570M | ~2× slower than base | most accurate; its extras (multilingual, long inputs) don't apply to our English, 300–500-token chunks |

Pick by benchmarking all three on the evaluation set, measuring both accuracy (does the right
policy reach the top 4–5?) and latency per question; choose the smallest model close to the best.
If latency is too high, rerank 10–15 candidates instead of 20. Each reranker scores on its own
scale, so **re-tune the gate threshold whenever the reranker changes**.

Consequences for Nora:
- The embedding model fixes the vector size in `document_chunks` (384 for bge-small). Changing
  models means a migration and re-embedding every chunk: minutes at our scale, but deliberate.
- The usual Python runtime for these models pulls in PyTorch (gigabytes in the Docker image).
  Check an ONNX-based runtime that runs the same models without it when building Nora's version.

### Open decisions

- **AI providers.** UNC hasn't approved any yet. Embeddings and reranking start local (above).
  The LLM is still open: for the tutorial, classmates must be able to run it, ideally with no key
  or cost (a local model, or a hosted API with an optional key). For Nora it sits behind
  `LLMProvider`, so we can start with one and switch when UNC decides.
- **Document scope (decided 2026-10-27; Nora's settled 2026-11-10).** The tutorial uses the 16
  seeded policies. Nora uses all 197 policies in the Link's inventory (see
  [decisions.md](decisions.md)); check during ingestion which ones link out to PDFs.
- **Tutorial format and location.** A notebook or a script, and in this repo (e.g. `tutorial/`)
  or a separate public repo that classmates can clone on its own.
- **Talk roles** for all four members (see above).

### Documenting as we go

- Small commits, one stage at a time, with clear messages. The commit list is the talk's outline.
- Add a dated [Build log](#build-log) entry for each real decision (chunk size, top-k, the
  confidence threshold, the provider), with the reason and any before/after examples or eval
  numbers. That's the raw material for the slides.

## Ingestion

A script (later, an admin upload) does the following:
1. Takes a source document (PDF, HTML or text) plus metadata: title, type, office, topics, URL,
   citation.
2. Extracts the text, keeping headings as Markdown, and stores the `documents` row.
3. Splits it into section-based chunks with context headers (see
   [Pipeline requirements](#pipeline-requirements-proposed-2026-10-27)).
4. Embeds the chunks and stores them in `document_chunks`.

Re-ingesting a changed document replaces its chunks. Only `active` + `is_authoritative` documents
are retrieved for answers.

The seed loads all 197 policies in the Link's inventory with their full text in
`documents.content_text`, headings kept as Markdown (`backend/app/seed/data/policy_inventory.json`,
built by `backend/scripts/build_policy_inventory.py`). Chunking reads that text, so ingestion
doesn't need the network.

## Answering `POST /api/ask`

1. **Retrieve:** a hybrid search combining pgvector similarity and Postgres full-text search,
   merged with RRF, then reranked by a cross-encoder down to the top 4–5 chunks (see
   [Retrieval design](#retrieval-design-proposed-2026-10-27)). Keyword search over whole
   documents already exists (`search_documents()` in `app/api/documents.py`).
2. **Gate:** if the best reranker score is below a threshold, or nothing relevant is found, skip the LLM.
   Return `outcome = no_answer` or `referred`, with the topic's office.
3. **Generate:** the LLM gets the question and the numbered chunks. It must answer only from the
   chunks, cite them by number, say when they don't cover the question, and never make a
   determination. The prompt is versioned (`prompt_version`).
4. **Check:** drop or flag answers that cite nothing, and map the citation numbers back to
   documents.
5. **Respond:** answer, citations (title, section, URL), confidence, outcome, referral office if
   any, and the standard disclaimer, in the shape in [api.md](api.md#ask). The Ask page renders
   it (`AnswerCard`).
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

## Build log

Newest first. One entry per decision or finding: what, why, and the evidence.

### 2026-11-10: `POST /api/ask` built
`app/rag/answer.py`: retrieve → gate (0.04) → the LLM answers from the 5 numbered chunks →
citation check → log to `questions` and `question_citations`. Decisions:
- **The LLM is optional.** `LLMProvider` with one OpenAI-compatible implementation (Groq for
  local development); `LLM_PROVIDER=none` is the default until UNC approves a provider. Without
  it, Ask returns the matching sections as sources: api.md's "level 2".
- **An answer that cites nothing isn't shown** (`no_answer`, with a referral). Citations accept
  `[1]` and the `【1】` some models write, and numbers that don't exist are ignored.
- **An LLM failure never shows an error page.** The researcher gets the sources and an office;
  the question is logged as `error` (shown to the browser as `no_answer`).
- **Referrals** (until the Link decides, see decisions.md): a gate referral goes to the topic's
  office when asked from a topic, otherwise to the Office of the Vice Chancellor for Research; a
  `no_answer` goes to the office that owns the best-matching policy.
- **The prompt is versioned** (`PROMPT_VERSION`, logged per question) and tells the model to
  answer only from the sources, cite every claim, never make a determination, and treat source
  text as content, not instructions. Version `2026-11-10.2` adds "only name an office if it
  appears in the sources": in testing, the first version told an ITAR asker to contact an
  "Office of Research Compliance" that wasn't in the sources. *(Jerry)*

### 2026-11-10: retrieval built and evaluated on 197 policies
`app/rag/retrieval.py`: vector search (pgvector cosine) and BM25 keyword search, top 20 each,
merged with RRF, then `BAAI/bge-reranker-base` rescores the 20 and keeps 5. Only active,
authoritative documents (and the chosen topic, if any) are searched.

**BM25 instead of Postgres `ts_rank`.** The plan was to start with `ts_rank` and switch only if
the evaluation showed a gain. It did, by a lot. Keyword search alone, on the 20 answerable
questions (expected policy ranked first / in the top 5):

| method | top-1 | top-5 |
|---|---|---|
| `ts_rank` (OR of the question's words) | 6/20 | 7/20 |
| `ts_rank_cd` | 1/20 | 8/20 |
| BM25 (`rank_bm25`, in memory) | 8/20 | 12/20 |

`ts_rank` counts how often a word appears, so "lab" repeated in animal-care chunks beats the one
chunk that mentions ITAR; BM25 weights rare words. The index lives in memory (about 2,500 chunks,
built in about a second) and rebuilds when ingestion changes the chunks.

**Full evaluation** (`python -m app.rag eval`, real models):

| method | top-1 | top-5 |
|---|---|---|
| vector | 13/20 | 17/20 |
| keyword (BM25) | 8/20 | 12/20 |
| hybrid (RRF) | 10/20 | 18/20 |
| hybrid + reranker | 14/20 | **20/20** |

Every question has an expected policy among the 5 chunks the LLM sees. Top-1 is lower than the
16-policy tutorial's 20/20: with 12× more documents, a related policy sometimes ranks first
(animal protocols → the animal imaging standard; foreign funding → research security training;
reporting plagiarism → OHRE SOP 1401).

**Gate threshold 0.04** (was 0.03 in the tutorial). Off-topic questions' best scores were at most
0.030 ("thesis deadline" matched OSP 300.03's proposal deadlines); the lowest correctly retrieved
real question was 0.051 (ITAR). At 0.04: 6/6 off-topic referred, 17/20 real ones answered. The
3 referred real questions (laptop to China, owning stock, lab notebooks) all had the wrong
policy ranked first, so referring them avoids answers grounded in the wrong policy. Re-tune
when the reranker, chunking or documents change, and when the Link's questions arrive.

**Open: speed.** Retrieval takes a median 7.3 s (max 14 s) on a laptop CPU, almost all of it the
reranker reading 20 chunks; with the LLM, a typical answer is near NF5's 10 s. Next: rerank 10–15
candidates, or compare smaller rerankers (fastembed has MiniLM-L-12 at 0.12 GB and Jina turbo at
0.15 GB, against bge-reranker-base's 1.04 GB) on both accuracy and latency.

**Models as downloaded:** fastembed's `BAAI/bge-small-en-v1.5` is a quantized ONNX build
(`Qdrant/bge-small-en-v1.5-onnx-Q`, 67 MB); bge-reranker-base is full precision (1.04 GB),
which also matters for the image size on CloudApps. *(Jerry)*

### 2026-11-10: ingestion built
`python -m app.rag` chunks every active document's Markdown (structure-aware, about 300 words at
most, a one-paragraph overlap when a section is split) and embeds each chunk with
`BAAI/bge-small-en-v1.5` into `document_chunks.embedding`. Decisions:
- **fastembed instead of sentence-transformers.** It runs the same bge models on ONNX Runtime, so
  the backend image doesn't pull in PyTorch (gigabytes). The reranker it also supports is
  `BAAI/bge-reranker-base`, the one the tutorial's eval picked.
- **No vector index yet.** See [database.md](database.md#content).
- **Re-run is cheap.** Chunks remember the document's `content_hash`, so only changed documents
  are re-embedded; docker compose runs ingestion on every start.
- **Tests never load a model.** `FakeEmbeddingProvider` hashes words into the vector; the real
  provider is tested against a stub. Set `EMBEDDING_PROVIDER=fake` to run the app without it.

Numbers: 197 policies → 2,465 chunks (114 words on average; the largest is one 353-word paragraph,
which isn't cut). The first run took 4.6 minutes on a laptop CPU, 1.5 of them downloading the
model; a re-run with nothing changed takes about a second. Vector search alone already shows why
hybrid retrieval and reranking are next: "Is ITAR relevant to my lab?" returns animal-care
standards (the model doesn't know the acronym), and "Can I take my laptop to China for a
conference?", which the 16-policy tutorial answered, now ranks "Animal Transport" first: with 12×
more documents there are more near-misses. *(Jerry)*

### 2026-10-27: Nora reranker candidates
For Nora's reranker, benchmark `BAAI/bge-reranker-base` (expected pick), `bge-reranker-v2-m3` and
MiniLM on the evaluation set for accuracy and CPU latency; the tutorial keeps MiniLM. The gate
threshold is re-tuned whenever the reranker changes. *(Anton)*

### 2026-10-27: tutorial scope and models
The tutorial uses the 16 seeded policies (Anton). Proposed models for the tutorial and Nora's
start: `BAAI/bge-small-en-v1.5` embeddings and the `cross-encoder/ms-marco-MiniLM-L-6-v2`
reranker, both local and free; hosted or larger models get tested against the evaluation once UNC
approves providers. *(Anton)*

### 2026-10-27: pipeline requirements proposed
Structure-aware chunking on the policies' real headings (`h2`–`h5`) with context headers; the seed
text flattened headings, so ingestion re-extracts the HTML. Glossary-based query expansion always,
LLM rewriting only as a measured experiment. Hard metadata filters for active/authoritative and
user-chosen topics; inferred topics only boost. An explicit grounding prompt, backed by the gate,
the citation check and the evaluation. *(Anton)*

### 2026-10-27: retrieval design proposed
Hybrid retrieval (cosine on embeddings + BM25 keyword search), merged with Reciprocal Rank Fusion,
then a cross-encoder reranks the top ~20 down to 4–5 chunks for the LLM; the confidence gate uses
the reranker score. Cosine is kept as the vector metric, since for normalized embeddings the
choice of metric doesn't change the ranking. Reranking added as its own stage (5), so the stages
are now 0–8. *(Anton)*

### 2026-10-27: build plan proposed
Plan above proposed by Anton: tutorial demo first (tech talk Nov 2), then Nora's pipeline (Nov 19
showcase), built in stages 0–8, split between Anton and Jerry as above. Pending Jerry's review.

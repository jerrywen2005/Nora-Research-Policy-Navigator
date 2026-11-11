# Product

**Status:** Current as of 2026-11-10.

## People

- **Clients:** Jeanne Lovmo (lovmo@unc.edu) and Quinton Johnson, UNC Office of the Vice Chancellor
  for Research, Research Compliance Services.
- **Research Policy Navigator Link:** the client's cross-functional working group, led by Jeanne
  Lovmo. Members: Amina Castro-Corbett, Colette Dishakjian, Manal Khan, Anly Thomas (clinical
  trials compliance, escalation and referrals) and Amanda Chang (Office of Sponsored Programs).
  The Link defines scope, functional requirements, approved knowledge sources, standards for
  answers, citations, disclaimers and referrals, and test scenarios, and runs user acceptance
  testing. Subject-matter experts from individual offices review content in their areas.
- **COMP 523 team (us):** the technical build. We follow the Link's lead on interface design and
  content rules. Put anything we're unsure of on the open-questions list in
  [decisions.md](decisions.md) instead of deciding it ourselves.
- **SSO contact:** David Cowig.

## What Nora is

Nora is one place for UNC researchers (faculty, staff, students, research coordinators and
administrators) to find, understand and act on research policy. Today that information is spread
across many websites and offices, and it's hard to interpret even once you find it.

Researchers sign in with their Onyen and then:
- **browse** the policy topics (9 categories in the Research Policy Repository) and their
  subtopics (77 tags the Link defined, shared across topics),
- **search** policies, guidance and FAQs by keyword, or
- **ask** a plain-language question and get a short, source-grounded answer with citations, or a
  referral to the right office.

Admins (UNC Research staff) manage the knowledge base and see analytics on what researchers ask.

## Product rules

- Answers are grounded in approved sources and cite them. Nora is not an open-ended chatbot.
- Answers are informational guidance, not regulatory or compliance determinations, and the UI
  says so on every answer.
- When the sources don't support a reliable answer, Nora says so and refers the user to the
  responsible office. It never guesses, and it never presents an unsupported interpretation as
  policy.
- Give a clear next step whenever possible (a link, an office, a contact).
- Browse, Search and Ask get equal visual weight on the researcher home screen.
- Only curated public or client-approved documents. No confidential records, and no integration
  with IRB, COI or other enterprise systems.
- Every knowledge source has an identifiable owner (an office) and, where appropriate, review
  dates. Admins control which documents are authoritative and can archive or replace outdated
  ones. Nothing is deleted without explicit admin confirmation.
- Conflicting, outdated or duplicate content should be surfaced to content owners.
- UI: UNC colors and branding (https://research.unc.edu/news/branding/), simple, and responsive
  on desktop and mobile.

## Admin dashboard (must have)

From Jeanne's dashboard guidance and the Link proposal. It summarizes all three researcher
functions (Browse, Search and Ask), not only questions:
1. Number of users or visits
2. Number of Browse, Search and Ask interactions
3. Most frequently viewed topics and policies, and the most cited resources
4. Common search terms
5. Searches that don't lead to a useful result (measured as searches with no results)
6. Questions asked most often
7. Questions Nora couldn't answer from the Repository, and questions referred to an office
8. Feedback: the share of answers rated helpful
9. Patterns over time, such as topics generating more questions
10. Export of the dashboard's data (CSV)

It shows aggregate patterns, never individual researchers. The goal is to help UNC Research
improve topics and search terms, policy accessibility, FAQs, training and communication.

Admins are a single list that admins (Jeanne, to start) maintain in the app; everyone else is
a researcher. It also includes content management: add, review, update and archive policies, guidance, FAQs,
topics and other sources.

## Evaluation

The Link will provide realistic test scenarios. Answers are judged on accuracy, source grounding,
citation quality, relevance, clarity, appropriate referrals, handling of uncertainty, ease of use
and usefulness. Scenario types:
- straightforward questions
- questions spanning several policies or offices
- ambiguous questions
- questions with no authoritative source
- questions that need a referral
- outdated or conflicting information
- high-risk questions where Nora must not make a determination

See [rag.md](rag.md#evaluation).

## Requirements

**Status:** revised 2026-11-10 to match the Link proposal and Jeanne's follow-up; our draft until
the Link approves it.

The full requirements, with Perhaps and Improbable items and the interfaces, are D1 on the project
website (`app/deliverables/product-specification/spec.ts` in the website repo). That is the version
we submit, so change requirements there first and keep this summary in sync. The MVP (due Thu
Nov 12) needs every Definite functional requirement and at least 8 of the 10 Definite
non-functional ones.

**Functional (Definite)**

| ID | Requirement |
|---|---|
| F1 | **Sign-in and roles:** mock Onyen sign-in sends each role to its own home; admin pages and endpoints return 403 to researchers |
| F2 | **Three equal entry points:** Browse, Search and Ask at equal size and weight on the researcher home |
| F3 | **Browse by topic and subtopic:** topic → documents → a document page with summary, owning office and Repository link; selecting a subtopic tag lists every policy with it, across topics, and each document links related policies that share a tag |
| F4 | **Search:** keyword or phrase search over titles, text, topics and subtopics; ranked active documents with citation and link |
| F5 | **Ask:** a concise answer from the Repository only, with numbered citations linking to the policy and section |
| F6 | **Referral:** when the sources can't support a confident answer, none is generated; show the responsible office and contact as the next step |
| F7 | **Answer feedback:** helpful / not helpful on every answer |
| F8 | **FAQs:** admins write and publish FAQs; researchers browse them on an FAQ page and the matching topic page |
| F9 | **Saved items:** save a question and answer, or a document, and see them on a Saved page |
| F10 | **Usage logging:** topic and document views, searches (terms, result count) and questions (outcome, citations) are recorded |
| F11 | **Admin dashboard:** every measure in [Admin dashboard](#admin-dashboard-must-have) for a date range, aggregates only, with CSV export |
| F12 | **Content management:** add a Repository document by link as a draft; review and publish; edit topic, subtopics, office and authoritative flag; archive and restore. No in-app text editing: the Repository stays the authoritative text |

**Non-functional (Definite)**

| ID | Requirement |
|---|---|
| NF1 | **Grounded only:** answers use only active, authoritative Repository documents; off-topic questions are referred |
| NF2 | **Disclaimer and next step:** every answer shows the Link-approved AI disclaimer, never reads as a determination, and gives a source link or office |
| NF3 | **Measured quality:** the evaluation on the Link's sample questions finds the right policy in the top 5 for at least 90% of answerable questions and refers at least 90% of out-of-scope ones |
| NF4 | **Concise and plain:** answers of about 150 words or fewer, never raw policy text |
| NF5 | **Speed:** a typical answer in under 10 s; browse and search in under 1 s |
| NF6 | **Privacy:** the dashboard shows aggregates only; questions go only to a UNC-approved AI provider |
| NF7 | **No silent deletes:** documents are archived; a permanent delete needs explicit confirmation |
| NF8 | **Responsive, accessible, on-brand:** 375–1440 px wide, keyboard-usable, AA contrast, UNC colors |
| NF9 | **Deployable on CloudApps:** OpenShift-compatible images, settings in env vars, deployment documented |
| NF10 | **Maintainable and handed off:** CI enforces lint and 100% backend coverage; handoff docs cover architecture, conventions, deployment, maintenance, known limitations and next steps |

**Perhaps (F13–F22):** plain-language matching in search, review-due dates, flagging
conflicting or outdated content, dashboard filters by topic, UNC SSO, related questions,
multi-turn follow-ups, grouping similar questions, document version history, and editing the
admin list in the app (Users & Roles).

**Improbable (F23–F28, NF11–NF13):** our own MFA, live sync with the Repository, languages
other than English, auto-published FAQs, predictive analytics, enterprise system integration,
sub-second answers under heavy load, a formal WCAG audit, and high-availability failover.

**Interfaces (I1–I10):** the researcher home keeps the mockup's right rail (I1), and the answer
panel shows a confidence indicator (I2). The LLM (I7) and the embedding and reranking models (I8)
sit behind provider interfaces, so no provider is named until UNC approves one; the RAG plan
starts embeddings and reranking on our own server. UNC SSO (I9) is a Perhaps.

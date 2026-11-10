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
  subtopics (tags the Link defines),
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

**Status:** narrowed for the MVP on 2026-11-10; our draft until the Link approves it.

The original spec (D1 on the project website: US1–US13, F1–F34, NF1–NF13, I1–I12) is kept as
delivered. This narrowed list replaces it for building. The MVP (due Thu Nov 12) needs every
functional requirement and at least 8 of the 10 non-functional ones. The website's MVP Scope page
shows the same list with live status and owners; keep the two in sync.

**Functional**

| ID | Requirement | Replaces |
|---|---|---|
| MF1 | **Sign-in and roles:** mock Onyen sign-in sends each role to its own home; admin pages and endpoints return 403 to researchers | F1–F3 |
| MF2 | **Three equal entry points:** Browse, Search and Ask at equal size and weight on the researcher home | F21, NF7 |
| MF3 | **Browse by topic and subtopic:** topic → documents → a document page with summary, owning office and Repository link; subtopic tags filter a topic and link related policies | F4, F5, F9 |
| MF4 | **Search:** keyword or phrase search over titles, text, topics and subtopics; ranked active documents with citation and link | F8 |
| MF5 | **Ask:** a concise answer from the Repository only, with numbered citations linking to the policy and section | F6, F10, F11 |
| MF6 | **Referral:** below the confidence threshold, no answer is generated; show the responsible office and contact as the next step | F12 |
| MF7 | **Answer feedback:** helpful / not helpful on every answer | F15 |
| MF8 | **FAQs:** admins write and publish FAQs; researchers browse them on an FAQ page and the matching topic page | F14, part of F20 |
| MF9 | **Usage logging:** topic and document views, searches (terms, result count) and questions (outcome, citations) are recorded | new |
| MF10 | **Admin dashboard:** every measure in [Admin dashboard](#admin-dashboard-must-have) for a date range, aggregates only, with CSV export | F16–F19, F27 |
| MF11 | **Content management:** add a Repository document by link as a draft; review and publish; edit topic, subtopics, office and authoritative flag; archive and restore. No in-app text editing: the Repository stays the authoritative text | F7, F20 |
| MF12 | **Saved items:** save a question and answer, or a document, and see them on a Saved page | F13 |

**Non-functional**

| ID | Requirement | Replaces |
|---|---|---|
| MNF1 | **Grounded only:** answers use only active, authoritative Repository documents; off-topic questions are referred | NF5 |
| MNF2 | **Disclaimer and next step:** every answer shows the client's AI disclaimer, never reads as a determination, and gives a source link or office | NF3 |
| MNF3 | **Measured quality:** the evaluation on the Link's sample questions finds the right policy in the top 5 for at least 90% of answerable questions and refers at least 90% of out-of-scope ones | new |
| MNF4 | **Concise and plain:** answers of about 150 words or fewer, never raw policy text | NF2 |
| MNF5 | **Speed:** a typical answer in under 10 s; browse and search in under 1 s | NF8 |
| MNF6 | **Privacy:** the dashboard shows aggregates only; questions go only to a UNC-approved AI provider | new |
| MNF7 | **No silent deletes:** documents are archived; a hard delete needs explicit confirmation | NF6 |
| MNF8 | **Responsive, accessible, on-brand:** 375–1440 px wide, keyboard-usable, AA contrast, UNC colors | NF1 |
| MNF9 | **Deployable on CloudApps:** OpenShift-compatible images, settings in env vars, deployment documented | NF10 |
| MNF10 | **Maintainable and handed off:** CI enforces lint and 100% backend coverage; handoff docs cover architecture, conventions, deployment, maintenance, known limitations and next steps | new |

**Perhaps:** plain-language synonyms in search, review-due dates, flagging conflicting or
outdated content to its owner, dashboard filters by topic, real UNC SSO, related and follow-up
questions, grouping similar questions, document version history.

**Out of scope:** our own MFA, live sync with the Knowledge Base, languages other than English,
auto-published FAQs, predictive analytics, enterprise system integration, sub-second answers
under heavy load, a formal WCAG audit, and high-availability failover.

**Interfaces:** the LLM and the embedding model sit behind provider interfaces. Embeddings and
reranking run locally; no LLM provider is named until UNC approves one. Screens in D1's mockup interfaces that
aren't in the list above (Announcements, the right rail, System Settings, Integrations) aren't
being built.

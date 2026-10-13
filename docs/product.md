# Product

**Status:** Current as of 2026-10-11.

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
- **browse** the policy topics (9 categories in the Research Policy Repository),
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

1. Top topics being asked about
2. Answers delivered vs. referred to an office
3. Number and types of questions
4. Questions that weren't answered confidently
5. User activity (how much Nora is used)
6. Feedback analytics
7. Most frequently accessed or cited resources
8. Downloadable data and analytics (export)

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

The full user stories and functional, non-functional and interface requirements (US1–US13,
F1–F34, NF1–NF13, I1–I12) are in the team spec document on the project website. Highlights for
this semester:
- **In scope:** mock login modeling Onyen, roles, browse, keyword search, ask with citations,
  referrals, saved items, FAQs, feedback, the admin dashboard and content management.
- **Maybe:** real UNC SSO, document version history, related questions, multi-turn follow-ups,
  FAQ clustering, analytics export and filters.
- **Out of scope:** our own MFA, live sync with the Knowledge Base, languages other than English,
  auto-published FAQs, predictive analytics, and enterprise system integration.

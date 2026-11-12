// Sample API objects for tests, matching docs/api.md.
import type { AdminFaq, DocumentSummary, Faq, SavedItem, SavedQuestion } from '../api/types'

export function documentSummary(overrides: Partial<DocumentSummary> = {}): DocumentSummary {
  return {
    id: 12,
    title: 'Export Controls',
    doc_type: 'policy',
    citation: null,
    source_url: 'https://policies.unc.edu/TDClient/2833/Portal/KB/ArticleDet?ID=12',
    summary: 'When export rules apply to research.',
    office: null,
    topics: [],
    tags: [],
    is_authoritative: true,
    last_reviewed_at: null,
    ...overrides,
  }
}

export function savedQuestion(overrides: Partial<SavedQuestion> = {}): SavedQuestion {
  return {
    id: 41,
    question_text: 'How long can I be a postdoc?',
    outcome: 'answered',
    answer_text: 'Five years in total [1].',
    citations: [
      {
        number: 1,
        document_id: 3,
        title: 'Postdoctoral Scholar Policy',
        section: 'Term',
        source_url: 'https://policies.unc.edu/Article/3',
        snippet: '',
      },
    ],
    contacts: [],
    disclaimer: 'General information, not an official determination.',
    links: [],
    feedback: null,
    created_at: '2026-11-11T15:01:12Z',
    ...overrides,
  }
}

export function savedDocumentItem(id = 7, document = documentSummary()): SavedItem {
  return { id, created_at: '2026-11-11T15:10:00Z', kind: 'document', document, question: null }
}

export function savedQuestionItem(id = 8, question = savedQuestion()): SavedItem {
  return { id, created_at: '2026-11-11T15:12:00Z', kind: 'question', document: null, question }
}

export function faq(overrides: Partial<Faq> = {}): Faq {
  return {
    id: 3,
    question: 'Do I need IRB approval to use existing de-identified data?',
    answer: 'Usually not, if you **can’t** link the data back to individuals.',
    topic: { id: 1, slug: 'human-subjects-research', name: 'Human Research & IRB' },
    sources: [{ id: 12, title: 'Use of Existing Data', doc_type: 'guidance', citation: 'OHRE SOP 1301' }],
    updated_at: '2026-11-12T18:30:00Z',
    ...overrides,
  }
}

export function adminFaq(overrides: Partial<AdminFaq> = {}): AdminFaq {
  return {
    ...faq(),
    status: 'draft',
    sort_order: 0,
    created_at: '2026-11-12T18:00:00Z',
    updated_by: { id: 2, onyen: 'admin1', display_name: 'Test Admin' },
    ...overrides,
  }
}

import type { AskResponse, SavedQuestion } from '../api/types'

// What an answer card shows: a fresh Ask response, or a saved one (which has no confidence).
export type AnswerContent = Pick<
  AskResponse,
  'outcome' | 'answer' | 'citations' | 'contacts' | 'disclaimer' | 'links'
> & { confidence: number | null }

export function savedAnswer(question: SavedQuestion): AnswerContent {
  return {
    outcome: question.outcome,
    answer: question.answer_text,
    citations: question.citations,
    contacts: question.contacts,
    disclaimer: question.disclaimer,
    links: question.links,
    confidence: null,
  }
}

import type { AskResponse, SavedQuestion } from '../api/types'

// What an answer card shows: a fresh Ask response, or a saved one (which has no confidence).
export type AnswerContent = Pick<
  AskResponse,
  'outcome' | 'answer' | 'citations' | 'referral' | 'disclaimer'
> & { confidence: number | null }

// The backend's DISCLAIMER (app/rag/answer.py). Saved answers don't carry it, but NF2 says
// every answer shows it, so the Saved page uses this copy. Keep the two in sync.
export const DISCLAIMER =
  'Nora provides general information, not an official determination. Contact the responsible ' +
  'office for a formal review.'

export function savedAnswer(question: SavedQuestion): AnswerContent {
  return {
    outcome: question.outcome,
    answer: question.answer_text,
    citations: question.citations,
    referral: question.referral,
    disclaimer: DISCLAIMER,
    confidence: null,
  }
}

import { createContext, useContext } from 'react'
import type { SavedItem, SaveRequest } from '../api/types'

export interface SavedState {
  // The user's saved items, newest first. Empty until the first GET /api/saved finishes.
  items: SavedItem[]
  status: 'loading' | 'ready' | 'error'
  // The saved item for this document or question, if it's saved.
  find(target: SaveRequest): SavedItem | undefined
  // Both throw ApiError on failure and leave `items` unchanged.
  save(target: SaveRequest): Promise<void>
  remove(itemId: number): Promise<void>
}

export const SavedContext = createContext<SavedState | null>(null)

export function useSaved(): SavedState {
  const saved = useContext(SavedContext)
  if (!saved) {
    throw new Error('useSaved must be used inside <SavedProvider>')
  }
  return saved
}

export function matches(item: SavedItem, target: SaveRequest): boolean {
  if ('document_id' in target) {
    return item.kind === 'document' && item.document.id === target.document_id
  }
  return item.kind === 'question' && item.question.id === target.question_id
}

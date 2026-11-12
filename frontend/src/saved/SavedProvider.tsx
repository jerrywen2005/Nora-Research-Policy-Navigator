import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Outlet } from 'react-router'
import type { Feedback, SavedItem, SaveRequest } from '../api/types'
import { getSaved, saveItem, unsaveItem } from '../pages/researcher/researcherApi'
import { matches, SavedContext, type SavedState } from './SavedContext'

// Loads the user's saved items once, so every Save button and the Saved page agree without each
// fetching the list. Wraps the researcher pages; with no children it renders the matched route.
export default function SavedProvider({ children }: { children?: ReactNode }) {
  const [items, setItems] = useState<SavedItem[]>([])
  const [status, setStatus] = useState<SavedState['status']>('loading')

  useEffect(() => {
    let cancelled = false
    getSaved().then(
      (loaded) => {
        if (!cancelled) {
          // Keep anything saved while the list was loading.
          setItems((current) => [...current, ...loaded.filter((i) => !current.some((c) => c.id === i.id))])
          setStatus('ready')
        }
      },
      () => !cancelled && setStatus('error'),
    )
    return () => {
      cancelled = true
    }
  }, [])

  const find = useCallback(
    (target: SaveRequest) => items.find((item) => matches(item, target)),
    [items],
  )

  const save = useCallback(async (target: SaveRequest) => {
    const item = await saveItem(target)
    setItems((current) => [item, ...current.filter((c) => c.id !== item.id)])
  }, [])

  const remove = useCallback(async (itemId: number) => {
    await unsaveItem(itemId)
    setItems((current) => current.filter((c) => c.id !== itemId))
  }, [])

  const setRating = useCallback((questionId: number, feedback: Feedback | null) => {
    setItems((current) =>
      current.map((item) =>
        item.kind === 'question' && item.question.id === questionId
          ? { ...item, question: { ...item.question, feedback } }
          : item,
      ),
    )
  }, [])

  const value = useMemo(
    () => ({ items, status, find, save, remove, setRating }),
    [items, status, find, save, remove, setRating],
  )

  return <SavedContext.Provider value={value}>{children ?? <Outlet />}</SavedContext.Provider>
}

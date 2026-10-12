import { useEffect, useState } from 'react'

export type LoadState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; data: T }

// Runs `load` whenever `key` changes and tracks loading and error states. A response that arrives
// after `key` has changed again is ignored.
export function useLoad<T>(key: string, load: () => Promise<T>): LoadState<T> {
  const [state, setState] = useState<{ key: string; value: LoadState<T> }>({
    key,
    value: { status: 'loading' },
  })

  useEffect(() => {
    let cancelled = false
    load().then(
      (data) => !cancelled && setState({ key, value: { status: 'ready', data } }),
      (error: unknown) => !cancelled && setState({ key, value: { status: 'error', error } }),
    )
    return () => {
      cancelled = true
    }
    // `load` is a new function on every render; `key` identifies what it loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return state.key === key ? state.value : { status: 'loading' }
}

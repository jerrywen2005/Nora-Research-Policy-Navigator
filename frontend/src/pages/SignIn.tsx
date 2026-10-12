import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router'
import { ApiError } from '../api/client'
import { homePathFor, useAuth } from '../auth/AuthContext'
import LoadingScreen from '../auth/LoadingScreen'
import './SignIn.css'

// Seeded demo accounts (see docs/auth.md).
const DEMO_ACCOUNTS = [
  { label: 'Researcher demo', onyen: 'researcher1' },
  { label: 'Admin demo', onyen: 'admin1' },
]

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return err.detail ?? `Sign-in failed (error ${err.status}). Please try again.`
  }
  return "Couldn't reach the server. Check your connection and try again."
}

// Mock sign-in (AUTH_PROVIDER=mock). UNC SSO will replace this page.
export default function SignIn() {
  const { user, loading, signIn } = useAuth()
  const location = useLocation()
  const [onyen, setOnyen] = useState('')
  const [error, setError] = useState<string | null>(null)
  // Which button started the sign-in ('form' or a demo Onyen), so only that
  // button shows progress.
  const [pending, setPending] = useState<string | null>(null)

  if (loading) {
    return <LoadingScreen />
  }

  // Already signed in, or just signed in: go where they were headed (set by
  // RequireAuth), or to the home page for their role.
  if (user) {
    const from = (location.state as { from?: unknown } | null)?.from
    const target = typeof from === 'string' && from.startsWith('/') ? from : homePathFor(user)
    return <Navigate to={target} replace />
  }

  async function submit(value: string, source: string) {
    const trimmed = value.trim()
    if (!trimmed) {
      setError('Enter your Onyen.')
      return
    }
    setError(null)
    setPending(source)
    try {
      await signIn(trimmed)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setPending(null)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submit(onyen, 'form')
  }

  const busy = pending !== null

  return (
    <main className="signin">
      <div className="signin__card">
        <p className="signin__brand">
          Nora <span>Research Policy Navigator</span>
        </p>
        <h1>Sign in</h1>
        <p className="signin__notice">Demo sign-in. UNC SSO will replace this.</p>

        {error && (
          <p className="signin__error" role="alert">
            {error}
          </p>
        )}

        <form className="signin__form" onSubmit={handleSubmit} noValidate>
          <label htmlFor="onyen">Onyen</label>
          <input
            id="onyen"
            name="onyen"
            value={onyen}
            onChange={(event) => setOnyen(event.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            disabled={busy}
            aria-invalid={error !== null}
          />
          <button type="submit" className="button" disabled={busy}>
            {pending === 'form' ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="signin__divider">or use a demo account</p>
        <div className="signin__demos">
          {DEMO_ACCOUNTS.map((demo) => (
            <button
              key={demo.onyen}
              type="button"
              className="button button--secondary"
              onClick={() => void submit(demo.onyen, demo.onyen)}
              disabled={busy}
            >
              {pending === demo.onyen ? 'Signing in…' : demo.label}
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}

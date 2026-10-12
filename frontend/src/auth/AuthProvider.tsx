import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User } from '../api/types'
import { AuthContext, type AuthState } from './AuthContext'
import { realAuthApi } from './authApi'
import { fakeAuthApi, fakeAuthEnabled } from './fakeAuth'

const authApi = fakeAuthEnabled ? fakeAuthApi : realAuthApi

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 401 means signed out. Any other failure (backend down, 500) is treated
    // the same way, so the user lands on sign-in and sees the error there.
    authApi
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const signIn = useCallback(async (onyen: string) => {
    const signedIn = await authApi.mockLogin(onyen)
    setUser(signedIn)
    return signedIn
  }, [])

  const signOut = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      setUser(null)
    }
  }, [])

  const value = useMemo<AuthState>(
    () => ({ user, loading, signIn, signOut }),
    [user, loading, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

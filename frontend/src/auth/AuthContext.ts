import { createContext, useContext } from 'react'
import type { User } from '../api/types'

export interface AuthState {
  // The signed-in user, or null when signed out.
  user: User | null
  // True until the first GET /api/me finishes.
  loading: boolean
  // True after the user clicks Sign out, until the next sign-in. Route guards
  // use it so the next person isn't sent back to the previous user's page.
  signedOut: boolean
  // Throws ApiError if sign-in fails; its `detail` is the message to show.
  signIn(onyen: string): Promise<User>
  signOut(): Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const auth = useContext(AuthContext)
  if (!auth) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return auth
}

// Where a user lands after sign-in when they weren't headed anywhere.
export function homePathFor(user: User): string {
  return user.role === 'admin' ? '/admin' : '/'
}

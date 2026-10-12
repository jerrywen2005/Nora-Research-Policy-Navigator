// The three auth calls from docs/api.md, behind one interface so the
// temporary fake (fakeAuth.ts) can stand in for them.
import { apiGet, apiPost } from '../api/client'
import type { MockLoginRequest, User } from '../api/types'

export interface AuthApi {
  me(): Promise<User>
  mockLogin(onyen: string): Promise<User>
  logout(): Promise<void>
}

export const realAuthApi: AuthApi = {
  me: () => apiGet<User>('/me'),
  mockLogin: (onyen) => apiPost<User>('/auth/mock-login', { onyen } satisfies MockLoginRequest),
  logout: () => apiPost<void>('/auth/logout'),
}

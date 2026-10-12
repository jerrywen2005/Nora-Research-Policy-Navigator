// TEMPORARY: fake auth for building the frontend before the backend auth
// endpoints exist. Enabled with VITE_FAKE_AUTH=true. It stands in for
// POST /api/auth/mock-login, POST /api/auth/logout and GET /api/me, returns
// Users shaped exactly like docs/api.md, and keeps the session in memory, so
// a page reload signs you out.
//
// To remove it: delete this file and the fake branch in AuthProvider.tsx.
import { ApiError } from '../api/client'
import type { User } from '../api/types'
import type { AuthApi } from './authApi'

export const fakeAuthEnabled = import.meta.env.VITE_FAKE_AUTH === 'true'

const fakeUsers: Record<string, User> = {
  researcher1: {
    id: 1,
    onyen: 'researcher1',
    display_name: 'Test Researcher',
    email: 'researcher1@unc.edu',
    role: 'researcher',
  },
  admin1: {
    id: 2,
    onyen: 'admin1',
    display_name: 'Test Admin',
    email: 'admin1@unc.edu',
    role: 'admin',
  },
}

let currentUser: User | null = null

// A short delay so loading states show up the way they will with the real API.
function delay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 300))
}

export const fakeAuthApi: AuthApi = {
  async me() {
    await delay()
    if (!currentUser) {
      throw new ApiError('GET', '/me', 401, 'Not signed in')
    }
    return currentUser
  },

  async mockLogin(onyen) {
    await delay()
    const user = fakeUsers[onyen.trim().toLowerCase()]
    if (!user) {
      throw new ApiError(
        'POST',
        '/auth/mock-login',
        401,
        'Fake auth only knows researcher1 and admin1.',
      )
    }
    currentUser = user
    return user
  },

  async logout() {
    await delay()
    currentUser = null
  },
}

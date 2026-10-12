import { Navigate, Outlet } from 'react-router'
import type { Role } from '../api/types'
import { useAuth } from './AuthContext'

// Layout route: renders its child routes only for users with `role`; anyone
// else goes to the researcher home. Use inside RequireAuth. This only hides
// UI; the backend's require_role() is what enforces access.
export default function RequireRole({ role }: { role: Role }) {
  const { user } = useAuth()

  if (user?.role !== role) {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}

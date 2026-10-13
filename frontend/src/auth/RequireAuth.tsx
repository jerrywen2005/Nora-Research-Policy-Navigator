import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './AuthContext'
import LoadingScreen from './LoadingScreen'

// Layout route: renders its child routes only for a signed-in user. Anyone
// else goes to /signin, which sends them back here afterwards, unless they
// just signed out (the next person should land on their own home page).
export default function RequireAuth() {
  const { user, loading, signedOut } = useAuth()
  const location = useLocation()

  if (loading) {
    return <LoadingScreen />
  }
  if (!user) {
    if (signedOut) {
      return <Navigate to="/signin" replace />
    }
    const from = location.pathname + location.search
    return <Navigate to="/signin" replace state={{ from }} />
  }
  return <Outlet />
}

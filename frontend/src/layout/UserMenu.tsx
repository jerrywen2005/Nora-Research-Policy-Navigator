import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'

// Header user menu: who is signed in, their role, a view switch for admins,
// and sign out.
export default function UserMenu() {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)

  if (!user) {
    return null
  }

  const inAdminView = location.pathname === '/admin' || location.pathname.startsWith('/admin/')

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
    } finally {
      // Go straight to /signin so the next person isn't sent back to this page.
      navigate('/signin', { replace: true })
    }
  }

  return (
    <div className="user-menu">
      {user.role === 'admin' &&
        (inAdminView ? (
          <Link to="/" className="user-menu__switch">
            Researcher view
          </Link>
        ) : (
          <Link to="/admin" className="user-menu__switch">
            Admin view
          </Link>
        ))}
      <span className="user-menu__who">
        <span className="user-menu__name">{user.display_name ?? user.onyen}</span>
        <span className="badge">{user.role === 'admin' ? 'Admin' : 'Researcher'}</span>
      </span>
      <button
        type="button"
        className="user-menu__signout"
        onClick={handleSignOut}
        disabled={signingOut}
      >
        {signingOut ? 'Signing out…' : 'Sign out'}
      </button>
    </div>
  )
}

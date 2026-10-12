import type { ReactNode } from 'react'
import { Link } from 'react-router'

interface AppHeaderProps {
  // Right-hand slot for the signed-in user's menu (name, role, sign out).
  userMenu?: ReactNode
}

export default function AppHeader({ userMenu }: AppHeaderProps) {
  return (
    <header className="app-header">
      <Link to="/" className="app-header__brand">
        Nora
        <span className="app-header__tagline">Research Policy Navigator</span>
      </Link>
      <div className="app-header__user">{userMenu}</div>
    </header>
  )
}

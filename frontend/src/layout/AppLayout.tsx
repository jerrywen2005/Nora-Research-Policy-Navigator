import { Link, Outlet } from 'react-router'
import AppHeader from './AppHeader'
import SideNav from './SideNav'
import type { NavItem } from './navItems'
import './layout.css'

interface AppLayoutProps {
  navLabel: string
  nav: NavItem[]
}

// Header + sidebar around the current route's page. Used for both the
// researcher and admin areas; only the nav items differ.
export default function AppLayout({ navLabel, nav }: AppLayoutProps) {
  return (
    <div className="app">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      {/* Placeholder until sign-in lands; the auth work replaces it with the user menu. */}
      <AppHeader userMenu={<Link to="/signin">Sign in</Link>} />
      <div className="app-body">
        <SideNav label={navLabel} items={nav} />
        <main id="main" className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

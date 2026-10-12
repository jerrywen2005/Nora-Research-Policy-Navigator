import { Outlet } from 'react-router'
import AppHeader from './AppHeader'
import SideNav from './SideNav'
import UserMenu from './UserMenu'
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
      <AppHeader userMenu={<UserMenu />} />
      <div className="app-body">
        <SideNav label={navLabel} items={nav} />
        <main id="main" className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

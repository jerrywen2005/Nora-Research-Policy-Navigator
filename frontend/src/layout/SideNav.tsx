import { NavLink } from 'react-router'
import type { NavItem } from './navItems'

interface SideNavProps {
  label: string
  items: NavItem[]
}

export default function SideNav({ label, items }: SideNavProps) {
  return (
    <nav className="side-nav" aria-label={label}>
      <ul>
        {items.map((item) => (
          <li key={item.label}>
            {item.to ? (
              <NavLink to={item.to} end={item.end} className="side-nav__link">
                {item.label}
              </NavLink>
            ) : (
              <span className="side-nav__link side-nav__link--disabled" aria-disabled="true">
                {item.label}
                <span className="side-nav__soon">Soon</span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </nav>
  )
}

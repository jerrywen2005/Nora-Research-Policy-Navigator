// Sidebar navigation for each role. An item without `to` has no page yet and
// is shown disabled with a "Soon" tag; add `to` when its page lands.
export interface NavItem {
  label: string
  to?: string
  // Only active on exactly this path, not on the pages below it.
  end?: boolean
}

export const researcherNav: NavItem[] = [
  { label: 'Home', to: '/', end: true },
  { label: 'Ask a Question', to: '/ask' },
  { label: 'Search Policies', to: '/search' },
  { label: 'Browse Topics', to: '/browse' },
  { label: 'FAQs' },
  { label: 'Help & Support' },
  { label: 'Contact Compliance' },
]

export const adminNav: NavItem[] = [
  { label: 'Overview', to: '/admin', end: true },
  { label: 'Policy Library' },
  { label: 'Topics' },
  { label: 'Content Management' },
  { label: 'Users & Roles' },
  { label: 'Analytics & Reports' },
]

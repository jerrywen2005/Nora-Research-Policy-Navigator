import type { DocumentStatus } from '../../api/types'

// Admins see the API's `active` as "Published", the word the rest of the admin UI uses.
export const statusLabels: Record<DocumentStatus, string> = {
  draft: 'Draft',
  active: 'Published',
  archived: 'Archived',
}

export function formatDate(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

import type { DocType } from '../api/types'

// How each document type is labeled in badges.
export const docTypeLabels: Record<DocType, string> = {
  policy: 'Policy',
  standard: 'Standard',
  procedure: 'Procedure',
  sop: 'SOP',
  guidance: 'Guidance',
  faq: 'FAQ',
  webpage: 'Web page',
  job_aid: 'Job aid',
  other: 'Document',
}

// Data access for the admin pages, one function per endpoint in docs/api.md ("Admin: content
// management", "Admin: FAQs", "Admin analytics", plus the offices, topics and tags the editors
// pick from).
import { apiDelete, apiGet, apiPatch, apiPost } from '../../api/client'
import type {
  AdminDocument,
  AdminDocumentDetail,
  AdminDocumentQuery,
  AdminFaq,
  AdminFaqQuery,
  Analytics,
  AnalyticsQuery,
  CreateFaqRequest,
  Office,
  Page,
  Tag,
  Topic,
  UpdateDocumentRequest,
  UpdateFaqRequest,
} from '../../api/types'

// Query parameters without the empty ones.
function queryString(query: object): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') {
      params.set(key, String(value))
    }
  }
  return params.toString()
}

export function listAdminDocuments(query: AdminDocumentQuery): Promise<Page<AdminDocument>> {
  return apiGet<Page<AdminDocument>>(`/admin/documents?${queryString(query)}`)
}

// Rejects with an ApiError (status 404) for an unknown document.
export function getAdminDocument(id: string): Promise<AdminDocumentDetail> {
  return apiGet<AdminDocumentDetail>(`/admin/documents/${encodeURIComponent(id)}`)
}

// Imports a Repository article as a draft. Rejects with 422 (not a Repository link), 409 (already
// imported; `detail` names the document) or 502 (the Repository page couldn't be read).
export function importDocument(sourceUrl: string): Promise<AdminDocumentDetail> {
  return apiPost<AdminDocumentDetail>('/admin/documents', { source_url: sourceUrl })
}

export function updateDocument(id: number, request: UpdateDocumentRequest): Promise<AdminDocumentDetail> {
  return apiPatch<AdminDocumentDetail>(`/admin/documents/${id}`, request)
}

export type LifecycleAction = 'publish' | 'archive' | 'restore'

// Moves a document through draft → active → archived. Rejects with 409 when the move isn't allowed.
export function changeStatus(id: number, action: LifecycleAction): Promise<AdminDocumentDetail> {
  return apiPost<AdminDocumentDetail>(`/admin/documents/${id}/${action}`)
}

// Permanent (NF7): only for archived documents, and only after the admin confirms.
export function deleteDocument(id: number): Promise<void> {
  return apiDelete(`/admin/documents/${id}?confirm=true`)
}

export function getOffices(): Promise<Office[]> {
  return apiGet<Office[]>('/offices')
}

export function getTopics(): Promise<Topic[]> {
  return apiGet<Topic[]>('/topics')
}

export function getTags(): Promise<Tag[]> {
  return apiGet<Tag[]>('/tags')
}

// ---- FAQs (F8): docs/api.md, "Admin: FAQs" ----

// FAQs of any status, ordered by sort_order, then question. Not paged: there are few.
export function listAdminFaqs(query: AdminFaqQuery = {}): Promise<AdminFaq[]> {
  return apiGet<AdminFaq[]>(`/admin/faqs?${queryString(query)}`)
}

// Rejects with an ApiError (status 404) for an unknown FAQ.
export function getAdminFaq(id: string): Promise<AdminFaq> {
  return apiGet<AdminFaq>(`/admin/faqs/${encodeURIComponent(id)}`)
}

// Creates a draft. Rejects with 422 for a blank field or an unknown id.
export function createFaq(request: CreateFaqRequest): Promise<AdminFaq> {
  return apiPost<AdminFaq>('/admin/faqs', request)
}

export function updateFaq(id: number, request: UpdateFaqRequest): Promise<AdminFaq> {
  return apiPatch<AdminFaq>(`/admin/faqs/${id}`, request)
}

// Moves an FAQ through draft → published → archived. Rejects with 409 when the move isn't allowed.
export function changeFaqStatus(id: number, action: LifecycleAction): Promise<AdminFaq> {
  return apiPost<AdminFaq>(`/admin/faqs/${id}/${action}`)
}

// Permanent (NF7): only for archived FAQs, and only after the admin confirms.
export function deleteFaq(id: number): Promise<void> {
  return apiDelete(`/admin/faqs/${id}?confirm=true`)
}

// ---- Analytics (F11): docs/api.md, "Admin analytics" ----

function analyticsParams(query: AnalyticsQuery): string {
  const params = new URLSearchParams()
  if (query.from) params.set('from', query.from)
  if (query.to) params.set('to', query.to)
  return params.toString()
}

// Every dashboard measure for a date range (both ends inclusive; the API defaults to the last 30
// days). Rejects with 422 for a range that's backwards or longer than 366 days.
export function getAnalytics(query: AnalyticsQuery): Promise<Analytics> {
  return apiGet<Analytics>(`/admin/analytics?${analyticsParams(query)}`)
}

// The same numbers as a CSV file. A plain link: the browser sends the session cookie and saves
// the file under the name the server gives it.
export function analyticsExportUrl(query: AnalyticsQuery): string {
  return `/api/admin/analytics/export.csv?${analyticsParams(query)}`
}

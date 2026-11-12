// Data access for the admin content pages, one function per endpoint in docs/api.md
// ("Admin: content management", plus the offices, topics and tags the editor picks from).
import { apiDelete, apiGet, apiPatch, apiPost } from '../../api/client'
import type {
  AdminDocument,
  AdminDocumentDetail,
  AdminDocumentQuery,
  Office,
  Page,
  Tag,
  Topic,
  UpdateDocumentRequest,
} from '../../api/types'

export function listAdminDocuments(query: AdminDocumentQuery): Promise<Page<AdminDocument>> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') {
      params.set(key, String(value))
    }
  }
  return apiGet<Page<AdminDocument>>(`/admin/documents?${params}`)
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

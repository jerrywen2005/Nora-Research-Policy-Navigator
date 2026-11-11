// Data access for the researcher pages, one function per endpoint in docs/api.md.
import { apiGet, apiPost } from '../../api/client'
import type {
  AskRequest,
  AskResponse,
  DocumentQuery,
  DocumentSummary,
  Page,
  Topic,
  TopicDetail,
} from '../../api/types'

export function getTopics(): Promise<Topic[]> {
  return apiGet<Topic[]>('/topics')
}

// Rejects with an ApiError (status 404) for an unknown slug.
export function getTopic(slug: string): Promise<TopicDetail> {
  return apiGet<TopicDetail>(`/topics/${encodeURIComponent(slug)}`)
}

// An unknown topic slug gives an empty page, not an error.
export function getDocuments(query: DocumentQuery): Promise<Page<DocumentSummary>> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') {
      params.set(key, String(value))
    }
  }
  return apiGet<Page<DocumentSummary>>(`/documents?${params}`)
}

// Answers from the policies with citations, or refers to an office (docs/api.md). Takes several
// seconds: retrieval and reranking run on the server's CPU, then the LLM writes the answer.
export function ask(request: AskRequest): Promise<AskResponse> {
  return apiPost<AskResponse>('/ask', request)
}

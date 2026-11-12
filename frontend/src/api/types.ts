// Response and request shapes for the backend API.
// This file mirrors docs/api.md and the Pydantic schemas in backend/app/schemas/.
// Change all three together in the same PR.

// ---- Auth ----

export type Role = 'researcher' | 'admin'

export interface User {
  id: number
  onyen: string
  display_name: string | null
  email: string | null
  role: Role
}

export interface MockLoginRequest {
  onyen: string
}

// ---- Offices and topics ----

export interface Office {
  id: number
  name: string
  email: string | null
  phone: string | null
  url: string | null
}

export interface TopicRef {
  id: number
  slug: string
  name: string
}

// Subtopic tag (workflow D): one shared list from the Link, not owned by a topic.
export interface Tag {
  id: number
  slug: string
  name: string
  definition: string | null
}

export interface Topic extends TopicRef {
  description: string
  document_count: number
  tags: Tag[] // workflow D; tags on this topic's active documents
}

export interface TopicDetail extends Topic {
  office: Office | null
}

// ---- Documents ----

export type DocType =
  | 'policy'
  | 'standard'
  | 'procedure'
  | 'sop'
  | 'guidance'
  | 'faq'
  | 'webpage'
  | 'job_aid'
  | 'other'

export interface DocumentSummary {
  id: number
  title: string
  doc_type: DocType
  citation: string | null
  source_url: string | null
  summary: string | null
  office: Office | null
  topics: TopicRef[]
  tags: Tag[] // workflow D
  is_authoritative: boolean
  last_reviewed_at: string | null // "YYYY-MM-DD"
}

// Short form for links to a document (workflow D)
export interface DocumentRef {
  id: number
  title: string
  doc_type: DocType
  citation: string | null
}

export interface DocumentDetail extends DocumentSummary {
  content_text: string
  related_documents: DocumentRef[] // workflow D; documents sharing a tag
}

export interface Page<T> {
  items: T[]
  total: number
}

// Query parameters for GET /api/documents
export interface DocumentQuery {
  topic?: string
  tag?: string // workflow D; a tag slug, across all topics unless topic is also set
  q?: string
  limit?: number
  offset?: number
}

// ---- Admin: content management (workflow D) ----

export type DocumentStatus = 'draft' | 'active' | 'archived'

export interface UserRef {
  id: number
  onyen: string
  display_name: string | null
}

export interface AdminDocument extends DocumentSummary {
  status: DocumentStatus
  created_at: string // ISO 8601 timestamp
  updated_at: string // ISO 8601 timestamp
  updated_by: UserRef | null
}

export interface AdminDocumentDetail extends AdminDocument {
  content_text: string
}

// Query parameters for GET /api/admin/documents
export interface AdminDocumentQuery {
  status?: DocumentStatus
  topic?: string
  q?: string
  limit?: number
  offset?: number
}

// POST /api/admin/documents
export interface ImportDocumentRequest {
  source_url: string
}

// PATCH /api/admin/documents/{id}; omitted fields are unchanged, lists replace the whole list
export interface UpdateDocumentRequest {
  doc_type?: DocType
  office_id?: number | null
  topic_ids?: number[]
  tag_ids?: number[] // at most 5
  is_authoritative?: boolean
}

// ---- Ask ----

export type AskOutcome = 'answered' | 'referred' | 'no_answer'

export interface AskRequest {
  question: string
  topic: string | null
}

export interface Citation {
  number: number
  document_id: number
  title: string
  section: string // heading path within the document
  source_url: string | null
  snippet: string
}

export interface AskResponse {
  question_id: number
  outcome: AskOutcome
  answer: string | null
  citations: Citation[]
  referral: Office | null
  confidence: number // best reranker score, 0 to 1
  disclaimer: string
}

// ---- Feedback and saved items ----

// PUT /api/questions/{question_id}/feedback
export interface FeedbackRequest {
  helpful: boolean
  comment: string | null // at most 1000 characters
}

export interface Feedback {
  question_id: number
  helpful: boolean
  comment: string | null
  created_at: string // ISO 8601 timestamp
  updated_at: string
}

// POST /api/saved: send exactly one of the two.
export type SaveRequest = { document_id: number } | { question_id: number }

export interface SavedQuestion {
  id: number
  question_text: string
  outcome: AskOutcome
  answer_text: string | null
  // What the Ask page showed: cited sources ordered by number, and the referred office.
  citations: Citation[]
  referral: Office | null
  created_at: string
}

export type SavedItem =
  | { id: number; created_at: string; kind: 'document'; document: DocumentSummary; question: null }
  | { id: number; created_at: string; kind: 'question'; document: null; question: SavedQuestion }

// ---- Health ----

export interface HealthResponse {
  status: string
}

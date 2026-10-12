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

export interface Topic extends TopicRef {
  description: string
  document_count: number
}

export interface TopicDetail extends Topic {
  office: Office | null
}

// ---- Documents ----

export type DocType = 'policy' | 'sop' | 'guidance' | 'faq' | 'webpage' | 'job_aid' | 'other'

export interface DocumentSummary {
  id: number
  title: string
  doc_type: DocType
  citation: string | null
  source_url: string | null
  summary: string | null
  office: Office | null
  topics: TopicRef[]
  is_authoritative: boolean
  last_reviewed_at: string | null // "YYYY-MM-DD"
}

export interface DocumentDetail extends DocumentSummary {
  content_text: string
}

export interface Page<T> {
  items: T[]
  total: number
}

// Query parameters for GET /api/documents
export interface DocumentQuery {
  topic?: string
  q?: string
  limit?: number
  offset?: number
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
  section: string | null
  source_url: string | null
  snippet: string
}

export interface AskResponse {
  question_id: number | null
  outcome: AskOutcome
  answer: string | null
  citations: Citation[]
  referral: Office | null
  confidence: number | null
  disclaimer: string
}

// ---- Health ----

export interface HealthResponse {
  status: string
}

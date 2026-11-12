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

// ---- FAQs (workflow E) ----

export interface Faq {
  id: number
  question: string
  answer: string // Markdown; render with the same safe renderer as Ask answers
  topic: TopicRef | null
  sources: DocumentRef[] // researchers only get active documents
  updated_at: string // ISO 8601 timestamp
}

// Query parameters for GET /api/faqs
export interface FaqQuery {
  topic?: string // topic slug, for its topic page
}

export type FaqStatus = 'draft' | 'published' | 'archived'

export interface AdminFaq extends Faq {
  status: FaqStatus
  sort_order: number
  created_at: string // ISO 8601 timestamp
  updated_by: UserRef | null
}

// Query parameters for GET /api/admin/faqs
export interface AdminFaqQuery {
  status?: FaqStatus
  topic?: string
}

// POST /api/admin/faqs; creates a draft
export interface CreateFaqRequest {
  question: string // up to 500 characters
  answer: string // up to 10,000 characters
  topic_id?: number | null
  document_ids?: number[]
  sort_order?: number
}

// PATCH /api/admin/faqs/{id}; omitted fields are unchanged, document_ids replaces the whole list
export interface UpdateFaqRequest {
  question?: string
  answer?: string
  topic_id?: number | null // can't be null on a published FAQ
  document_ids?: number[]
  sort_order?: number
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

// ---- Admin analytics (workflow C) ----
// Aggregates only (NF6): no user ids or names anywhere.

// Query parameters for GET /api/admin/analytics and /api/admin/analytics/export.csv
export interface AnalyticsQuery {
  from?: string // "YYYY-MM-DD", inclusive, America/New_York
  to?: string // "YYYY-MM-DD", inclusive
}

export interface TextCount {
  text: string // trimmed, lowercased
  count: number
}

export interface TopicCount {
  topic: TopicRef
  count: number
}

export interface DocumentCount {
  document_id: number
  title: string
  count: number
}

export interface OfficeCount {
  office: Office
  count: number
}

export interface DailyActivity {
  date: string // "YYYY-MM-DD"
  logins: number
  topic_views: number
  document_views: number
  searches: number
  questions: number
}

export interface DailyTopicQuestions {
  date: string
  topic: TopicRef | null // null: asked without a topic
  count: number
}

export interface Analytics {
  from: string
  to: string
  min_distinct_users: number
  activity: { active_users: number; logins: number }
  interactions: { topic_views: number; document_views: number; searches: number; questions: number }
  top_topics: TopicCount[]
  top_documents: DocumentCount[]
  most_cited_documents: DocumentCount[]
  top_search_terms: TextCount[]
  zero_result_searches: { total: number; top_terms: TextCount[] }
  top_questions: TextCount[]
  // Includes 'error', unlike AskOutcome: the dashboard keeps LLM failures separate.
  questions_by_outcome: Record<AskOutcome | 'error', number>
  referrals_by_office: OfficeCount[]
  feedback: { rated: number; helpful: number; helpful_share: number | null }
  daily: DailyActivity[] // every day in the range, oldest first
  daily_questions_by_topic: DailyTopicQuestions[] // non-zero entries only
}

// ---- Health ----

export interface HealthResponse {
  status: string
}

// Data access for the researcher pages. Each function has the shape of its endpoint in
// docs/api.md but returns fake data for now. When the endpoint exists, replace the body with the
// apiGet/apiPost call in its comment; the pages shouldn't need to change.
import { ApiError } from '../../api/client'
import type {
  AskRequest,
  AskResponse,
  Citation,
  DocumentDetail,
  DocumentQuery,
  DocumentSummary,
  Page,
  Topic,
  TopicDetail,
} from '../../api/types'
import { fakeDisclaimer, fakeDocuments, fakeTopics, fallbackOffice } from './fakeData'

// A short delay so loading states show up in the demo, as they would with a real request.
function fakeLatency(ms = 250) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function toSummary({ content_text: _content, ...summary }: DocumentDetail): DocumentSummary {
  return summary
}

// apiGet<Topic[]>('/topics')
export async function getTopics(): Promise<Topic[]> {
  await fakeLatency()
  return fakeTopics.map(({ office: _office, ...topic }) => topic)
}

// apiGet<TopicDetail>(`/topics/${encodeURIComponent(slug)}`)
export async function getTopic(slug: string): Promise<TopicDetail> {
  await fakeLatency()
  const topic = fakeTopics.find((t) => t.slug === slug)
  if (!topic) {
    throw new ApiError('GET', `/topics/${slug}`, 404, 'Topic not found')
  }
  return topic
}

const STOP_WORDS = new Set([
  'about', 'does', 'from', 'have', 'need', 'should', 'that', 'there', 'this', 'what', 'when',
  'where', 'which', 'with', 'would', 'your',
])

function keywords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
}

// Number of query keywords that appear in the document. A rough stand-in for full-text search.
function score(doc: DocumentDetail, terms: string[]): number {
  const haystack = `${doc.title} ${doc.summary ?? ''} ${doc.content_text}`.toLowerCase()
  return terms.filter((term) => haystack.includes(term)).length
}

// apiGet<Page<DocumentSummary>>(`/documents?${new URLSearchParams(...)}`)
export async function getDocuments(query: DocumentQuery): Promise<Page<DocumentSummary>> {
  await fakeLatency()
  const { topic, q, limit = 20, offset = 0 } = query
  let docs = fakeDocuments.filter((doc) => !topic || doc.topics.some((t) => t.slug === topic))
  const terms = q ? keywords(q) : []
  if (terms.length > 0) {
    docs = docs
      .map((doc) => ({ doc, score: score(doc, terms) }))
      .filter((match) => match.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((match) => match.doc)
  } else if (q) {
    docs = []
  } else {
    docs = [...docs].sort((a, b) => a.title.localeCompare(b.title))
  }
  return { items: docs.slice(offset, offset + limit).map(toSummary), total: docs.length }
}

function toCitation(doc: DocumentDetail, number: number): Citation {
  return {
    number,
    document_id: doc.id,
    title: doc.title,
    section: null,
    source_url: doc.source_url,
    snippet: doc.content_text,
  }
}

// apiPost<AskResponse>('/ask', request)
// Mimics stretch level 2 (top sources, no generated answer), plus one canned level 3 answer for
// the IRB example question so the demo can show an answer with citations.
export async function ask(request: AskRequest): Promise<AskResponse> {
  await fakeLatency(600)
  const terms = keywords(request.question)
  const matches = fakeDocuments
    .filter((doc) => !request.topic || doc.topics.some((t) => t.slug === request.topic))
    .map((doc) => ({ doc, score: score(doc, terms) }))
    .filter((match) => match.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((match) => match.doc)

  if (matches.length === 0) {
    const topic = fakeTopics.find((t) => t.slug === request.topic)
    return {
      question_id: null,
      outcome: 'referred',
      answer: "Nora couldn't find sources that answer this question confidently.",
      citations: [],
      referral: topic?.office ?? fallbackOffice,
      confidence: null,
      disclaimer: fakeDisclaimer,
    }
  }

  if (terms.includes('irb')) {
    const sources = [1, 2, 3].map((id) => fakeDocuments.find((doc) => doc.id === id)!)
    return {
      question_id: null,
      outcome: 'answered',
      answer:
        'You may need IRB approval for your study. Research involving living individuals or ' +
        'identifiable private information typically requires IRB review if it meets the ' +
        'federal definition of human subjects research [1][3]. If your study uses existing ' +
        'data that are de-identified and you cannot link the data to individuals, IRB review ' +
        'may not be required [2].',
      citations: sources.map((doc, index) => toCitation(doc, index + 1)),
      referral: null,
      confidence: 0.82,
      disclaimer: fakeDisclaimer,
    }
  }

  return {
    question_id: null,
    outcome: 'answered',
    answer: null,
    citations: matches.map((doc, index) => toCitation(doc, index + 1)),
    referral: null,
    confidence: null,
    disclaimer: fakeDisclaimer,
  }
}

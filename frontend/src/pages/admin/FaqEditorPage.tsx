import { type FormEvent, type KeyboardEvent, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { ApiError } from '../../api/client'
import type { AdminDocument, AdminFaq, DocumentRef, Topic } from '../../api/types'
import { docTypeLabels } from '../../components/docType'
import { Icon } from '../../components/Icon'
import { MarkdownText } from '../../components/MarkdownText'
import { useLoad } from '../researcher/useLoad'
import { StatusBadge } from './AdminDocumentTable'
import './admin.css'
import { formatDate } from './adminFormat'
import {
  changeFaqStatus,
  createFaq,
  deleteFaq,
  getAdminFaq,
  getTopics,
  type LifecycleAction,
  listAdminDocuments,
  updateFaq,
} from './adminApi'

const MAX_QUESTION = 500
const MAX_ANSWER = 10_000
const SOURCE_RESULTS = 10

// Writing one FAQ and moving it through draft → published → archived (F8, NF7).
// Routes: /admin/faqs/new (a new draft) and /admin/faqs/:id
export default function FaqEditorPage() {
  const id = useParams().id ?? ''
  const isNew = id === 'new'
  const page = useLoad(id, () =>
    Promise.all([isNew ? Promise.resolve(null) : getAdminFaq(id), getTopics()]),
  )

  return (
    <div className="admin-page">
      <Link to="/admin/faqs" className="admin-back">
        <Icon name="arrowLeft" size={16} /> FAQs
      </Link>
      {page.status === 'loading' && <p className="admin-status">Loading…</p>}
      {page.status === 'error' && (
        <p className="admin-status admin-status--error">
          {page.error instanceof ApiError && (page.error.status === 404 || page.error.status === 422)
            ? 'This FAQ was not found.'
            : "This FAQ couldn't be loaded."}
        </p>
      )}
      {page.status === 'ready' && <Editor key={id} initial={page.data[0]} topics={page.data[1]} />}
    </div>
  )
}

interface FormState {
  question: string
  answer: string
  topic_id: number | null
  sources: DocumentRef[]
  sort_order: number
}

const EMPTY_FORM: FormState = { question: '', answer: '', topic_id: null, sources: [], sort_order: 0 }

function formFrom(faq: AdminFaq | null): FormState {
  if (!faq) return EMPTY_FORM
  return {
    question: faq.question,
    answer: faq.answer,
    topic_id: faq.topic?.id ?? null,
    sources: faq.sources,
    sort_order: faq.sort_order,
  }
}

function sameForm(a: FormState, b: FormState): boolean {
  const ids = (sources: DocumentRef[]) => sources.map((s) => s.id).join(',')
  return (
    a.question === b.question &&
    a.answer === b.answer &&
    a.topic_id === b.topic_id &&
    a.sort_order === b.sort_order &&
    ids(a.sources) === ids(b.sources)
  )
}

type Message = { kind: 'success' | 'error'; text: string } | null

function errorText(error: unknown, fallback: string): string {
  return (error instanceof ApiError && error.detail) || fallback
}

function Editor({ initial, topics }: { initial: AdminFaq | null; topics: Topic[] }) {
  const navigate = useNavigate()
  const created = (useLocation().state as { created?: boolean } | null)?.created
  const [faq, setFaq] = useState(initial)
  const [form, setForm] = useState(() => formFrom(initial))
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<Message>(
    created ? { kind: 'success', text: 'Saved as a draft. Researchers see it once it’s published.' } : null,
  )
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const dirty = !sameForm(form, formFrom(faq))
  const complete = form.question.trim() !== '' && form.answer.trim() !== ''

  // Runs one API call that returns the updated FAQ, and shows how it went.
  async function run(call: () => Promise<AdminFaq>, success: string, failure: string) {
    setPending(true)
    setMessage(null)
    try {
      const updated = await call()
      setFaq(updated)
      setForm(formFrom(updated))
      setMessage({ kind: 'success', text: success })
    } catch (error) {
      setMessage({ kind: 'error', text: errorText(error, failure) })
    } finally {
      setPending(false)
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    const request = {
      question: form.question.trim(),
      answer: form.answer.trim(),
      topic_id: form.topic_id,
      document_ids: form.sources.map((source) => source.id),
      sort_order: form.sort_order,
    }
    if (faq) {
      run(() => updateFaq(faq.id, request), 'Changes saved.', "The changes couldn't be saved.")
      return
    }
    setPending(true)
    setMessage(null)
    try {
      const draft = await createFaq(request)
      navigate(`/admin/faqs/${draft.id}`, { replace: true, state: { created: true } })
    } catch (error) {
      setMessage({ kind: 'error', text: errorText(error, "The FAQ couldn't be saved.") })
      setPending(false)
    }
  }

  async function remove(id: number) {
    setPending(true)
    setMessage(null)
    try {
      await deleteFaq(id)
      navigate('/admin/faqs', { replace: true })
    } catch (error) {
      setMessage({ kind: 'error', text: errorText(error, "The FAQ couldn't be deleted.") })
      setPending(false)
      setConfirmingDelete(false)
    }
  }

  const lifecycle: Record<LifecycleAction, string> = {
    publish: 'Published. Researchers can now see this FAQ.',
    archive: 'Archived. Researchers no longer see this FAQ.',
    restore: 'Restored as a draft. Review it and publish it again.',
  }

  return (
    <>
      <header className="admin-doc-header">
        {faq && (
          <div className="admin-doc-header__meta">
            <StatusBadge status={faq.status} />
          </div>
        )}
        <h1>{faq ? faq.question : 'New FAQ'}</h1>
        <p className="admin-page__intro">
          {faq
            ? `Updated ${formatDate(faq.updated_at)}${faq.updated_by ? ` by ${faq.updated_by.display_name ?? faq.updated_by.onyen}` : ''}`
            : 'Saved as a draft. Researchers see it only once it’s published.'}
        </p>
      </header>

      <div aria-live="polite">
        {message && (
          <p
            className={message.kind === 'error' ? 'admin-message admin-message--error' : 'admin-message'}
            role={message.kind === 'error' ? 'alert' : undefined}
          >
            {message.text}
          </p>
        )}
      </div>

      <div className="admin-doc-layout">
        <form className="admin-panel" onSubmit={save} aria-labelledby="faq-details">
          <h2 id="faq-details">Question and answer</h2>

          <label className="admin-field">
            <span>Question</span>
            <input
              type="text"
              required
              maxLength={MAX_QUESTION}
              value={form.question}
              onChange={(event) => setForm({ ...form, question: event.target.value })}
            />
          </label>

          <label className="admin-field">
            <span>Answer</span>
            <textarea
              required
              rows={8}
              maxLength={MAX_ANSWER}
              value={form.answer}
              aria-describedby="answer-help"
              onChange={(event) => setForm({ ...form, answer: event.target.value })}
            />
          </label>
          <p id="answer-help" className="admin-hint">
            Write in plain language. Start a new line for each paragraph, “- ” for a list item, and **bold**
            for emphasis. Answers are guidance; point to the source policies below.
          </p>
          {form.answer.trim() && (
            <div className="admin-preview" aria-label="Answer preview">
              <p className="admin-preview__label">Preview</p>
              <MarkdownText text={form.answer} />
            </div>
          )}

          <label className="admin-field">
            <span>Topic</span>
            <select
              value={form.topic_id ?? ''}
              onChange={(event) =>
                setForm({ ...form, topic_id: event.target.value ? Number(event.target.value) : null })
              }
            >
              <option value="">No topic</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.name}
                </option>
              ))}
            </select>
          </label>

          <SourcePicker
            sources={form.sources}
            onChange={(sources) => setForm({ ...form, sources })}
          />

          <label className="admin-field">
            <span>Display order</span>
            <input
              type="number"
              step={1}
              value={form.sort_order}
              aria-describedby="order-help"
              onChange={(event) => setForm({ ...form, sort_order: Math.trunc(Number(event.target.value)) || 0 })}
            />
          </label>
          <p id="order-help" className="admin-hint">
            Lower numbers show first; FAQs with the same number are ordered by question.
          </p>

          <div className="admin-actions">
            <button type="submit" className="button" disabled={!complete || (faq !== null && !dirty) || pending}>
              {faq ? 'Save changes' : 'Save draft'}
            </button>
            {faq ? (
              <button
                type="button"
                className="button button--secondary"
                disabled={!dirty || pending}
                onClick={() => setForm(formFrom(faq))}
              >
                Discard
              </button>
            ) : (
              <Link to="/admin/faqs" className="button button--secondary">
                Cancel
              </Link>
            )}
          </div>
        </form>

        {faq && (
          <section className="admin-panel" aria-labelledby="faq-status">
            <h2 id="faq-status">Status</h2>
            {faq.status === 'draft' && (
              <p className="admin-panel__help">
                Researchers don't see drafts. {faq.topic ? 'Ready to publish.' : 'Choose a topic and save before publishing.'}
              </p>
            )}
            {faq.status === 'published' && (
              <p className="admin-panel__help">Published: researchers see it on the FAQ page and its topic page.</p>
            )}
            {faq.status === 'archived' && (
              <p className="admin-panel__help">Archived: hidden from researchers, but kept.</p>
            )}
            {dirty && <p className="admin-hint">Save or discard your changes first.</p>}

            <div className="admin-actions">
              {faq.status === 'draft' && (
                <button
                  type="button"
                  className="button"
                  disabled={dirty || pending || !faq.topic}
                  onClick={() => run(() => changeFaqStatus(faq.id, 'publish'), lifecycle.publish, "The FAQ couldn't be published.")}
                >
                  Publish
                </button>
              )}
              {faq.status !== 'archived' && (
                <button
                  type="button"
                  className="button button--secondary"
                  disabled={dirty || pending}
                  onClick={() => run(() => changeFaqStatus(faq.id, 'archive'), lifecycle.archive, "The FAQ couldn't be archived.")}
                >
                  Archive
                </button>
              )}
              {faq.status === 'archived' && (
                <>
                  <button
                    type="button"
                    className="button"
                    disabled={dirty || pending}
                    onClick={() => run(() => changeFaqStatus(faq.id, 'restore'), lifecycle.restore, "The FAQ couldn't be restored.")}
                  >
                    Restore as draft
                  </button>
                  <button
                    type="button"
                    className="button button--danger"
                    disabled={dirty || pending}
                    onClick={() => setConfirmingDelete(true)}
                  >
                    Delete permanently
                  </button>
                </>
              )}
            </div>

            {confirmingDelete && (
              <div className="admin-confirm" role="alertdialog" aria-labelledby="confirm-title" aria-describedby="confirm-text">
                <p id="confirm-title" className="admin-confirm__title">
                  Permanently delete “{faq.question}”?
                </p>
                <p id="confirm-text">This removes the FAQ and its source links for good. It can't be undone.</p>
                <div className="admin-actions">
                  <button type="button" className="button button--danger" disabled={pending} onClick={() => remove(faq.id)}>
                    Yes, delete permanently
                  </button>
                  <button type="button" className="button button--secondary" autoFocus onClick={() => setConfirmingDelete(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </>
  )
}

// The policies an answer is based on: chips for the chosen ones, and a search over every
// document to add more. Researchers only see the published ones.
function SourcePicker({ sources, onChange }: { sources: DocumentRef[]; onChange: (sources: DocumentRef[]) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AdminDocument[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [failed, setFailed] = useState(false)
  const chosen = new Set(sources.map((source) => source.id))

  // Not a nested <form>: this sits inside the FAQ form, so Enter here mustn't submit that.
  async function search() {
    const q = query.trim()
    if (!q) return
    setSearching(true)
    setFailed(false)
    try {
      setResults((await listAdminDocuments({ q, limit: SOURCE_RESULTS })).items)
    } catch {
      setFailed(true)
      setResults(null)
    } finally {
      setSearching(false)
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      search()
    }
  }

  function add(document: AdminDocument) {
    onChange([
      ...sources,
      { id: document.id, title: document.title, doc_type: document.doc_type, citation: document.citation },
    ])
  }

  return (
    <fieldset className="admin-fieldset">
      <legend>Source policies</legend>
      {sources.length > 0 ? (
        <ul className="admin-tags">
          {sources.map((source) => (
            <li key={source.id}>
              {source.title}
              <button
                type="button"
                aria-label={`Remove ${source.title}`}
                onClick={() => onChange(sources.filter((s) => s.id !== source.id))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="admin-hint">No sources yet. Researchers see only published policies.</p>
      )}

      <div className="admin-filters">
        <label className="admin-field admin-field--grow">
          <span>Find a policy</span>
          <input
            type="search"
            value={query}
            placeholder="Title, text, topic or tag"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
          />
        </label>
        <button type="button" className="button button--secondary" disabled={searching} onClick={search}>
          Search
        </button>
      </div>

      <div aria-live="polite">
        {searching && <p className="admin-hint">Searching…</p>}
        {failed && <p className="admin-hint admin-status--error">The search didn't work. Try again.</p>}
        {!searching && results?.length === 0 && <p className="admin-hint">No policies match.</p>}
        {!searching && results && results.length > 0 && (
          <ul className="admin-source-results">
            {results.map((document) => (
              <li key={document.id}>
                <span>
                  {document.title}
                  <span className="admin-table__sub">
                    {docTypeLabels[document.doc_type]}
                    {document.status !== 'active' && ' · not visible to researchers'}
                  </span>
                </span>
                <span className="admin-source-results__action">
                  <StatusBadge status={document.status} />
                  <button
                    type="button"
                    className="button button--secondary"
                    disabled={chosen.has(document.id)}
                    onClick={() => add(document)}
                  >
                    {chosen.has(document.id) ? 'Added' : 'Add'}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </fieldset>
  )
}

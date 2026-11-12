import { type FormEvent, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError } from '../../api/client'
import type { AdminDocumentDetail, DocType, Office, Tag, Topic, UpdateDocumentRequest } from '../../api/types'
import { docTypeLabels } from '../../components/docType'
import { Icon } from '../../components/Icon'
import { useLoad } from '../researcher/useLoad'
import { StatusBadge } from './AdminDocumentTable'
import './admin.css'
import { formatDate } from './adminFormat'
import { changeStatus, deleteDocument, getAdminDocument, getOffices, getTags, getTopics, type LifecycleAction, updateDocument } from './adminApi'

const MAX_TAGS = 5 // the Link's limit per document

// One document's metadata and status (F12, NF7). Route: /admin/documents/:id
// Admins edit metadata only; the title and text come from the Repository.
export default function DocumentEditorPage() {
  const id = useParams().id ?? ''
  const page = useLoad(id, () => Promise.all([getAdminDocument(id), getOffices(), getTopics(), getTags()]))

  return (
    <div className="admin-page">
      <Link to="/admin/library" className="admin-back">
        <Icon name="arrowLeft" size={16} /> Policy Library
      </Link>
      {page.status === 'loading' && <p className="admin-status">Loading…</p>}
      {page.status === 'error' && (
        <p className="admin-status admin-status--error">
          {page.error instanceof ApiError && (page.error.status === 404 || page.error.status === 422)
            ? 'This document was not found.'
            : "This document couldn't be loaded."}
        </p>
      )}
      {page.status === 'ready' && (
        <Editor
          key={page.data[0].id}
          initial={page.data[0]}
          offices={page.data[1]}
          topics={page.data[2]}
          tags={page.data[3]}
        />
      )}
    </div>
  )
}

interface FormState {
  doc_type: DocType
  office_id: number | null
  topic_ids: number[]
  tag_ids: number[]
  is_authoritative: boolean
}

function formFrom(doc: AdminDocumentDetail): FormState {
  return {
    doc_type: doc.doc_type,
    office_id: doc.office?.id ?? null,
    topic_ids: doc.topics.map((t) => t.id),
    tag_ids: doc.tags.map((t) => t.id),
    is_authoritative: doc.is_authoritative,
  }
}

function sameForm(a: FormState, b: FormState): boolean {
  const sorted = (ids: number[]) => [...ids].sort((x, y) => x - y).join(',')
  return (
    a.doc_type === b.doc_type &&
    a.office_id === b.office_id &&
    a.is_authoritative === b.is_authoritative &&
    sorted(a.topic_ids) === sorted(b.topic_ids) &&
    sorted(a.tag_ids) === sorted(b.tag_ids)
  )
}

type Message = { kind: 'success' | 'error'; text: string } | null

function errorText(error: unknown, fallback: string): string {
  return (error instanceof ApiError && error.detail) || fallback
}

function Editor({
  initial,
  offices,
  topics,
  tags,
}: {
  initial: AdminDocumentDetail
  offices: Office[]
  topics: Topic[]
  tags: Tag[]
}) {
  const navigate = useNavigate()
  const [doc, setDoc] = useState(initial)
  const [form, setForm] = useState(() => formFrom(initial))
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<Message>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const dirty = !sameForm(form, formFrom(doc))
  const tagsById = new Map(tags.map((tag) => [tag.id, tag]))

  // Runs one API call that returns the updated document, and shows how it went.
  async function run(call: () => Promise<AdminDocumentDetail>, success: string, failure: string) {
    setPending(true)
    setMessage(null)
    try {
      const updated = await call()
      setDoc(updated)
      setForm(formFrom(updated))
      setMessage({ kind: 'success', text: success })
    } catch (error) {
      setMessage({ kind: 'error', text: errorText(error, failure) })
    } finally {
      setPending(false)
    }
  }

  function save(event: FormEvent) {
    event.preventDefault()
    const request: UpdateDocumentRequest = { ...form }
    run(() => updateDocument(doc.id, request), 'Changes saved.', "The changes couldn't be saved.")
  }

  const lifecycle: Record<LifecycleAction, string> = {
    publish: 'Published. Researchers can now see this document.',
    archive: 'Archived. Researchers and answers no longer see this document.',
    restore: 'Restored as a draft. Review it and publish it again.',
  }
  function act(action: LifecycleAction) {
    run(() => changeStatus(doc.id, action), lifecycle[action], `The document couldn't be updated.`)
  }

  async function remove() {
    setPending(true)
    setMessage(null)
    try {
      await deleteDocument(doc.id)
      navigate('/admin/library', { replace: true })
    } catch (error) {
      setMessage({ kind: 'error', text: errorText(error, "The document couldn't be deleted.") })
      setPending(false)
      setConfirmingDelete(false)
    }
  }

  function toggle(list: number[], id: number): number[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
  }

  // Publishing needs an office and a topic (the backend checks too).
  const missing = [!doc.office && 'an office', doc.topics.length === 0 && 'a topic'].filter(Boolean)

  return (
    <>
      <header className="admin-doc-header">
        <div className="admin-doc-header__meta">
          <StatusBadge status={doc.status} />
          <span className="badge">{docTypeLabels[doc.doc_type]}</span>
          {doc.citation && <span className="admin-table__sub">{doc.citation}</span>}
        </div>
        <h1>{doc.title}</h1>
        <p className="admin-page__intro">
          {doc.source_url && (
            <>
              <a href={doc.source_url} target="_blank" rel="noreferrer">
                View in the Repository <Icon name="external" size={14} />
              </a>
              {' · '}
            </>
          )}
          Updated {formatDate(doc.updated_at)}
          {doc.updated_by && ` by ${doc.updated_by.display_name ?? doc.updated_by.onyen}`}
        </p>
      </header>

      <div aria-live="polite">
        {message && (
          <p className={message.kind === 'error' ? 'admin-message admin-message--error' : 'admin-message'} role={message.kind === 'error' ? 'alert' : undefined}>
            {message.text}
          </p>
        )}
      </div>

      <div className="admin-doc-layout">
        <form className="admin-panel" onSubmit={save} aria-labelledby="metadata">
          <h2 id="metadata">Details</h2>

          <label className="admin-field">
            <span>Type</span>
            <select
              value={form.doc_type}
              onChange={(event) => setForm({ ...form, doc_type: event.target.value as DocType })}
            >
              {(Object.keys(docTypeLabels) as DocType[]).map((type) => (
                <option key={type} value={type}>
                  {docTypeLabels[type]}
                </option>
              ))}
            </select>
          </label>

          <label className="admin-field">
            <span>Owning office</span>
            <select
              value={form.office_id ?? ''}
              onChange={(event) =>
                setForm({ ...form, office_id: event.target.value ? Number(event.target.value) : null })
              }
            >
              <option value="">No office</option>
              {offices.map((office) => (
                <option key={office.id} value={office.id}>
                  {office.name}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="admin-fieldset">
            <legend>Topics</legend>
            <div className="admin-checks">
              {topics.map((topic) => (
                <label key={topic.id} className="admin-check">
                  <input
                    type="checkbox"
                    checked={form.topic_ids.includes(topic.id)}
                    onChange={() => setForm({ ...form, topic_ids: toggle(form.topic_ids, topic.id) })}
                  />
                  {topic.name}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="admin-fieldset">
            <legend>
              Subtopic tags <span className="admin-hint">(up to {MAX_TAGS})</span>
            </legend>
            {form.tag_ids.length > 0 ? (
              <ul className="admin-tags">
                {form.tag_ids.map((tagId) => (
                  <li key={tagId}>
                    {tagsById.get(tagId)?.name ?? `Tag ${tagId}`}
                    <button
                      type="button"
                      aria-label={`Remove ${tagsById.get(tagId)?.name ?? `tag ${tagId}`}`}
                      onClick={() => setForm({ ...form, tag_ids: toggle(form.tag_ids, tagId) })}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="admin-hint">No tags yet.</p>
            )}
            <label className="admin-field">
              <span className="visually-hidden">Add a tag</span>
              <select
                value=""
                disabled={form.tag_ids.length >= MAX_TAGS}
                onChange={(event) =>
                  setForm({ ...form, tag_ids: [...form.tag_ids, Number(event.target.value)] })
                }
              >
                <option value="">
                  {form.tag_ids.length >= MAX_TAGS ? `${MAX_TAGS} tags is the most` : 'Add a tag…'}
                </option>
                {tags
                  .filter((tag) => !form.tag_ids.includes(tag.id))
                  .map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
              </select>
            </label>
          </fieldset>

          <label className="admin-check">
            <input
              type="checkbox"
              checked={form.is_authoritative}
              onChange={(event) => setForm({ ...form, is_authoritative: event.target.checked })}
            />
            Official source: Ask may use it in answers
          </label>

          <div className="admin-actions">
            <button type="submit" className="button" disabled={!dirty || pending}>
              Save changes
            </button>
            <button
              type="button"
              className="button button--secondary"
              disabled={!dirty || pending}
              onClick={() => setForm(formFrom(doc))}
            >
              Discard
            </button>
          </div>
        </form>

        <section className="admin-panel" aria-labelledby="status">
          <h2 id="status">Status</h2>
          {doc.status === 'draft' && (
            <p className="admin-panel__help">
              Researchers don't see drafts.{' '}
              {missing.length > 0 ? `Add ${missing.join(' and ')} and save before publishing.` : 'Ready to publish.'}
            </p>
          )}
          {doc.status === 'active' && <p className="admin-panel__help">Published: researchers can see it.</p>}
          {doc.status === 'archived' && (
            <p className="admin-panel__help">Archived: hidden from researchers and answers, but kept.</p>
          )}
          {dirty && <p className="admin-hint">Save or discard your changes first.</p>}

          <div className="admin-actions">
            {doc.status === 'draft' && (
              <button type="button" className="button" disabled={dirty || pending || missing.length > 0} onClick={() => act('publish')}>
                Publish
              </button>
            )}
            {doc.status !== 'archived' && (
              <button type="button" className="button button--secondary" disabled={dirty || pending} onClick={() => act('archive')}>
                Archive
              </button>
            )}
            {doc.status === 'archived' && (
              <>
                <button type="button" className="button" disabled={dirty || pending} onClick={() => act('restore')}>
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
                Permanently delete “{doc.title}”?
              </p>
              <p id="confirm-text">
                This removes it from Nora for good, with its search and answer data. It can't be undone. The
                Repository's copy isn't affected.
              </p>
              <div className="admin-actions">
                <button type="button" className="button button--danger" disabled={pending} onClick={remove}>
                  Yes, delete permanently
                </button>
                <button type="button" className="button button--secondary" autoFocus onClick={() => setConfirmingDelete(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      <details className="admin-panel admin-text" open={doc.status === 'draft'}>
        <summary>Text from the Repository</summary>
        <p className="admin-panel__help">
          Check that this matches the Repository before publishing. Ask answers from this text.
        </p>
        <pre>{doc.content_text || 'No text was found.'}</pre>
      </details>
    </>
  )
}

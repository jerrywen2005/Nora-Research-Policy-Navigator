import { type FormEvent, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import type { DocumentStatus } from '../../api/types'
import { useLoad } from '../researcher/useLoad'
import { AdminDocumentTable } from './AdminDocumentTable'
import './admin.css'
import { statusLabels } from './adminFormat'
import { getTopics, listAdminDocuments } from './adminApi'

const PAGE_SIZE = 20
const STATUSES: DocumentStatus[] = ['draft', 'active', 'archived']

// Every document, of any status, with keyword search and status and topic filters (F12).
// Route: /admin/library?q=&status=&topic=&page=
// The filters live in the URL, so a filtered view can be bookmarked or shared.
export default function PolicyLibraryPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const status = (params.get('status') ?? '') as DocumentStatus | ''
  const topic = params.get('topic') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [draftQuery, setDraftQuery] = useState(q)

  const topics = useLoad('topics', getTopics)
  const results = useLoad(params.toString(), () =>
    listAdminDocuments({
      q,
      status: status || undefined,
      topic,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
  )

  // Changing a filter goes back to the first page.
  function update(changes: Record<string, string>) {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    if (!('page' in changes)) next.delete('page')
    setParams(next)
  }

  function search(event: FormEvent) {
    event.preventDefault()
    update({ q: draftQuery.trim() })
  }

  return (
    <div className="admin-page">
      <div className="admin-page__heading">
        <h1>Policy Library</h1>
        <Link to="/admin/content" className="button">
          Add a document
        </Link>
      </div>
      <p className="admin-page__intro">
        Every document in Nora, in any status. Open one to edit its topics, tags, office and status.
      </p>

      <form className="admin-filters" role="search" onSubmit={search}>
        <label className="admin-field admin-field--grow">
          <span>Search</span>
          <input
            type="search"
            value={draftQuery}
            placeholder="Title, text, topic or tag"
            onChange={(event) => setDraftQuery(event.target.value)}
          />
        </label>
        <label className="admin-field">
          <span>Status</span>
          <select value={status} onChange={(event) => update({ status: event.target.value })}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabels[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-field">
          <span>Topic</span>
          <select value={topic} onChange={(event) => update({ topic: event.target.value })}>
            <option value="">All topics</option>
            {topics.status === 'ready' &&
              topics.data.map((t) => (
                <option key={t.id} value={t.slug}>
                  {t.name}
                </option>
              ))}
          </select>
        </label>
        <button type="submit" className="button">
          Search
        </button>
      </form>

      <div aria-live="polite">
        {results.status === 'loading' && <p className="admin-status">Loading…</p>}
        {results.status === 'error' && (
          <p className="admin-status admin-status--error">The documents couldn't be loaded.</p>
        )}
        {results.status === 'ready' && (
          <>
            <p className="admin-status">
              {results.data.total === 0
                ? 'No documents match.'
                : `Showing ${(page - 1) * PAGE_SIZE + 1}–${(page - 1) * PAGE_SIZE + results.data.items.length} of ${results.data.total}`}
            </p>
            {results.data.items.length > 0 && (
              <AdminDocumentTable documents={results.data.items} caption="Documents" />
            )}
            {results.data.total > PAGE_SIZE && (
              <nav className="admin-pager" aria-label="Pages">
                <button
                  type="button"
                  className="button button--secondary"
                  disabled={page === 1}
                  onClick={() => update({ page: String(page - 1) })}
                >
                  Previous
                </button>
                <span>
                  Page {page} of {Math.ceil(results.data.total / PAGE_SIZE)}
                </span>
                <button
                  type="button"
                  className="button button--secondary"
                  disabled={page * PAGE_SIZE >= results.data.total}
                  onClick={() => update({ page: String(page + 1) })}
                >
                  Next
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  )
}

import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ApiError } from '../../api/client'
import { useLoad } from '../researcher/useLoad'
import { AdminDocumentTable } from './AdminDocumentTable'
import './admin.css'
import { importDocument, listAdminDocuments } from './adminApi'

// Adding content and reviewing it (F12). Route: /admin/content
// A document is added by its Research Policy Repository link and lands as a draft; drafts wait
// below until an admin opens one, checks it and publishes it.
export default function ContentManagementPage() {
  const navigate = useNavigate()
  const [url, setUrl] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<{ message: string; existingId: string | null } | null>(null)
  const drafts = useLoad('drafts', () => listAdminDocuments({ status: 'draft', limit: 100 }))

  async function add(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      const document = await importDocument(url.trim())
      navigate(`/admin/documents/${document.id}`)
    } catch (caught) {
      const detail = caught instanceof ApiError ? caught.detail : null
      // A duplicate's detail names the existing document: "This article is already document 12".
      const existingId = caught instanceof ApiError && caught.status === 409 ? (detail?.match(/\d+$/)?.[0] ?? null) : null
      setError({ message: detail ?? "The document couldn't be added. Try again.", existingId })
      setPending(false)
    }
  }

  return (
    <div className="admin-page">
      <h1>Content Management</h1>
      <p className="admin-page__intro">
        Add documents from the Research Policy Repository and review drafts before researchers see them.
      </p>

      <section className="admin-panel" aria-labelledby="add-document">
        <h2 id="add-document">Add a document</h2>
        <p className="admin-panel__help">
          Paste the policy's link from{' '}
          <a href="https://policies.unc.edu/TDClient/2833/Portal/KB/Category/21680/Research" target="_blank" rel="noreferrer">
            the Research Policy Repository
          </a>
          . Nora copies its title and text and saves it as a draft. The Repository stays the official text, so it
          isn't edited here.
        </p>
        <form className="admin-filters" onSubmit={add}>
          <label className="admin-field admin-field--grow">
            <span>Repository link</span>
            <input
              type="url"
              required
              value={url}
              placeholder="https://policies.unc.edu/TDClient/2833/Portal/KB/Article/…"
              onChange={(event) => setUrl(event.target.value)}
            />
          </label>
          <button type="submit" className="button" disabled={pending}>
            {pending ? 'Adding…' : 'Add as draft'}
          </button>
        </form>
        {error && (
          <p role="alert" className="admin-status admin-status--error">
            {error.message}
            {error.existingId && (
              <>
                {' '}
                <Link to={`/admin/documents/${error.existingId}`}>Open document {error.existingId}</Link>
              </>
            )}
          </p>
        )}
      </section>

      <section className="admin-panel" aria-labelledby="drafts">
        <h2 id="drafts">Drafts to review</h2>
        <p className="admin-panel__help">
          Researchers don't see drafts. Open one to check its text, set its office, topics and tags, and publish it.
        </p>
        {drafts.status === 'loading' && <p className="admin-status">Loading…</p>}
        {drafts.status === 'error' && (
          <p className="admin-status admin-status--error">The drafts couldn't be loaded.</p>
        )}
        {drafts.status === 'ready' &&
          (drafts.data.items.length === 0 ? (
            <p className="admin-status">No drafts waiting for review.</p>
          ) : (
            <AdminDocumentTable documents={drafts.data.items} caption="Drafts to review" />
          ))}
      </section>
    </div>
  )
}

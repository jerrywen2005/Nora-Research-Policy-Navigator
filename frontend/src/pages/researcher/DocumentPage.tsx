import { Link, useParams } from 'react-router'
import { ApiError } from '../../api/client'
import { docTypeLabels } from '../../components/docType'
import { Icon } from '../../components/Icon'
import { OfficeContact } from '../../components/OfficeContact'
import { SaveButton } from '../../components/SaveButton'
import { TagList } from '../../components/TagList'
import './researcher.css'
import { getDocument } from './researcherApi'
import { useLoad } from './useLoad'

// One document (F3): its summary, owning office, topics, subtopic tags, related policies and a
// link to the Repository. The Repository holds the official text, so the page doesn't copy it.
// Route: /documents/:id
export default function DocumentPage() {
  const id = useParams().id ?? ''
  const page = useLoad(id, () => getDocument(id))

  if (page.status === 'loading') {
    return (
      <div className="researcher">
        <p className="status">Loading…</p>
      </div>
    )
  }
  if (page.status === 'error') {
    // A non-numeric id fails validation (422); to the reader it's just not found.
    const notFound =
      page.error instanceof ApiError && (page.error.status === 404 || page.error.status === 422)
    return (
      <div className="researcher">
        <Link to="/browse" className="text-link back-link">
          <Icon name="arrowLeft" size={16} /> All topics
        </Link>
        <p className="status status--error">
          {notFound ? 'This document was not found.' : "This document couldn't be loaded."}
        </p>
      </div>
    )
  }

  const doc = page.data
  const topic = doc.topics[0]
  return (
    <div className="researcher">
      <Link to={topic ? `/browse/${topic.slug}` : '/browse'} className="text-link back-link">
        <Icon name="arrowLeft" size={16} /> {topic ? topic.name : 'All topics'}
      </Link>

      <header className="document-header">
        <div className="result-card__meta">
          <span className="badge">{docTypeLabels[doc.doc_type]}</span>
          {doc.is_authoritative && <span className="badge badge--authoritative">Official</span>}
          {doc.citation && <span className="result-card__citation">{doc.citation}</span>}
        </div>
        <h1 className="page-header__title">{doc.title}</h1>
        <SaveButton target={{ document_id: doc.id }} name={doc.title} />
      </header>

      <div className="researcher-layout">
        <div className="researcher-main">
          <section className="panel" aria-labelledby="document-summary">
            <h2 id="document-summary" className="panel__title">
              Summary
            </h2>
            {doc.summary ? (
              <p className="document-summary">{doc.summary}</p>
            ) : (
              <p className="status">No summary yet. See the full text in the Repository.</p>
            )}
            {doc.source_url && (
              <>
                <a className="button" href={doc.source_url} target="_blank" rel="noreferrer">
                  Read the full text in the Repository <Icon name="external" size={16} />
                </a>
                <p className="document-note">
                  The Research Policy Repository has the official, current text.
                </p>
              </>
            )}
            {doc.last_reviewed_at && (
              <p className="document-note">Last reviewed {doc.last_reviewed_at}</p>
            )}
          </section>

          {doc.tags.length > 0 && (
            <section className="panel" aria-labelledby="document-subtopics">
              <h2 id="document-subtopics" className="panel__title">
                Subtopics
              </h2>
              <TagList tags={doc.tags} />
            </section>
          )}

          {doc.related_documents.length > 0 && (
            <section className="panel" aria-labelledby="document-related">
              <h2 id="document-related" className="panel__title">
                Related policies
              </h2>
              <ul className="rail-list">
                {doc.related_documents.map((related) => (
                  <li key={related.id}>
                    <Link to={`/documents/${related.id}`}>
                      <span>
                        {related.title}
                        {related.citation && (
                          <span className="related-citation"> · {related.citation}</span>
                        )}
                      </span>
                      <Icon name="chevronRight" size={16} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="researcher-rail">
          {doc.office && (
            <section className="panel" aria-labelledby="document-office">
              <h2 id="document-office" className="panel__title">
                Responsible office
              </h2>
              <OfficeContact office={doc.office} />
            </section>
          )}
          {doc.topics.length > 0 && (
            <section className="panel" aria-labelledby="document-topics">
              <h2 id="document-topics" className="panel__title">
                Topics
              </h2>
              <ul className="rail-list">
                {doc.topics.map((t) => (
                  <li key={t.id}>
                    <Link to={`/browse/${t.slug}`}>
                      <span>{t.name}</span>
                      <Icon name="chevronRight" size={16} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

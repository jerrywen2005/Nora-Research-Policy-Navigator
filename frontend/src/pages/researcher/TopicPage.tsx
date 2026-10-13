import { Link, useParams } from 'react-router'
import { ApiError } from '../../api/client'
import { DocumentResultCard } from '../../components/DocumentResultCard'
import { Icon } from '../../components/Icon'
import { OfficeContact } from '../../components/OfficeContact'
import { topicIcon } from '../../components/topicIcon'
import './researcher.css'
import { getDocuments, getTopic } from './researcherApi'
import { useLoad } from './useLoad'

// A topic's documents, plus the office that owns the topic. Route: /browse/:slug
export default function TopicPage() {
  const slug = useParams().slug ?? ''
  const page = useLoad(slug, () => Promise.all([getTopic(slug), getDocuments({ topic: slug })]))

  return (
    <div className="researcher">
      <Link to="/browse" className="text-link back-link">
        <Icon name="arrowLeft" size={16} /> All topics
      </Link>

      {page.status === 'loading' && <p className="status">Loading…</p>}
      {page.status === 'error' && (
        <p className="status status--error">
          {page.error instanceof ApiError && page.error.status === 404
            ? 'This topic was not found.'
            : "This topic couldn't be loaded."}
        </p>
      )}
      {page.status === 'ready' && (
        <>
          <header className="page-header">
            <span className="page-header__icon">
              <Icon name={topicIcon(page.data[0].slug)} size={36} />
            </span>
            <div>
              <h1 className="page-header__title">{page.data[0].name}</h1>
              <p className="page-header__intro">{page.data[0].description}</p>
            </div>
          </header>

          <div className="researcher-layout">
            <div className="researcher-main">
              <p className="result-count">
                {page.data[1].total} {page.data[1].total === 1 ? 'document' : 'documents'}
              </p>
              <ul className="result-list">
                {page.data[1].items.map((doc) => (
                  <li key={doc.id}>
                    <DocumentResultCard document={doc} />
                  </li>
                ))}
              </ul>
            </div>
            {page.data[0].office && (
              <aside className="researcher-rail">
                <section className="panel">
                  <h2 className="panel__title">Responsible office</h2>
                  <OfficeContact office={page.data[0].office} />
                </section>
              </aside>
            )}
          </div>
        </>
      )}
    </div>
  )
}

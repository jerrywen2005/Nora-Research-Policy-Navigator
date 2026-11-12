import { Link, useParams } from 'react-router'
import { DocumentResultCard } from '../../components/DocumentResultCard'
import { Icon } from '../../components/Icon'
import './researcher.css'
import { getDocuments, getTags } from './researcherApi'
import { useLoad } from './useLoad'

// Every policy with one subtopic tag, across all topics (F3). Route: /tags/:slug
// There's no single-tag endpoint; the full tag list is small, so the tag is found in it.
export default function TagPage() {
  const slug = useParams().slug ?? ''
  const page = useLoad(slug, () =>
    Promise.all([getTags(), getDocuments({ tag: slug, limit: 100 })]),
  )
  const tag = page.status === 'ready' ? page.data[0].find((t) => t.slug === slug) : undefined

  return (
    <div className="researcher">
      <Link to="/browse" className="text-link back-link">
        <Icon name="arrowLeft" size={16} /> All topics
      </Link>

      {page.status === 'loading' && <p className="status">Loading…</p>}
      {page.status === 'error' && (
        <p className="status status--error">This subtopic couldn't be loaded.</p>
      )}
      {page.status === 'ready' && !tag && (
        <p className="status status--error">This subtopic was not found.</p>
      )}
      {page.status === 'ready' && tag && (
        <>
          <header className="page-header">
            <span className="page-header__icon">
              <Icon name="folder" size={36} />
            </span>
            <div>
              <p className="page-header__eyebrow">Subtopic</p>
              <h1 className="page-header__title">{tag.name}</h1>
              {tag.definition && <p className="page-header__intro">{tag.definition}</p>}
            </div>
          </header>

          <div className="researcher-main">
            <p className="result-count">
              {page.data[1].total} {page.data[1].total === 1 ? 'policy' : 'policies'} across all
              topics
            </p>
            <ul className="result-list">
              {page.data[1].items.map((doc) => (
                <li key={doc.id}>
                  <DocumentResultCard document={doc} />
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}

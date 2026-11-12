import { Link } from 'react-router'
import type { DocumentSummary } from '../api/types'
import './components.css'
import { docTypeLabels } from './docType'
import { Icon } from './Icon'
import { SaveButton } from './SaveButton'

// A browse or search result. The title opens the document's page (F3); every result also shows
// its citation, a link to the source in the Repository when there is one, and a Save toggle (F9).
export function DocumentResultCard({ document }: { document: DocumentSummary }) {
  return (
    <article className="result-card">
      <div className="result-card__meta">
        <span className="badge">{docTypeLabels[document.doc_type]}</span>
        {document.is_authoritative && <span className="badge badge--authoritative">Official</span>}
        {document.citation && <span className="result-card__citation">{document.citation}</span>}
        <span className="result-card__save">
          <SaveButton target={{ document_id: document.id }} name={document.title} />
        </span>
      </div>
      <h3 className="result-card__title">
        <Link to={`/documents/${document.id}`}>{document.title}</Link>
      </h3>
      {document.summary && <p className="result-card__summary">{document.summary}</p>}
      <p className="result-card__footer">
        {document.office && <span>{document.office.name}</span>}
        {document.last_reviewed_at && <span>Last reviewed {document.last_reviewed_at}</span>}
        {document.source_url && (
          <a href={document.source_url} target="_blank" rel="noreferrer">
            Repository<span className="visually-hidden">: {document.title}</span>{' '}
            <Icon name="external" size={14} />
          </a>
        )}
      </p>
    </article>
  )
}

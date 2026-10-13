import type { DocType, DocumentSummary } from '../api/types'
import './components.css'
import { Icon } from './Icon'

const docTypeLabels: Record<DocType, string> = {
  policy: 'Policy',
  sop: 'SOP',
  guidance: 'Guidance',
  faq: 'FAQ',
  webpage: 'Web page',
  job_aid: 'Job aid',
  other: 'Document',
}

// A browse or search result. Every result shows its citation and, when there is one, a link to
// the source.
export function DocumentResultCard({ document }: { document: DocumentSummary }) {
  return (
    <article className="result-card">
      <div className="result-card__meta">
        <span className="badge">{docTypeLabels[document.doc_type]}</span>
        {document.is_authoritative && <span className="badge badge--authoritative">Official</span>}
        {document.citation && <span className="result-card__citation">{document.citation}</span>}
      </div>
      <h3 className="result-card__title">
        {document.source_url ? (
          <a href={document.source_url} target="_blank" rel="noreferrer">
            {document.title} <Icon name="external" size={16} />
          </a>
        ) : (
          document.title
        )}
      </h3>
      {document.summary && <p className="result-card__summary">{document.summary}</p>}
      <p className="result-card__footer">
        {document.office && <span>{document.office.name}</span>}
        {document.last_reviewed_at && <span>Last reviewed {document.last_reviewed_at}</span>}
      </p>
    </article>
  )
}

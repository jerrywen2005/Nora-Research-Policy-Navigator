import { Link } from 'react-router'
import type { AdminDocument, DocumentStatus, FaqStatus } from '../../api/types'
import '../../components/components.css' // .visually-hidden
import { docTypeLabels } from '../../components/docType'
import './admin.css'
import { faqStatusLabels, formatDate, statusLabels } from './adminFormat'

// A document's or an FAQ's status. A published FAQ looks like a published (`active`) document.
export function StatusBadge({ status }: { status: DocumentStatus | FaqStatus }) {
  const label = status === 'published' ? faqStatusLabels.published : statusLabels[status]
  const tone = status === 'published' ? 'active' : status
  return <span className={`badge status-badge status-badge--${tone}`}>{label}</span>
}

// Documents of any status, each linking to its editor. Used by the Policy Library and the
// Content Management review queue. Scrolls sideways on narrow screens instead of squashing.
export function AdminDocumentTable({ documents, caption }: { documents: AdminDocument[]; caption: string }) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Title</th>
            <th scope="col">Status</th>
            <th scope="col">Type</th>
            <th scope="col">Topics</th>
            <th scope="col">Office</th>
            <th scope="col">Updated</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={doc.id}>
              <td>
                <Link to={`/admin/documents/${doc.id}`}>{doc.title}</Link>
                {doc.citation && <span className="admin-table__sub">{doc.citation}</span>}
              </td>
              <td>
                <StatusBadge status={doc.status} />
              </td>
              <td>{docTypeLabels[doc.doc_type]}</td>
              <td>{doc.topics.length > 0 ? doc.topics.map((t) => t.name).join(', ') : <Missing />}</td>
              <td>{doc.office ? doc.office.name : <Missing />}</td>
              <td>{formatDate(doc.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Publishing needs an office and a topic, so their absence is called out.
function Missing() {
  return <span className="admin-table__missing">None</span>
}

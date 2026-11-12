import { Link, useSearchParams } from 'react-router'
import type { FaqStatus } from '../../api/types'
import '../../components/components.css' // .visually-hidden
import { useLoad } from '../researcher/useLoad'
import { StatusBadge } from './AdminDocumentTable'
import './admin.css'
import { faqStatusLabels, formatDate } from './adminFormat'
import { getTopics, listAdminFaqs } from './adminApi'

const STATUSES: FaqStatus[] = ['draft', 'published', 'archived']

// Every FAQ, of any status, with status and topic filters (F8). Route: /admin/faqs?status=&topic=
// The filters live in the URL, like the Policy Library's. There are few FAQs, so there's no paging.
export default function FaqListPage() {
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') ?? '') as FaqStatus | ''
  const topic = params.get('topic') ?? ''

  const topics = useLoad('topics', getTopics)
  const faqs = useLoad(params.toString(), () => listAdminFaqs({ status: status || undefined, topic }))

  function update(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next)
  }

  return (
    <div className="admin-page">
      <div className="admin-page__heading">
        <h1>FAQs</h1>
        <Link to="/admin/faqs/new" className="button">
          New FAQ
        </Link>
      </div>
      <p className="admin-page__intro">
        Questions and answers for researchers. A published FAQ shows on the FAQ page and on its topic's page.
      </p>

      <div className="admin-filters">
        <label className="admin-field">
          <span>Status</span>
          <select value={status} onChange={(event) => update('status', event.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {faqStatusLabels[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-field">
          <span>Topic</span>
          <select value={topic} onChange={(event) => update('topic', event.target.value)}>
            <option value="">All topics</option>
            {topics.status === 'ready' &&
              topics.data.map((t) => (
                <option key={t.id} value={t.slug}>
                  {t.name}
                </option>
              ))}
          </select>
        </label>
      </div>

      <div aria-live="polite">
        {faqs.status === 'loading' && <p className="admin-status">Loading…</p>}
        {faqs.status === 'error' && <p className="admin-status admin-status--error">The FAQs couldn't be loaded.</p>}
        {faqs.status === 'ready' && faqs.data.length === 0 && (
          <p className="admin-status">{status || topic ? 'No FAQs match.' : 'No FAQs yet. Write the first one.'}</p>
        )}
        {faqs.status === 'ready' && faqs.data.length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <caption className="visually-hidden">FAQs</caption>
              <thead>
                <tr>
                  <th scope="col">Question</th>
                  <th scope="col">Status</th>
                  <th scope="col">Topic</th>
                  <th scope="col">Sources</th>
                  <th scope="col">Order</th>
                  <th scope="col">Updated</th>
                </tr>
              </thead>
              <tbody>
                {faqs.data.map((faq) => (
                  <tr key={faq.id}>
                    <td>
                      <Link to={`/admin/faqs/${faq.id}`}>{faq.question}</Link>
                    </td>
                    <td>
                      <StatusBadge status={faq.status} />
                    </td>
                    {/* Publishing needs a topic, so its absence is called out. */}
                    <td>{faq.topic ? faq.topic.name : <span className="admin-table__missing">None</span>}</td>
                    <td>{faq.sources.length}</td>
                    <td>{faq.sort_order}</td>
                    <td>{formatDate(faq.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

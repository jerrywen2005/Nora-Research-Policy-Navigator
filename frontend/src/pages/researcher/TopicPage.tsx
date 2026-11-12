import { Link, useParams, useSearchParams } from 'react-router'
import { ApiError } from '../../api/client'
import { DocumentResultCard } from '../../components/DocumentResultCard'
import { FaqItem } from '../../components/FaqItem'
import { Icon } from '../../components/Icon'
import { OfficeContact } from '../../components/OfficeContact'
import { topicIcon } from '../../components/topicIcon'
import './researcher.css'
import { getDocuments, getFaqs, getTopic } from './researcherApi'
import { useLoad } from './useLoad'

// The most documents the API returns at once; the largest topic has fewer.
const PAGE_SIZE = 100
// The topic page shows its first few FAQs (in the admins' order) and links to the rest.
const TOPIC_FAQS = 3

// A topic's documents, filtered by one subtopic tag (F3), its published FAQs (F8), and the office
// that owns the topic.
// Route: /browse/:slug?tag=
// The topic and its documents load separately, so changing the filter doesn't reload the topic
// (and doesn't log another topic view).
export default function TopicPage() {
  const slug = useParams().slug ?? ''
  const [searchParams, setSearchParams] = useSearchParams()
  const tagSlug = searchParams.get('tag') ?? ''
  const topic = useLoad(slug, () => getTopic(slug))
  const documents = useLoad(`${slug}?tag=${tagSlug}`, () =>
    getDocuments({ topic: slug, tag: tagSlug, limit: PAGE_SIZE }),
  )
  // Shown only when there are some; a failure just leaves the section out.
  const faqs = useLoad(`faqs:${slug}`, () => getFaqs({ topic: slug }))

  function filterBy(tag: string) {
    setSearchParams(tag ? { tag } : {}, { replace: true })
  }

  return (
    <div className="researcher">
      <Link to="/browse" className="text-link back-link">
        <Icon name="arrowLeft" size={16} /> All topics
      </Link>

      {topic.status === 'loading' && <p className="status">Loading…</p>}
      {topic.status === 'error' && (
        <p className="status status--error">
          {topic.error instanceof ApiError && topic.error.status === 404
            ? 'This topic was not found.'
            : "This topic couldn't be loaded."}
        </p>
      )}
      {topic.status === 'ready' && (
        <>
          <header className="page-header">
            <span className="page-header__icon">
              <Icon name={topicIcon(topic.data.slug)} size={36} />
            </span>
            <div>
              <h1 className="page-header__title">{topic.data.name}</h1>
              <p className="page-header__intro">{topic.data.description}</p>
            </div>
          </header>

          <div className="researcher-layout">
            <div className="researcher-main">
              {topic.data.tags.length > 0 && (
                <div className="tag-filter" role="group" aria-label="Filter by subtopic">
                  <button
                    type="button"
                    className={tagSlug ? 'chip-button' : 'chip-button chip-button--on'}
                    aria-pressed={!tagSlug}
                    onClick={() => filterBy('')}
                  >
                    All
                  </button>
                  {topic.data.tags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      className={tag.slug === tagSlug ? 'chip-button chip-button--on' : 'chip-button'}
                      aria-pressed={tag.slug === tagSlug}
                      title={tag.definition ?? undefined}
                      onClick={() => filterBy(tag.slug)}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              )}

              <div aria-live="polite">
                {documents.status === 'loading' && <p className="status">Loading…</p>}
                {documents.status === 'error' && (
                  <p className="status status--error">The documents couldn't be loaded.</p>
                )}
                {documents.status === 'ready' && (
                  <>
                    <p className="result-count">
                      {documents.data.total} {documents.data.total === 1 ? 'document' : 'documents'}
                      {tagSlug && (
                        <>
                          {' · '}
                          <Link to={`/tags/${tagSlug}`} className="text-link">
                            This subtopic across all topics
                          </Link>
                        </>
                      )}
                    </p>
                    <ul className="result-list">
                      {documents.data.items.map((doc) => (
                        <li key={doc.id}>
                          <DocumentResultCard document={doc} />
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>

              {faqs.status === 'ready' && faqs.data.length > 0 && (
                <section className="topic-faqs" aria-labelledby="topic-faqs">
                  <h2 id="topic-faqs" className="faq-group__title">
                    Frequently asked questions
                  </h2>
                  <ul className="faq-list">
                    {faqs.data.slice(0, TOPIC_FAQS).map((faq) => (
                      <li key={faq.id}>
                        <FaqItem faq={faq} />
                      </li>
                    ))}
                  </ul>
                  {faqs.data.length > TOPIC_FAQS && (
                    <p className="topic-faqs__more">
                      <Link to={`/faqs?topic=${encodeURIComponent(slug)}`} className="text-link">
                        See all {faqs.data.length} FAQs for this topic
                      </Link>
                    </p>
                  )}
                </section>
              )}
            </div>
            {topic.data.office && (
              <aside className="researcher-rail">
                <section className="panel">
                  <h2 className="panel__title">Responsible office</h2>
                  <OfficeContact office={topic.data.office} />
                </section>
              </aside>
            )}
          </div>
        </>
      )}
    </div>
  )
}

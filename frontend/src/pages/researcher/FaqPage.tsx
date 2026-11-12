import { useSearchParams } from 'react-router'
import type { Faq, Topic } from '../../api/types'
import { FaqItem } from '../../components/FaqItem'
import { Icon } from '../../components/Icon'
import './researcher.css'
import { getFaqs, getTopics } from './researcherApi'
import { useLoad } from './useLoad'

interface Group {
  key: string
  name: string
  faqs: Faq[]
}

// Published FAQs grouped by topic, in the topics' display order. An FAQ whose topic was removed
// goes last, under "Other".
function groupByTopic(faqs: Faq[], topics: Topic[]): Group[] {
  const groups: Group[] = topics.map((topic) => ({
    key: topic.slug,
    name: topic.name,
    faqs: faqs.filter((faq) => faq.topic?.slug === topic.slug),
  }))
  const known = new Set(topics.map((topic) => topic.slug))
  groups.push({ key: '', name: 'Other', faqs: faqs.filter((faq) => !faq.topic || !known.has(faq.topic.slug)) })
  return groups.filter((group) => group.faqs.length > 0)
}

// Every published FAQ (F8), with a one-at-a-time topic filter kept in the URL.
// Route: /faqs?topic=
// There are few FAQs, so all of them load once and the filter works on that list.
export default function FaqPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const topicSlug = searchParams.get('topic') ?? ''
  const page = useLoad('faqs', () => Promise.all([getFaqs(), getTopics()]))
  const groups = page.status === 'ready' ? groupByTopic(page.data[0], page.data[1]) : []
  const shown = topicSlug ? groups.filter((group) => group.key === topicSlug) : groups

  function filterBy(slug: string) {
    setSearchParams(slug ? { topic: slug } : {}, { replace: true })
  }

  return (
    <div className="researcher">
      <header className="page-header">
        <span className="page-header__icon">
          <Icon name="help" size={36} />
        </span>
        <div>
          <h1 className="page-header__title">Frequently Asked Questions</h1>
          <p className="page-header__intro">
            Answers to common research policy questions, written by UNC Research. They're general guidance; the
            linked policies are the official text.
          </p>
        </div>
      </header>

      {page.status === 'loading' && <p className="status">Loading…</p>}
      {page.status === 'error' && <p className="status status--error">The FAQs couldn't be loaded.</p>}
      {page.status === 'ready' && groups.length === 0 && <p className="status">There are no FAQs yet.</p>}
      {page.status === 'ready' && groups.length > 0 && (
        <div className="researcher-main">
          {groups.length > 1 && (
            <div className="tag-filter" role="group" aria-label="Filter by topic">
              <button
                type="button"
                className={topicSlug ? 'chip-button' : 'chip-button chip-button--on'}
                aria-pressed={!topicSlug}
                onClick={() => filterBy('')}
              >
                All
              </button>
              {groups
                .filter((group) => group.key)
                .map((group) => (
                  <button
                    key={group.key}
                    type="button"
                    className={group.key === topicSlug ? 'chip-button chip-button--on' : 'chip-button'}
                    aria-pressed={group.key === topicSlug}
                    onClick={() => filterBy(group.key)}
                  >
                    {group.name}
                  </button>
                ))}
            </div>
          )}

          {shown.length === 0 && <p className="status">This topic has no FAQs yet.</p>}
          {shown.map((group) => (
            <section key={group.key || 'other'} className="faq-group" aria-labelledby={`faq-group-${group.key || 'other'}`}>
              <h2 id={`faq-group-${group.key || 'other'}`} className="faq-group__title">
                {group.name}
              </h2>
              <ul className="faq-list">
                {group.faqs.map((faq) => (
                  <li key={faq.id}>
                    <FaqItem faq={faq} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

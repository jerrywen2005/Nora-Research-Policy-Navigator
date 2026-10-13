import { useNavigate } from 'react-router'
import { Icon } from '../../components/Icon'
import { TopicGrid } from '../../components/TopicGrid'
import './researcher.css'
import { getTopics } from './researcherApi'
import { useLoad } from './useLoad'

// All policy topics. Picking one opens its documents.
export default function BrowsePage() {
  const navigate = useNavigate()
  const topics = useLoad('topics', getTopics)

  return (
    <div className="researcher">
      <header className="page-header">
        <span className="page-header__icon">
          <Icon name="book" size={36} />
        </span>
        <div>
          <h1 className="page-header__title">Browse Topics</h1>
          <p className="page-header__intro">
            Explore research policies and guidance by subject area.
          </p>
        </div>
      </header>

      {topics.status === 'loading' && <p className="status">Loading topics…</p>}
      {topics.status === 'error' && (
        <p className="status status--error">Topics couldn't be loaded.</p>
      )}
      {topics.status === 'ready' && (
        <TopicGrid topics={topics.data} onSelect={(slug) => navigate(`/browse/${slug}`)} />
      )}
    </div>
  )
}

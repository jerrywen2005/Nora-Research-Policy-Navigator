import { Link, useNavigate } from 'react-router'
import { ActionCard } from '../../components/ActionCard'
import { AskSection } from '../../components/AskSection'
import { Icon } from '../../components/Icon'
import { TopicGrid } from '../../components/TopicGrid'
import { topicIcon } from '../../components/topicIcon'
import './researcher.css'
import { getTopics } from './researcherApi'
import { useLoad } from './useLoad'

// The researcher home page, following the client mockup.
export default function HomePage() {
  const navigate = useNavigate()
  const topics = useLoad('topics', getTopics)
  const openTopic = (slug: string) => navigate(`/browse/${slug}`)

  return (
    <div className="researcher">
      <header className="hero">
        <h1 className="hero__title">Research Policy Navigator</h1>
        <p className="hero__tagline">Find. Understand. Navigate.</p>
        <p className="hero__intro">Your guide to UNC research policies and guidance.</p>
      </header>

      <div className="researcher-layout">
        <div className="researcher-main">
          <div className="action-cards">
            <ActionCard
              tone="browse"
              icon="book"
              title="Browse Topics"
              description="Explore research policies and guidance by subject area."
              actionLabel="Browse Topics"
              onAction={() => navigate('/browse')}
            />
            <ActionCard
              tone="search"
              icon="search"
              title="Search Policies & Guidance"
              description="Find a policy, procedure, or guidance document."
              actionLabel="Search Now"
              onAction={() => navigate('/search')}
            />
            <ActionCard
              tone="ask"
              icon="chat"
              title="Ask a Question"
              description="Ask in your own words and get an answer based on approved UNC research sources."
              actionLabel="Ask a Question"
              onAction={() => navigate('/ask')}
            />
          </div>

          <section className="panel" aria-labelledby="ask-heading">
            <h2 id="ask-heading" className="panel__title">
              Ask a question
            </h2>
            <AskSection />
          </section>

          <section className="panel" aria-labelledby="topics-heading">
            <h2 id="topics-heading" className="panel__title">
              Research Policy Topics
            </h2>
            {topics.status === 'loading' && <p className="status">Loading topics…</p>}
            {topics.status === 'error' && (
              <p className="status status--error">Topics couldn't be loaded.</p>
            )}
            {topics.status === 'ready' && <TopicGrid topics={topics.data} onSelect={openTopic} />}
          </section>
        </div>

        <aside className="researcher-rail">
          <section className="panel">
            <h2 className="panel__title">Popular Topics</h2>
            {topics.status === 'ready' && (
              <ul className="rail-list">
                {topics.data.slice(0, 5).map((topic) => (
                  <li key={topic.id}>
                    <Link to={`/browse/${topic.slug}`}>
                      <Icon name={topicIcon(topic.slug)} size={18} />
                      <span>{topic.name}</span>
                      <Icon name="chevronRight" size={16} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/browse" className="text-link">
              View all topics <Icon name="arrowRight" size={14} />
            </Link>
          </section>

          <section className="panel">
            <h2 className="panel__title">Need help?</h2>
            <p className="rail-text">
              Can't find what you're looking for? Each topic lists the office responsible for it,
              and you can contact them directly.
            </p>
            <Link to="/ask" className="button button--secondary">
              <Icon name="help" size={16} /> Ask a question
            </Link>
          </section>
        </aside>
      </div>
    </div>
  )
}

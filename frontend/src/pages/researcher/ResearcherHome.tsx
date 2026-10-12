import { useRef, useState } from 'react'
import type { AskResponse } from '../../api/types'
import { ActionCard } from '../../components/ActionCard'
import { AnswerCard } from '../../components/AnswerCard'
import { AskPanel } from '../../components/AskPanel'
import { Icon } from '../../components/Icon'
import { topicIcon } from '../../components/topicIcon'
import { TopicGrid } from '../../components/TopicGrid'
import './researcher.css'
import { ask, getTopics } from './researcherApi'
import { useLoad } from './useLoad'

const EXAMPLE_QUESTIONS = [
  'Do I need IRB approval for my study?',
  'Can I share de-identified data?',
  'What is considered human subjects research?',
  'How do I disclose a conflict of interest?',
  'Where can I find data use agreements?',
]

type AskState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'done'; response: AskResponse }

interface ResearcherHomeProps {
  onSelectTopic: (slug: string) => void
  onOpenSearch: () => void
}

export function ResearcherHome({ onSelectTopic, onOpenSearch }: ResearcherHomeProps) {
  const topics = useLoad('topics', getTopics)
  const [askState, setAskState] = useState<AskState>({ status: 'idle' })
  const topicsRef = useRef<HTMLElement>(null)
  const askSectionRef = useRef<HTMLElement>(null)
  const askInputRef = useRef<HTMLInputElement>(null)

  async function handleAsk(question: string) {
    setAskState({ status: 'loading' })
    try {
      setAskState({ status: 'done', response: await ask({ question, topic: null }) })
    } catch {
      setAskState({ status: 'error' })
    }
  }

  function goToAsk() {
    askSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
    askInputRef.current?.focus({ preventScroll: true })
  }

  return (
    <div className="researcher researcher-page">
      <header className="hero">
        <div>
          <h1 className="hero__title">Research Policy Navigator</h1>
          <p className="hero__tagline">Find. Understand. Navigate.</p>
          <p className="hero__intro">Your guide to UNC research policies and guidance.</p>
        </div>
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
              onAction={() => topicsRef.current?.scrollIntoView({ behavior: 'smooth' })}
            />
            <ActionCard
              tone="search"
              icon="search"
              title="Search Policies & Guidance"
              description="Find a policy, procedure, or guidance document."
              actionLabel="Search Now"
              onAction={onOpenSearch}
            />
            <ActionCard
              tone="ask"
              icon="chat"
              title="Ask a Question"
              description="Ask in your own words and get an answer based on approved UNC research sources."
              actionLabel="Ask a Question"
              onAction={goToAsk}
            />
          </div>

          <section className="panel" ref={askSectionRef} aria-labelledby="ask-heading">
            <h2 id="ask-heading" className="panel__title">
              Ask a question
            </h2>
            <AskPanel
              examples={EXAMPLE_QUESTIONS}
              loading={askState.status === 'loading'}
              inputRef={askInputRef}
              onAsk={handleAsk}
            />
            <div aria-live="polite">
              {askState.status === 'loading' && <p className="status">Looking through sources…</p>}
              {askState.status === 'error' && (
                <p className="status status--error">Something went wrong. Please try again.</p>
              )}
              {askState.status === 'done' && <AnswerCard response={askState.response} />}
            </div>
          </section>

          <section className="panel" ref={topicsRef} aria-labelledby="topics-heading">
            <h2 id="topics-heading" className="panel__title">
              Research Policy Topics
            </h2>
            {topics.status === 'loading' && <p className="status">Loading topics…</p>}
            {topics.status === 'error' && (
              <p className="status status--error">Topics couldn't be loaded.</p>
            )}
            {topics.status === 'ready' && <TopicGrid topics={topics.data} onSelect={onSelectTopic} />}
          </section>
        </div>

        <aside className="researcher-rail">
          <section className="panel">
            <h2 className="panel__title">Popular Topics</h2>
            {topics.status === 'ready' && (
              <ul className="rail-list">
                {topics.data.slice(0, 5).map((topic) => (
                  <li key={topic.id}>
                    <button type="button" onClick={() => onSelectTopic(topic.slug)}>
                      <Icon name={topicIcon(topic.slug)} size={18} />
                      <span>{topic.name}</span>
                      <Icon name="chevronRight" size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              className="button button--link"
              onClick={() => topicsRef.current?.scrollIntoView({ behavior: 'smooth' })}
            >
              View all topics <Icon name="arrowRight" size={14} />
            </button>
          </section>

          <section className="panel">
            <h2 className="panel__title">Need help?</h2>
            <p className="rail-text">
              Can't find what you're looking for? Each topic lists the office responsible for it,
              and you can contact them directly.
            </p>
            <button type="button" className="button button--outline" onClick={goToAsk}>
              <Icon name="help" size={16} /> Ask a question
            </button>
          </section>
        </aside>
      </div>
    </div>
  )
}

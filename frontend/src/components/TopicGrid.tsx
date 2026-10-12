import type { Topic } from '../api/types'
import './components.css'
import { Icon } from './Icon'
import { topicIcon } from './topicIcon'

interface TopicGridProps {
  topics: Topic[]
  onSelect: (slug: string) => void
}

export function TopicGrid({ topics, onSelect }: TopicGridProps) {
  return (
    <ul className="topic-grid">
      {topics.map((topic) => (
        <li key={topic.id}>
          <button
            type="button"
            className="topic-tile"
            title={topic.description}
            onClick={() => onSelect(topic.slug)}
          >
            <span className="topic-tile__icon">
              <Icon name={topicIcon(topic.slug)} size={32} />
            </span>
            <span className="topic-tile__name">{topic.name}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

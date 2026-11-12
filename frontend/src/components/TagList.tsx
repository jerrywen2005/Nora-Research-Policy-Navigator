import { Link } from 'react-router'
import type { Tag } from '../api/types'
import './components.css'

// A document's subtopic tags (F3). Each links to the tag's page, which lists every policy with
// that tag across topics.
export function TagList({ tags }: { tags: Tag[] }) {
  return (
    <ul className="tag-list">
      {tags.map((tag) => (
        <li key={tag.id}>
          <Link to={`/tags/${tag.slug}`} className="tag-link" title={tag.definition ?? undefined}>
            {tag.name}
          </Link>
        </li>
      ))}
    </ul>
  )
}

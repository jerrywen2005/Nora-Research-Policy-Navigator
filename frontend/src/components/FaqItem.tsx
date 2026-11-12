import { Link } from 'react-router'
import type { Faq } from '../api/types'
import './components.css'
import { Icon } from './Icon'
import { MarkdownText } from './MarkdownText'

// One published FAQ (F8): the question opens to show the admin-written answer and the policies it's
// based on. Used on the FAQ page and on each topic's page.
export function FaqItem({ faq }: { faq: Faq }) {
  return (
    <details className="faq-item">
      <summary className="faq-item__question">
        <span>{faq.question}</span>
        <Icon name="chevronRight" size={18} />
      </summary>
      <div className="faq-item__answer">
        <MarkdownText text={faq.answer} />
        {faq.sources.length > 0 && (
          <>
            <p className="faq-item__label">Based on</p>
            <ul className="faq-item__sources">
              {faq.sources.map((source) => (
                <li key={source.id}>
                  <Link to={`/documents/${source.id}`} className="text-link">
                    {source.title}
                  </Link>
                  {source.citation && <span className="faq-item__citation"> · {source.citation}</span>}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </details>
  )
}

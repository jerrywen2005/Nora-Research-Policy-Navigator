import { Link } from 'react-router'
import { AnswerCard } from '../../components/AnswerCard'
import { savedAnswer } from '../../components/answerContent'
import { DocumentResultCard } from '../../components/DocumentResultCard'
import { Icon } from '../../components/Icon'
import { SaveButton } from '../../components/SaveButton'
import { useSaved } from '../../saved/SavedContext'
import './researcher.css'

function savedDate(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// The user's saved answers and documents, newest first (F9). Route: /saved
// Each item's Save toggle removes it from the list.
export default function SavedPage() {
  const saved = useSaved()

  return (
    <div className="researcher">
      <header className="page-header">
        <span className="page-header__icon">
          <Icon name="bookmark" size={36} />
        </span>
        <div>
          <h1 className="page-header__title">Saved Items</h1>
          <p className="page-header__intro">Answers and documents you saved, newest first.</p>
        </div>
      </header>

      <div className="researcher-main">
        {saved.status === 'loading' && <p className="status">Loading your saved items…</p>}
        {saved.status === 'error' && (
          <p className="status status--error">Your saved items couldn't be loaded.</p>
        )}
        {saved.status === 'ready' && saved.items.length === 0 && (
          <p className="status">
            Nothing saved yet. Use <strong>Save</strong> on an answer or a document to keep it
            here. <Link to="/ask">Ask a question</Link> or <Link to="/search">search policies</Link>{' '}
            to get started.
          </p>
        )}
        {saved.items.length > 0 && (
          <ul className="result-list">
            {saved.items.map((item) => (
              <li key={item.id}>
                {item.kind === 'document' ? (
                  <DocumentResultCard document={item.document} />
                ) : (
                  <article className="saved-question" aria-label={item.question.question_text}>
                    <p className="saved-question__asked">
                      <span className="saved-question__label">You asked</span>
                      <span className="saved-question__date">
                        {savedDate(item.question.created_at)}
                      </span>
                    </p>
                    <h2 className="saved-question__text">{item.question.question_text}</h2>
                    <AnswerCard
                      response={savedAnswer(item.question)}
                      actions={
                        <SaveButton
                          target={{ question_id: item.question.id }}
                          name={item.question.question_text}
                        />
                      }
                    />
                  </article>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

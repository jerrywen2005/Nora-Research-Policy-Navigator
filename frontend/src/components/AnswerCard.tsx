import type { AskResponse, Citation } from '../api/types'
import './components.css'
import { Icon } from './Icon'
import { OfficeContact } from './OfficeContact'

// Turns "[1]" markers in the answer into links to the matching source below it.
function AnswerText({ text, citations }: { text: string; citations: Citation[] }) {
  const numbers = new Set(citations.map((c) => c.number))
  return (
    <p className="answer-card__text">
      {text.split(/(\[\d+\])/).map((part, index) => {
        const match = /^\[(\d+)\]$/.exec(part)
        if (match && numbers.has(Number(match[1]))) {
          return (
            <sup key={index}>
              <a href={`#citation-${match[1]}`}>[{match[1]}]</a>
            </sup>
          )
        }
        return part
      })}
    </p>
  )
}

function CitationList({ citations, showSnippets }: { citations: Citation[]; showSnippets: boolean }) {
  return (
    <ol className="answer-card__sources">
      {citations.map((citation) => (
        <li key={citation.number} id={`citation-${citation.number}`} value={citation.number}>
          {citation.source_url ? (
            <a href={citation.source_url} target="_blank" rel="noreferrer">
              {citation.title} <Icon name="external" size={14} />
            </a>
          ) : (
            <span>{citation.title}</span>
          )}
          {citation.section && <span className="answer-card__section"> · {citation.section}</span>}
          {showSnippets && <p className="answer-card__snippet">{citation.snippet}</p>}
        </li>
      ))}
    </ol>
  )
}

// Renders every AskResponse outcome. The disclaimer is always shown (docs/api.md).
export function AnswerCard({ response }: { response: AskResponse }) {
  const answered = response.outcome === 'answered'
  const answer = answered ? response.answer : null

  let heading: string
  if (answer) {
    heading = 'Answer based on UNC Research guidance'
  } else if (answered) {
    heading = 'Relevant sources'
  } else {
    heading = "We couldn't find a confident answer"
  }

  return (
    <section className={answered ? 'answer-card' : 'answer-card answer-card--referred'}>
      <h3 className="answer-card__heading">
        <Icon name={answered ? 'check' : 'alert'} size={20} />
        {heading}
      </h3>

      {answer && <AnswerText text={answer} citations={response.citations} />}
      {!answered && response.answer && <p className="answer-card__text">{response.answer}</p>}

      {response.citations.length > 0 && (
        <>
          {answer && <p className="answer-card__label">Sources</p>}
          <CitationList citations={response.citations} showSnippets={!answer} />
        </>
      )}

      {response.referral && (
        <>
          <p className="answer-card__label">Contact the responsible office</p>
          <OfficeContact office={response.referral} />
        </>
      )}

      <p className="answer-card__disclaimer">
        <Icon name="info" size={16} />
        <span>{response.disclaimer}</span>
      </p>
    </section>
  )
}

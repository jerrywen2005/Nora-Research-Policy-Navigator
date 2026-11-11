import type { ReactNode } from 'react'
import type { AskResponse, Citation } from '../api/types'
import './components.css'
import { Icon } from './Icon'
import { OfficeContact } from './OfficeContact'

// Inline marks in an answer: **bold**, and citations as [1] or the 【1】 some models write.
const INLINE = /(\*\*[^*]+\*\*|[[【]\d+[\]】])/
const LIST_ITEM = /^\s*(?:[-*•]|\d+\.)\s+/

// Bold text, and citation markers as links to the matching source below.
function Inline({ text, numbers }: { text: string; numbers: Set<number> }) {
  return text.split(INLINE).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={index}>{part.slice(2, -2)}</strong>
    }
    const citation = /^[[【](\d+)[\]】]$/.exec(part)
    if (citation && numbers.has(Number(citation[1]))) {
      return (
        <sup key={index}>
          <a href={`#citation-${citation[1]}`}>[{citation[1]}]</a>
        </sup>
      )
    }
    return part
  })
}

// The LLM writes a little Markdown: paragraphs, "- " or "1. " list items, and **bold**. This
// renders just that, as React elements, so model output is never inserted as HTML.
function AnswerText({ text, citations }: { text: string; citations: Citation[] }) {
  const numbers = new Set(citations.map((c) => c.number))
  const blocks: ReactNode[] = []
  let items: string[] = []

  const flushList = () => {
    if (items.length > 0) {
      blocks.push(
        <ul key={blocks.length} className="answer-card__list">
          {items.map((item, index) => (
            <li key={index}>
              <Inline text={item} numbers={numbers} />
            </li>
          ))}
        </ul>,
      )
      items = []
    }
  }

  for (const line of text.split('\n')) {
    if (LIST_ITEM.test(line)) {
      items.push(line.replace(LIST_ITEM, ''))
    } else if (line.trim()) {
      flushList()
      blocks.push(
        <p key={blocks.length} className="answer-card__text">
          <Inline text={line.trim()} numbers={numbers} />
        </p>,
      )
    }
  }
  flushList()
  return <>{blocks}</>
}

// The confidence indicator: how well the best source matched the question (the reranker score
// the backend's gate uses). Anything below the gate was already referred, not answered.
function confidenceLabel(confidence: number): string {
  if (confidence >= 0.5) return 'Strong match with the policies'
  if (confidence >= 0.15) return 'Moderate match with the policies'
  return 'Partial match: check the sources below'
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

      {answered && (
        <p className="answer-card__confidence">
          <Icon name="info" size={14} />
          {confidenceLabel(response.confidence)}
        </p>
      )}

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

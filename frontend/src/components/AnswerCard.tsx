import { useId, type ReactNode } from 'react'
import type { Citation } from '../api/types'
import type { AnswerContent } from './answerContent'
import './components.css'
import { Icon, type IconName } from './Icon'
import { OfficeContact } from './OfficeContact'

// Inline marks in an answer: **bold**, and citations as [1] or the 【1】 some models write.
const INLINE = /(\*\*[^*]+\*\*|[[【]\d+[\]】])/
const LIST_ITEM = /^\s*(?:[-*•]|\d+\.)\s+/

// Bold text, and citation markers as links to the matching source below.
function Inline({ text, numbers, idPrefix }: { text: string; numbers: Set<number>; idPrefix: string }) {
  return text.split(INLINE).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={index}>{part.slice(2, -2)}</strong>
    }
    const citation = /^[[【](\d+)[\]】]$/.exec(part)
    if (citation && numbers.has(Number(citation[1]))) {
      return (
        <sup key={index}>
          <a href={`#${idPrefix}-${citation[1]}`}>[{citation[1]}]</a>
        </sup>
      )
    }
    return part
  })
}

// The LLM writes a little Markdown: paragraphs, "- " or "1. " list items, and **bold**. This
// renders just that, as React elements, so model output is never inserted as HTML.
function AnswerText({
  text,
  citations,
  idPrefix,
}: {
  text: string
  citations: Citation[]
  idPrefix: string
}) {
  const numbers = new Set(citations.map((c) => c.number))
  const blocks: ReactNode[] = []
  let items: string[] = []

  const flushList = () => {
    if (items.length > 0) {
      blocks.push(
        <ul key={blocks.length} className="answer-card__list">
          {items.map((item, index) => (
            <li key={index}>
              <Inline text={item} numbers={numbers} idPrefix={idPrefix} />
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
          <Inline text={line.trim()} numbers={numbers} idPrefix={idPrefix} />
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

function CitationList({
  citations,
  showSnippets,
  idPrefix,
}: {
  citations: Citation[]
  showSnippets: boolean
  idPrefix: string
}) {
  return (
    <ol className="answer-card__sources">
      {citations.map((citation) => (
        <li key={citation.number} id={`${idPrefix}-${citation.number}`} value={citation.number}>
          {citation.source_url ? (
            <a href={citation.source_url} target="_blank" rel="noreferrer">
              {citation.title} <Icon name="external" size={14} />
            </a>
          ) : (
            <span>{citation.title}</span>
          )}
          {citation.section && <span className="answer-card__section"> · {citation.section}</span>}
          {showSnippets && citation.snippet && (
            <p className="answer-card__snippet">{citation.snippet}</p>
          )}
        </li>
      ))}
    </ol>
  )
}

const CARD_ICONS: Record<AnswerContent['outcome'], IconName> = {
  answered: 'check',
  referred: 'alert',
  no_answer: 'alert',
  out_of_scope: 'info',
}

const HEADINGS: Record<AnswerContent['outcome'], string> = {
  answered: 'Answer based on UNC Research guidance',
  referred: "We couldn't find a confident answer",
  no_answer: "We couldn't find a confident answer",
  out_of_scope: 'This looks outside research policy',
}

// Renders every answer outcome with what the API sends for it: the contacts, any links, and the
// disclaimer when there is one (docs/api.md). `actions` (the feedback and save buttons) go
// between the answer and the disclaimer.
export function AnswerCard({ response, actions }: { response: AnswerContent; actions?: ReactNode }) {
  // Citation anchors must be unique: the Saved page shows many answers at once.
  const idPrefix = `citation${useId().replace(/:/g, '')}`
  const answered = response.outcome === 'answered'
  const answer = answered ? response.answer : null

  const heading = answered && !answer ? 'Relevant sources' : HEADINGS[response.outcome]

  return (
    <section className={`answer-card answer-card--${response.outcome.replace(/_/g, '-')}`}>
      <h3 className="answer-card__heading">
        <Icon name={CARD_ICONS[response.outcome]} size={20} />
        {heading}
      </h3>

      {answered && response.confidence !== null && (
        <p className="answer-card__confidence">
          <Icon name="info" size={14} />
          {confidenceLabel(response.confidence)}
        </p>
      )}

      {answer && <AnswerText text={answer} citations={response.citations} idPrefix={idPrefix} />}
      {!answered && response.answer && <p className="answer-card__text">{response.answer}</p>}

      {response.citations.length > 0 && (
        <>
          {answer && <p className="answer-card__label">Sources</p>}
          <CitationList
            citations={response.citations}
            showSnippets={!answer}
            idPrefix={idPrefix}
          />
        </>
      )}

      {response.contacts.length > 0 && (
        <>
          <p className="answer-card__label">
            {response.contacts.length === 1 ? 'Contact this office' : 'Contact these offices'}
          </p>
          <ul className="answer-card__contacts">
            {response.contacts.map((office) => (
              <li key={office.id}>
                <OfficeContact office={office} />
              </li>
            ))}
          </ul>
        </>
      )}

      {response.links.length > 0 && (
        <ul className="answer-card__links">
          {response.links.map((link) => (
            <li key={link.url}>
              <a href={link.url} target="_blank" rel="noreferrer">
                {link.title} <Icon name="external" size={14} />
              </a>
            </li>
          ))}
        </ul>
      )}

      {actions && <div className="answer-card__actions">{actions}</div>}

      {response.disclaimer && (
        <p className="answer-card__disclaimer">
          <Icon name="info" size={16} />
          <span>{response.disclaimer}</span>
        </p>
      )}
    </section>
  )
}

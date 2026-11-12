import { Fragment, type ReactNode } from 'react'

// Inline marks: **bold**, and citation markers as [1] or the 【1】 some models write.
const INLINE = /(\*\*[^*]+\*\*|[[【]\d+[\]】])/
const CITATION = /^[[【](\d+)[\]】]$/
const LIST_ITEM = /^\s*(?:[-*•]|\d+\.)\s+/

// Turns citation number n into a link, or returns null to leave the marker as plain text.
export type RenderCitation = (n: number) => ReactNode | null

function Inline({ text, renderCitation }: { text: string; renderCitation?: RenderCitation }) {
  return text.split(INLINE).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={index}>{part.slice(2, -2)}</strong>
    }
    const citation = CITATION.exec(part)
    const rendered = citation && renderCitation?.(Number(citation[1]))
    return rendered ? <Fragment key={index}>{rendered}</Fragment> : part
  })
}

// The little Markdown that Ask answers and admin-written FAQ answers use: paragraphs, "- " or
// "1. " list items, and **bold**. It renders just that, as React elements, so the text is never
// inserted as HTML. Citation markers become links only when `renderCitation` returns one.
export function MarkdownText({
  text,
  renderCitation,
  paragraphClassName = 'markdown-text__paragraph',
  listClassName = 'markdown-text__list',
}: {
  text: string
  renderCitation?: RenderCitation
  paragraphClassName?: string
  listClassName?: string
}) {
  const blocks: ReactNode[] = []
  let items: string[] = []

  const flushList = () => {
    if (items.length > 0) {
      blocks.push(
        <ul key={blocks.length} className={listClassName}>
          {items.map((item, index) => (
            <li key={index}>
              <Inline text={item} renderCitation={renderCitation} />
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
        <p key={blocks.length} className={paragraphClassName}>
          <Inline text={line.trim()} renderCitation={renderCitation} />
        </p>,
      )
    }
  }
  flushList()
  return <>{blocks}</>
}

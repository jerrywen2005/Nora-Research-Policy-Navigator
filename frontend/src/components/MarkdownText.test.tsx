import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MarkdownText } from './MarkdownText'

describe('MarkdownText', () => {
  it('renders paragraphs, lists and bold as elements, never as HTML', () => {
    const { container } = render(
      <MarkdownText text={'First **important** point.\n\n- one\n2. two\nAfter <b>the</b> list [1].'} />,
    )

    const paragraphs = container.querySelectorAll('p.markdown-text__paragraph')
    expect(paragraphs).toHaveLength(2)
    expect(screen.getByText('important').tagName).toBe('STRONG')
    expect(container.querySelectorAll('ul.markdown-text__list li')).toHaveLength(2)
    // Markup in the text stays text, and markers without a renderer stay as written.
    expect(paragraphs[1]).toHaveTextContent('After <b>the</b> list [1].')
    expect(container.querySelector('b')).toBeNull()
  })

  it('links the citation markers the renderer returns, and leaves the rest', () => {
    render(
      <MarkdownText
        text="See [1] and 【2】."
        paragraphClassName="custom"
        renderCitation={(n) => (n === 1 ? <a href="#c1">source {n}</a> : null)}
      />,
    )

    expect(screen.getByRole('link', { name: 'source 1' })).toHaveAttribute('href', '#c1')
    expect(screen.getByText(/【2】/)).toHaveClass('custom')
  })
})

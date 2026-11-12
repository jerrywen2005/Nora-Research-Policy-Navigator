import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { AskResponse, Citation } from '../api/types'
import { AnswerCard } from './AnswerCard'
import { DISCLAIMER as SAVED_DISCLAIMER, savedAnswer } from './answerContent'

const DISCLAIMER = 'Nora provides general information, not an official determination.'

function citation(number: number, title = `Policy ${number}`): Citation {
  return {
    number,
    document_id: number,
    title,
    section: `Section ${number}`,
    source_url: `https://policies.unc.edu/Article/${number}`,
    snippet: `Snippet ${number}`,
  }
}

function response(overrides: Partial<AskResponse> = {}): AskResponse {
  return {
    question_id: 1,
    outcome: 'answered',
    answer: 'Ninety days before the term ends [1].',
    citations: [citation(1, 'Postdoctoral Scholar Policy')],
    referral: null,
    confidence: 0.98,
    disclaimer: DISCLAIMER,
    ...overrides,
  }
}

describe('AnswerCard', () => {
  it('shows an answer with linked citations, its sources and the disclaimer', () => {
    render(<AnswerCard response={response()} />)

    expect(screen.getByRole('heading', { name: /answer based on unc research/i })).toBeInTheDocument()
    expect(screen.getByText(/ninety days before the term ends/i)).toBeInTheDocument()
    const source = screen.getByRole('link', { name: /postdoctoral scholar policy/i })
    // The [1] marker jumps to source 1 in the list.
    expect(screen.getByRole('link', { name: '[1]' })).toHaveAttribute(
      'href',
      `#${source.closest('li')?.id}`,
    )
    expect(source).toHaveAttribute('href', 'https://policies.unc.edu/Article/1')
    expect(source).toHaveAttribute('target', '_blank')
    expect(screen.getByText(DISCLAIMER)).toBeInTheDocument()
    // Snippets are only shown when there's no written answer.
    expect(screen.queryByText('Snippet 1')).not.toBeInTheDocument()
  })

  it('renders the Markdown the model writes: paragraphs, lists and bold', () => {
    const answer = 'Yes, under conditions.\n- **Minimal risk:** the IRB may waive it [1].\n- Otherwise a witness signs [2].\nSo ask the IRB.'
    render(<AnswerCard response={response({ answer, citations: [citation(1), citation(2)] })} />)

    const items = screen.getAllByRole('listitem').filter((li) => !li.id)
    expect(items.map((li) => li.textContent)).toEqual([
      'Minimal risk: the IRB may waive it [1].',
      'Otherwise a witness signs [2].',
    ])
    expect(screen.getByText('Minimal risk:').tagName).toBe('STRONG')
    expect(screen.getByText('Yes, under conditions.').tagName).toBe('P')
    expect(screen.getByText('So ask the IRB.').tagName).toBe('P')
  })

  it('links 【n】 citations and leaves unknown numbers as plain text', () => {
    render(<AnswerCard response={response({ answer: 'Covered 【1】, not [7].' })} />)

    expect(screen.getByRole('link', { name: '[1]' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '[7]' })).not.toBeInTheDocument()
    expect(screen.getByText(/not \[7\]/)).toBeInTheDocument()
  })

  it('never turns model output into HTML', () => {
    const answer = 'See <img src=x onerror="alert(1)"> and <script>alert(1)</script> [1].'
    const { container } = render(<AnswerCard response={response({ answer })} />)

    expect(container.querySelector('img, script')).toBeNull()
    expect(screen.getByText(/<script>alert\(1\)<\/script>/)).toBeInTheDocument()
  })

  it.each([
    [0.98, 'Strong match with the policies'],
    [0.5, 'Strong match with the policies'],
    [0.3, 'Moderate match with the policies'],
    [0.15, 'Moderate match with the policies'],
    [0.05, 'Partial match: check the sources below'],
  ])('labels confidence %s as "%s"', (confidence, label) => {
    render(<AnswerCard response={response({ confidence })} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('shows matching sources with snippets when there is no written answer', () => {
    render(<AnswerCard response={response({ answer: null, citations: [citation(1), citation(2)] })} />)

    expect(screen.getByRole('heading', { name: /relevant sources/i })).toBeInTheDocument()
    expect(screen.getByText('Snippet 1')).toBeInTheDocument()
    expect(screen.getByText('Snippet 2')).toBeInTheDocument()
  })

  it('shows a referral with the office and no confidence label', () => {
    const referral = {
      id: 3,
      name: 'Office of the Vice Chancellor for Research',
      email: 'research@unc.edu',
      phone: null,
      url: null,
    }
    render(
      <AnswerCard
        response={response({
          outcome: 'referred',
          answer: "Nora couldn't find this in the research policies it covers.",
          citations: [],
          referral,
          confidence: 0.0001,
        })}
      />,
    )

    expect(screen.getByRole('heading', { name: /couldn't find a confident answer/i })).toBeInTheDocument()
    expect(screen.getByText(/couldn't find this in the research policies/i)).toBeInTheDocument()
    expect(screen.getByText(referral.name)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'research@unc.edu' })).toHaveAttribute(
      'href',
      'mailto:research@unc.edu',
    )
    expect(screen.queryByText(/match with the policies/i)).not.toBeInTheDocument()
    expect(screen.getByText(DISCLAIMER)).toBeInTheDocument()
  })

  it('shows sources and an office when the policies matched but gave no answer', () => {
    render(
      <AnswerCard
        response={response({
          outcome: 'no_answer',
          answer: "The policies Nora found don't clearly answer this.",
          citations: [citation(1, 'Export Controls Policy')],
          referral: { id: 4, name: 'Export Compliance Office', email: null, phone: null, url: null },
        })}
      />,
    )

    expect(screen.getByText('Export Controls Policy')).toBeInTheDocument()
    expect(screen.getByText('Snippet 1')).toBeInTheDocument()
    expect(screen.getByText('Export Compliance Office')).toBeInTheDocument()
  })

  it('gives each card its own citation anchors, so several can share a page', () => {
    render(
      <>
        <AnswerCard response={response()} />
        <AnswerCard response={response()} />
      </>,
    )

    const [first, second] = screen.getAllByRole('link', { name: '[1]' })
    expect(first.getAttribute('href')).not.toEqual(second.getAttribute('href'))
    for (const marker of [first, second]) {
      expect(document.querySelector(marker.getAttribute('href') ?? '')).not.toBeNull()
    }
  })

  it('shows a saved answer with its sources and the disclaimer, without a confidence label', () => {
    render(
      <AnswerCard
        response={savedAnswer({
          id: 41,
          question_text: 'How long can I be a postdoc?',
          outcome: 'answered',
          answer_text: 'Five years [1].',
          citations: [{ ...citation(1, 'Postdoctoral Scholar Policy'), section: '', snippet: '' }],
          referral: null,
          created_at: '2026-11-11T15:01:12Z',
        })}
        actions={<button type="button">Saved</button>}
      />,
    )

    expect(screen.getByText(/five years/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /postdoctoral scholar policy/i })).toBeInTheDocument()
    expect(screen.queryByText(/match with the policies/i)).not.toBeInTheDocument()
    expect(screen.getByText(SAVED_DISCLAIMER)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Saved' })).toBeInTheDocument()
  })
})

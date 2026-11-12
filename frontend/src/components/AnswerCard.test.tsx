import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { AskResponse, Citation } from '../api/types'
import { AnswerCard } from './AnswerCard'
import { savedAnswer } from './answerContent'

const DISCLAIMER = 'Nora provides general information, not an official determination.'
const RCS = { id: 9, name: 'Research Compliance Services', email: 'rcs@unc.edu', phone: null, url: null }

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
    contacts: [RCS],
    confidence: 0.98,
    disclaimer: DISCLAIMER,
    links: [],
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

    // The first list on the card is the answer's own, before the sources and contacts.
    const items = within(screen.getAllByRole('list')[0]).getAllByRole('listitem')
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

  it('lists every office to contact with an answer', () => {
    const osp = { id: 2, name: 'Office of Sponsored Programs', email: null, phone: null, url: null }
    render(<AnswerCard response={response({ contacts: [osp, RCS] })} />)

    expect(screen.getByText('Contact these offices')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Office of Sponsored Programs'),
        expect.stringContaining('Research Compliance Services'),
      ]),
    )
  })

  it('refers a research question it cannot answer to RCS, without a disclaimer', () => {
    render(
      <AnswerCard
        response={response({
          outcome: 'referred',
          answer: "Nora couldn't find a confident answer in UNC's research policies.",
          citations: [],
          contacts: [RCS],
          confidence: 0.0001,
          disclaimer: null,
        })}
      />,
    )

    expect(screen.getByRole('heading', { name: /couldn't find a confident answer/i })).toBeInTheDocument()
    expect(screen.getByText(/couldn't find a confident answer in unc/i)).toBeInTheDocument()
    expect(screen.getByText('Contact this office')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'rcs@unc.edu' })).toHaveAttribute(
      'href',
      'mailto:rcs@unc.edu',
    )
    expect(screen.queryByText(/match with the policies/i)).not.toBeInTheDocument()
    expect(screen.queryByText(DISCLAIMER)).not.toBeInTheDocument()
  })

  it('sends a question that is not about research to the Policy Office and every UNC policy', () => {
    const policyOffice = {
      id: 10,
      name: 'University Policy Office',
      email: null,
      phone: null,
      url: 'https://universitypolicy.unc.edu/about/contact/',
    }
    render(
      <AnswerCard
        response={response({
          outcome: 'out_of_scope',
          answer: "This doesn't look like a question about research policy.",
          citations: [],
          contacts: [policyOffice],
          disclaimer: null,
          links: [{ title: 'UNC Policies, Procedures and Standards', url: 'https://policies.unc.edu/' }],
        })}
      />,
    )

    expect(screen.getByRole('heading', { name: /outside research policy/i })).toBeInTheDocument()
    expect(screen.getByText('University Policy Office')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /office website/i })).toHaveAttribute(
      'href',
      policyOffice.url,
    )
    expect(screen.getByRole('link', { name: /policies, procedures and standards/i })).toHaveAttribute(
      'href',
      'https://policies.unc.edu/',
    )
    expect(screen.queryByText(DISCLAIMER)).not.toBeInTheDocument()
  })

  it('shows sources and an office when the policies matched but gave no answer', () => {
    render(
      <AnswerCard
        response={response({
          outcome: 'no_answer',
          answer: "The policies Nora found don't clearly answer this.",
          citations: [citation(1, 'Export Controls Policy')],
          contacts: [{ id: 4, name: 'Export Compliance Office', email: null, phone: null, url: null }],
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
          contacts: [RCS],
          disclaimer: DISCLAIMER,
          links: [],
          feedback: null,
          created_at: '2026-11-11T15:01:12Z',
        })}
        actions={<button type="button">Saved</button>}
      />,
    )

    expect(screen.getByText(/five years/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /postdoctoral scholar policy/i })).toBeInTheDocument()
    expect(screen.queryByText(/match with the policies/i)).not.toBeInTheDocument()
    expect(screen.getByText(DISCLAIMER)).toBeInTheDocument()
    expect(screen.getByText('Research Compliance Services')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Saved' })).toBeInTheDocument()
  })
})

import { render as renderElement, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AskResponse } from '../api/types'
import type { ReactElement } from 'react'
import { ask, getSaved, rateAnswer, saveItem } from '../pages/researcher/researcherApi'
import SavedProvider from '../saved/SavedProvider'
import { AskSection } from './AskSection'

vi.mock('../pages/researcher/researcherApi', () => ({
  ask: vi.fn(),
  getSaved: vi.fn(),
  saveItem: vi.fn(),
  rateAnswer: vi.fn(),
  clearRating: vi.fn(),
}))
const askMock = vi.mocked(ask)

// AskSection's Save button needs the saved-items context.
function render(element: ReactElement) {
  return renderElement(<SavedProvider>{element}</SavedProvider>)
}

const ANSWER: AskResponse = {
  question_id: 7,
  outcome: 'answered',
  answer: 'Ninety days [1].',
  citations: [
    {
      number: 1,
      document_id: 1,
      title: 'Postdoctoral Scholar Policy',
      section: 'Policy',
      source_url: null,
      snippet: '...',
    },
  ],
  contacts: [],
  confidence: 0.98,
  disclaimer: 'General information only.',
  links: [],
}

describe('AskSection', () => {
  beforeEach(() => {
    askMock.mockReset()
    vi.mocked(getSaved).mockReset().mockResolvedValue([])
  })

  it('asks the typed question and shows the answer', async () => {
    askMock.mockResolvedValue(ANSWER)
    render(<AskSection />)

    await userEvent.type(screen.getByLabelText('Ask a question'), '  How long can I be a postdoc?  ')
    await userEvent.click(screen.getByRole('button', { name: 'Ask' }))

    expect(askMock).toHaveBeenCalledWith({ question: 'How long can I be a postdoc?', topic: null })
    expect(await screen.findByText(/ninety days/i)).toBeInTheDocument()
  })

  it('asks an example question when it is clicked, showing progress meanwhile', async () => {
    let finish: (value: AskResponse) => void = () => {}
    askMock.mockReturnValue(new Promise((resolve) => (finish = resolve)))
    render(<AskSection />)

    await userEvent.click(screen.getByRole('button', { name: 'Is ITAR relevant to my lab?' }))

    expect(askMock).toHaveBeenCalledWith({ question: 'Is ITAR relevant to my lab?', topic: null })
    expect(screen.getByText(/reading the research policies/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ask' })).toBeDisabled()
    finish(ANSWER)
    expect(await screen.findByText(/ninety days/i)).toBeInTheDocument()
    expect(screen.queryByText(/reading the research policies/i)).not.toBeInTheDocument()
  })

  it('shows an error when the request fails', async () => {
    askMock.mockRejectedValue(new Error('network'))
    render(<AskSection />)

    await userEvent.click(screen.getByRole('button', { name: 'Who owns the data from my research?' }))

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument()
  })

  it('lets the user rate and save the answer', async () => {
    askMock.mockResolvedValue(ANSWER)
    vi.mocked(rateAnswer).mockResolvedValue({} as never)
    vi.mocked(saveItem).mockResolvedValue({
      id: 3,
      created_at: '2026-11-11T15:10:00Z',
      kind: 'question',
      document: null,
      question: {
        id: 7,
        question_text: 'How long can I be a postdoc?',
        outcome: 'answered',
        answer_text: ANSWER.answer,
        citations: ANSWER.citations,
        contacts: [],
        disclaimer: ANSWER.disclaimer,
        links: [],
        feedback: null,
        created_at: '2026-11-11T15:01:12Z',
      },
    })
    render(<AskSection />)

    await userEvent.click(screen.getByRole('button', { name: 'Is ITAR relevant to my lab?' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Helpful' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save this answer' }))

    expect(rateAnswer).toHaveBeenCalledWith(7, { helpful: true, comment: null })
    expect(saveItem).toHaveBeenCalledWith({ question_id: 7 })
    expect(screen.getByRole('button', { name: 'Save this answer' })).toHaveAttribute('aria-pressed', 'true')
  })
})

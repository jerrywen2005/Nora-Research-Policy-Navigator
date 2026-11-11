import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AskResponse } from '../api/types'
import { ask } from '../pages/researcher/researcherApi'
import { AskSection } from './AskSection'

vi.mock('../pages/researcher/researcherApi', () => ({ ask: vi.fn() }))
const askMock = vi.mocked(ask)

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
  referral: null,
  confidence: 0.98,
  disclaimer: 'General information only.',
}

describe('AskSection', () => {
  beforeEach(() => {
    askMock.mockReset()
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
})

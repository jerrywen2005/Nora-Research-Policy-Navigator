import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearRating, rateAnswer } from '../pages/researcher/researcherApi'
import { AnswerFeedback } from './AnswerFeedback'

vi.mock('../pages/researcher/researcherApi', () => ({ rateAnswer: vi.fn(), clearRating: vi.fn() }))
const rateMock = vi.mocked(rateAnswer)
const clearMock = vi.mocked(clearRating)

const helpful = () => screen.getByRole('button', { name: 'Helpful' })
const notHelpful = () => screen.getByRole('button', { name: 'Not helpful' })

describe('AnswerFeedback', () => {
  beforeEach(() => {
    rateMock.mockReset().mockResolvedValue({} as never)
    clearMock.mockReset().mockResolvedValue()
  })

  it('rates an answer helpful, and clicking again removes the rating', async () => {
    render(<AnswerFeedback questionId={41} />)

    await userEvent.click(helpful())
    expect(rateMock).toHaveBeenCalledWith(41, { helpful: true, comment: null })
    expect(helpful()).toHaveAttribute('aria-pressed', 'true')
    expect(notHelpful()).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Thanks for your feedback.')).toBeInTheDocument()

    await userEvent.click(helpful())
    expect(clearMock).toHaveBeenCalledWith(41)
    expect(helpful()).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByText(/thanks/i)).not.toBeInTheDocument()
  })

  it('asks for an optional comment on "Not helpful" and sends it', async () => {
    render(<AnswerFeedback questionId={41} />)

    await userEvent.click(notHelpful())
    expect(rateMock).toHaveBeenCalledWith(41, { helpful: false, comment: null })
    await userEvent.type(screen.getByLabelText(/what was missing/i), '  It skipped students.  ')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(rateMock).toHaveBeenLastCalledWith(41, { helpful: false, comment: 'It skipped students.' })
    expect(screen.queryByLabelText(/what was missing/i)).not.toBeInTheDocument()
    expect(screen.getByText('Thanks, your comment was sent.')).toBeInTheDocument()
  })

  it('switches from not helpful to helpful and hides the comment box', async () => {
    render(<AnswerFeedback questionId={41} />)

    await userEvent.click(notHelpful())
    await userEvent.click(helpful())

    expect(rateMock).toHaveBeenLastCalledWith(41, { helpful: true, comment: null })
    expect(screen.queryByLabelText(/what was missing/i)).not.toBeInTheDocument()
    expect(helpful()).toHaveAttribute('aria-pressed', 'true')
  })

  it('says so when the rating fails, and keeps the previous state', async () => {
    rateMock.mockRejectedValue(new Error('network'))
    render(<AnswerFeedback questionId={41} />)

    await userEvent.click(helpful())

    expect(screen.getByText(/couldn't send your feedback/i)).toBeInTheDocument()
    expect(helpful()).toHaveAttribute('aria-pressed', 'false')
  })

  it('starts from the rating the user already gave, and reports each change', async () => {
    const onChange = vi.fn()
    const saved = { question_id: 41, helpful: false, comment: 'Too vague', created_at: '', updated_at: '' }
    const updated = { ...saved, helpful: true, comment: null }
    rateMock.mockResolvedValue(updated)
    render(<AnswerFeedback questionId={41} initial={saved} onChange={onChange} />)

    expect(notHelpful()).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Thanks, your comment was sent.')).toBeInTheDocument()

    await userEvent.click(helpful())
    expect(onChange).toHaveBeenLastCalledWith(updated)

    await userEvent.click(helpful())
    expect(onChange).toHaveBeenLastCalledWith(null)
  })
})

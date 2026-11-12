import { render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SavedProvider from '../../saved/SavedProvider'
import { savedDocumentItem, savedQuestion, savedQuestionItem } from '../../test/fixtures'
import { getSaved, rateAnswer, saveItem, unsaveItem } from './researcherApi'
import SavedPage from './SavedPage'

vi.mock('./researcherApi', () => ({
  getSaved: vi.fn(),
  saveItem: vi.fn(),
  unsaveItem: vi.fn(),
  rateAnswer: vi.fn(),
  clearRating: vi.fn(),
}))
const getSavedMock = vi.mocked(getSaved)
const unsaveMock = vi.mocked(unsaveItem)

function renderPage() {
  render(
    <MemoryRouter>
      <SavedProvider>
        <SavedPage />
      </SavedProvider>
    </MemoryRouter>,
  )
}

describe('SavedPage', () => {
  beforeEach(() => {
    getSavedMock.mockReset()
    vi.mocked(saveItem).mockReset()
    unsaveMock.mockReset().mockResolvedValue()
  })

  it('shows saved answers with their sources and the disclaimer, and saved documents', async () => {
    getSavedMock.mockResolvedValue([savedQuestionItem(8), savedDocumentItem(7)])
    renderPage()

    const answer = await screen.findByRole('article', { name: 'How long can I be a postdoc?' })
    expect(within(answer).getByText(/five years in total/i)).toBeInTheDocument()
    expect(within(answer).getByRole('link', { name: '[1]' })).toBeInTheDocument()
    expect(within(answer).getByRole('link', { name: /postdoctoral scholar policy/i })).toHaveAttribute(
      'href',
      'https://policies.unc.edu/Article/3',
    )
    expect(within(answer).getByText(/not an official determination/i)).toBeInTheDocument()
    expect(within(answer).getByText('Nov 11, 2026')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Export Controls' })).toHaveAttribute('href', '/documents/12')
  })

  it('shows a saved referral with the office to contact', async () => {
    const office = { id: 2, name: 'Office of Sponsored Programs', email: 'osp@unc.edu', phone: null, url: null }
    getSavedMock.mockResolvedValue([
      savedQuestionItem(
        8,
        savedQuestion({
          outcome: 'referred',
          answer_text: 'Contact the office below.',
          citations: [],
          contacts: [office],
          disclaimer: null,
        }),
      ),
    ])
    renderPage()

    expect(await screen.findByText('Office of Sponsored Programs')).toBeInTheDocument()
    expect(screen.getByText('Contact the office below.')).toBeInTheDocument()
  })

  it('removes an item when its Save toggle is turned off', async () => {
    getSavedMock.mockResolvedValue([savedQuestionItem(8)])
    renderPage()

    await userEvent.click(
      await screen.findByRole('button', { name: 'Save How long can I be a postdoc?', pressed: true }),
    )

    expect(unsaveMock).toHaveBeenCalledWith(8)
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    expect(screen.getByText(/nothing saved yet/i)).toBeInTheDocument()
  })

  it('explains how to save when there is nothing saved', async () => {
    getSavedMock.mockResolvedValue([])
    renderPage()

    expect(await screen.findByText(/nothing saved yet/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ask a question' })).toHaveAttribute('href', '/ask')
  })

  it('says so when the list fails to load', async () => {
    getSavedMock.mockRejectedValue(new Error('network'))
    renderPage()

    expect(await screen.findByText(/couldn't be loaded/i)).toBeInTheDocument()
  })

  it('shows the rating the user gave a saved answer', async () => {
    const feedback = { question_id: 41, helpful: true, comment: null, created_at: '', updated_at: '' }
    getSavedMock.mockResolvedValue([savedQuestionItem(8, savedQuestion({ feedback }))])
    renderPage()

    expect(await screen.findByRole('button', { name: 'Helpful' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Not helpful' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('keeps a new rating when the user leaves the page and comes back', async () => {
    getSavedMock.mockResolvedValue([savedQuestionItem(8)])
    vi.mocked(rateAnswer).mockResolvedValue({
      question_id: 41,
      helpful: true,
      comment: null,
      created_at: '',
      updated_at: '',
    })
    // The saved list is loaded once per session, so the page must update it, not just itself.
    function LeaveAndReturn() {
      const [shown, setShown] = useState(true)
      return (
        <>
          <button type="button" onClick={() => setShown(!shown)}>
            Toggle page
          </button>
          {shown && <SavedPage />}
        </>
      )
    }
    render(
      <MemoryRouter>
        <SavedProvider>
          <LeaveAndReturn />
        </SavedProvider>
      </MemoryRouter>,
    )

    await userEvent.click(await screen.findByRole('button', { name: 'Helpful' }))
    await userEvent.click(screen.getByRole('button', { name: 'Toggle page' }))
    await userEvent.click(screen.getByRole('button', { name: 'Toggle page' }))

    expect(screen.getByRole('button', { name: 'Helpful' })).toHaveAttribute('aria-pressed', 'true')
    expect(getSavedMock).toHaveBeenCalledTimes(1)
  })
})

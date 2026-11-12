import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSaved, saveItem, unsaveItem } from '../pages/researcher/researcherApi'
import SavedProvider from '../saved/SavedProvider'
import { savedDocumentItem } from '../test/fixtures'
import { SaveButton } from './SaveButton'

vi.mock('../pages/researcher/researcherApi', () => ({
  getSaved: vi.fn(),
  saveItem: vi.fn(),
  unsaveItem: vi.fn(),
}))
const getSavedMock = vi.mocked(getSaved)
const saveMock = vi.mocked(saveItem)
const unsaveMock = vi.mocked(unsaveItem)

function renderButton() {
  render(
    <SavedProvider>
      <SaveButton target={{ document_id: 12 }} name="Export Controls" />
    </SavedProvider>,
  )
  return screen.getByRole('button', { name: 'Save Export Controls' })
}

describe('SaveButton', () => {
  beforeEach(() => {
    getSavedMock.mockReset().mockResolvedValue([])
    saveMock.mockReset().mockResolvedValue(savedDocumentItem(7))
    unsaveMock.mockReset().mockResolvedValue()
  })

  it('saves, then unsaves, a document', async () => {
    const button = renderButton()
    expect(button).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(button)
    expect(saveMock).toHaveBeenCalledWith({ document_id: 12 })
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(button).toHaveTextContent('Saved')

    await userEvent.click(button)
    expect(unsaveMock).toHaveBeenCalledWith(7)
    expect(button).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows as saved when the user saved it earlier', async () => {
    getSavedMock.mockResolvedValue([savedDocumentItem(7)])
    const button = renderButton()

    expect(await screen.findByRole('button', { name: 'Save Export Controls', pressed: true })).toBe(
      button,
    )
  })

  it('says so when saving fails', async () => {
    saveMock.mockRejectedValue(new Error('network'))
    const button = renderButton()

    await userEvent.click(button)

    expect(screen.getByRole('alert')).toHaveTextContent(/couldn't save it/i)
    expect(button).toHaveAttribute('aria-pressed', 'false')
  })

  it('still lets the user save when the list could not be loaded', async () => {
    getSavedMock.mockRejectedValue(new Error('network'))
    const button = renderButton()

    await userEvent.click(button)

    expect(button).toHaveAttribute('aria-pressed', 'true')
  })
})

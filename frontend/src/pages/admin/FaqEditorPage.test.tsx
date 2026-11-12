import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import type { AdminDocument } from '../../api/types'
import { adminFaq, documentSummary } from '../../test/fixtures'
import {
  changeFaqStatus,
  createFaq,
  deleteFaq,
  getAdminFaq,
  getTopics,
  listAdminDocuments,
  updateFaq,
} from './adminApi'
import FaqEditorPage from './FaqEditorPage'

vi.mock('./adminApi', () => ({
  getAdminFaq: vi.fn(),
  getTopics: vi.fn(),
  createFaq: vi.fn(),
  updateFaq: vi.fn(),
  changeFaqStatus: vi.fn(),
  deleteFaq: vi.fn(),
  listAdminDocuments: vi.fn(),
}))
const getFaqMock = vi.mocked(getAdminFaq)
const createMock = vi.mocked(createFaq)
const updateMock = vi.mocked(updateFaq)
const statusMock = vi.mocked(changeFaqStatus)
const deleteMock = vi.mocked(deleteFaq)
const searchMock = vi.mocked(listAdminDocuments)

const irb = { id: 1, slug: 'human-subjects-research', name: 'Human Research & IRB', description: '', document_count: 0, tags: [] }
const grants = { id: 4, slug: 'grants', name: 'Sponsored Programs', description: '', document_count: 0, tags: [] }

function adminDocument(overrides: Partial<AdminDocument> = {}): AdminDocument {
  return {
    ...documentSummary(),
    status: 'active',
    created_at: '2026-11-10T18:00:00Z',
    updated_at: '2026-11-11T18:30:00Z',
    updated_by: null,
    ...overrides,
  }
}

function renderPage(path = '/admin/faqs/3') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="admin/faqs/:id" element={<FaqEditorPage />} />
        <Route path="admin/faqs" element={<p>FAQ list</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('FaqEditorPage', () => {
  beforeEach(() => {
    for (const mock of [getFaqMock, createMock, updateMock, statusMock, deleteMock, searchMock]) mock.mockReset()
    vi.mocked(getTopics).mockResolvedValue([irb, grants])
  })

  it('writes a new FAQ as a draft and opens it', async () => {
    const draft = adminFaq({ id: 9, question: 'New question?', answer: 'New answer.', topic: null, sources: [] })
    createMock.mockResolvedValue(draft)
    getFaqMock.mockResolvedValue(draft)
    renderPage('/admin/faqs/new')

    const save = await screen.findByRole('button', { name: 'Save draft' })
    expect(save).toBeDisabled() // question and answer are required
    expect(screen.queryByRole('heading', { name: 'Status' })).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Question'), '  New question?  ')
    await userEvent.type(screen.getByLabelText('Answer'), 'New answer with **bold**.')
    expect(within(screen.getByLabelText('Answer preview')).getByText('bold').tagName).toBe('STRONG')
    await userEvent.click(save)

    expect(createMock).toHaveBeenCalledWith({
      question: 'New question?',
      answer: 'New answer with **bold**.',
      topic_id: null,
      document_ids: [],
      sort_order: 0,
    })
    expect(await screen.findByRole('heading', { name: 'New question?' })).toBeInTheDocument()
    expect(screen.getByText(/Saved as a draft. Researchers see it once/)).toBeInTheDocument()
    expect(getFaqMock).toHaveBeenCalledWith('9')
  })

  it('shows why a new FAQ could not be saved, and cancels back to the list', async () => {
    createMock.mockRejectedValue(new ApiError('POST', '/admin/faqs', 422, 'Unknown document id'))
    renderPage('/admin/faqs/new')

    await userEvent.type(await screen.findByLabelText('Question'), 'Q?')
    await userEvent.type(screen.getByLabelText('Answer'), 'A.')
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Unknown document id')

    await userEvent.click(screen.getByRole('link', { name: 'Cancel' }))
    expect(screen.getByText('FAQ list')).toBeInTheDocument()
  })

  it('edits an FAQ, its topic, order and sources, then saves the whole form', async () => {
    getFaqMock.mockResolvedValue(adminFaq())
    updateMock.mockImplementation(async (_id, request) =>
      adminFaq({ question: request.question, topic: { id: 4, slug: 'grants', name: 'Sponsored Programs' }, sources: [], sort_order: 2 }),
    )
    renderPage()

    expect(await screen.findByText(/Updated Nov 12, 2026 by Test Admin/)).toBeInTheDocument()
    const save = screen.getByRole('button', { name: 'Save changes' })
    expect(save).toBeDisabled()

    await userEvent.clear(screen.getByLabelText('Question'))
    await userEvent.type(screen.getByLabelText('Question'), 'Edited?')
    await userEvent.selectOptions(screen.getByLabelText('Topic'), 'Sponsored Programs')
    await userEvent.clear(screen.getByLabelText('Display order'))
    await userEvent.type(screen.getByLabelText('Display order'), '2')
    await userEvent.click(screen.getByRole('button', { name: 'Remove Use of Existing Data' }))
    expect(screen.getByText(/No sources yet/)).toBeInTheDocument()
    expect(screen.getByText('Save or discard your changes first.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()

    await userEvent.click(save)
    expect(updateMock).toHaveBeenCalledWith(3, {
      question: 'Edited?',
      answer: adminFaq().answer,
      topic_id: 4,
      document_ids: [],
      sort_order: 2,
    })
    expect(await screen.findByText('Changes saved.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Edited?' })).toBeInTheDocument()
  })

  it('discards edits, clears a topic and keeps a bad order at 0', async () => {
    getFaqMock.mockResolvedValue(adminFaq({ updated_by: { id: 2, onyen: 'admin1', display_name: null } }))
    renderPage()

    expect(await screen.findByText(/by admin1/)).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Topic'), 'No topic')
    await userEvent.clear(screen.getByLabelText('Display order'))
    expect(screen.getByLabelText('Display order')).toHaveValue(0)
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(screen.getByLabelText('Topic')).toHaveValue('1')
  })

  it('finds policies to cite and adds them, without submitting the FAQ form', async () => {
    getFaqMock.mockResolvedValue(adminFaq({ sources: [], updated_by: null }))
    searchMock.mockResolvedValueOnce({
      items: [
        adminDocument({ id: 12, title: 'Existing Data Policy' }),
        adminDocument({ id: 13, title: 'Old Draft', status: 'draft' }),
      ],
      total: 2,
    })
    renderPage()

    const find = await screen.findByLabelText('Find a policy')
    await userEvent.click(screen.getByRole('button', { name: 'Search' })) // blank: nothing happens
    expect(searchMock).not.toHaveBeenCalled()
    await userEvent.type(find, 'existing data{Enter}')
    expect(searchMock).toHaveBeenCalledWith({ q: 'existing data', limit: 10 })
    expect(updateMock).not.toHaveBeenCalled()

    const draftRow = (await screen.findByText('Old Draft')).closest('li') as HTMLElement
    expect(within(draftRow).getByText(/not visible to researchers/)).toBeInTheDocument()
    const policyRow = screen.getByText('Existing Data Policy').closest('li') as HTMLElement
    await userEvent.click(within(policyRow).getByRole('button', { name: 'Add' }))
    expect(within(policyRow).getByRole('button', { name: 'Added' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove Existing Data Policy' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled()

    searchMock.mockResolvedValueOnce({ items: [], total: 0 })
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(await screen.findByText('No policies match.')).toBeInTheDocument()

    searchMock.mockRejectedValueOnce(new Error('down'))
    await userEvent.type(find, '{Enter}')
    expect(await screen.findByText("The search didn't work. Try again.")).toBeInTheDocument()
  })

  it('publishes a draft that has a topic, then archives it', async () => {
    getFaqMock.mockResolvedValue(adminFaq())
    statusMock.mockResolvedValueOnce(adminFaq({ status: 'published' }))
    statusMock.mockResolvedValueOnce(adminFaq({ status: 'archived' }))
    renderPage()

    expect(await screen.findByText(/Ready to publish/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }))
    expect(statusMock).toHaveBeenCalledWith(3, 'publish')
    expect(await screen.findByText('Published. Researchers can now see this FAQ.')).toBeInTheDocument()
    expect(screen.getByText(/researchers see it on the FAQ page/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Archive' }))
    expect(statusMock).toHaveBeenLastCalledWith(3, 'archive')
    expect(await screen.findByText('Archived. Researchers no longer see this FAQ.')).toBeInTheDocument()
  })

  it("can't publish a draft without a topic, and shows the API's refusal", async () => {
    getFaqMock.mockResolvedValue(adminFaq({ topic: null }))
    statusMock.mockRejectedValue(new ApiError('POST', '/admin/faqs/3/archive', 409, 'Already archived'))
    renderPage()

    expect(await screen.findByText(/Choose a topic and save before publishing/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Archive' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Already archived')
  })

  it.each([
    ['publish', { status: 'draft' as const }, 'Publish', "The FAQ couldn't be published."],
    ['restore', { status: 'archived' as const }, 'Restore as draft', "The FAQ couldn't be restored."],
  ])('falls back to a general message when %s fails without a detail', async (_action, overrides, button, text) => {
    getFaqMock.mockResolvedValue(adminFaq(overrides))
    statusMock.mockRejectedValue(new Error('network'))
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: button }))
    expect(await screen.findByRole('alert')).toHaveTextContent(text)
  })

  it('restores an archived FAQ as a draft', async () => {
    getFaqMock.mockResolvedValue(adminFaq({ status: 'archived' }))
    statusMock.mockResolvedValue(adminFaq({ status: 'draft' }))
    renderPage()

    expect(await screen.findByText(/Archived: hidden from researchers/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Restore as draft' }))
    expect(statusMock).toHaveBeenCalledWith(3, 'restore')
    expect(await screen.findByText('Restored as a draft. Review it and publish it again.')).toBeInTheDocument()
  })

  it('deletes an archived FAQ only after confirming', async () => {
    getFaqMock.mockResolvedValue(adminFaq({ status: 'archived' }))
    deleteMock.mockResolvedValue()
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Delete permanently' }))
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveTextContent(`Permanently delete “${adminFaq().question}”?`)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(deleteMock).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Delete permanently' }))
    await userEvent.click(screen.getByRole('button', { name: 'Yes, delete permanently' }))
    expect(deleteMock).toHaveBeenCalledWith(3)
    expect(await screen.findByText('FAQ list')).toBeInTheDocument()
  })

  it('shows why a delete failed', async () => {
    getFaqMock.mockResolvedValue(adminFaq({ status: 'archived' }))
    deleteMock.mockRejectedValue(new Error('network'))
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Delete permanently' }))
    await userEvent.click(screen.getByRole('button', { name: 'Yes, delete permanently' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("The FAQ couldn't be deleted.")
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it.each([
    [new ApiError('GET', '/admin/faqs/3', 404, 'Not found'), 'This FAQ was not found.'],
    [new Error('network'), "This FAQ couldn't be loaded."],
  ])('says when the FAQ cannot be loaded', async (error, text) => {
    getFaqMock.mockRejectedValue(error)
    renderPage()
    expect(await screen.findByText(text)).toBeInTheDocument()
  })
})

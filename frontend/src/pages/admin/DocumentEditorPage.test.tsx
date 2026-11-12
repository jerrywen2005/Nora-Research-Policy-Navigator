import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import type { AdminDocumentDetail } from '../../api/types'
import { documentSummary } from '../../test/fixtures'
import {
  changeStatus,
  deleteDocument,
  getAdminDocument,
  getOffices,
  getTags,
  getTopics,
  updateDocument,
} from './adminApi'
import DocumentEditorPage from './DocumentEditorPage'

vi.mock('./adminApi', () => ({
  getAdminDocument: vi.fn(),
  getOffices: vi.fn(),
  getTopics: vi.fn(),
  getTags: vi.fn(),
  updateDocument: vi.fn(),
  changeStatus: vi.fn(),
  deleteDocument: vi.fn(),
}))
const getDocumentMock = vi.mocked(getAdminDocument)
const updateMock = vi.mocked(updateDocument)
const changeStatusMock = vi.mocked(changeStatus)
const deleteMock = vi.mocked(deleteDocument)

const office = { id: 2, name: 'Office of Sponsored Programs', email: null, phone: null, url: null }
const irb = { id: 1, slug: 'irb', name: 'Human Research & IRB', description: '', document_count: 0, tags: [] }
const grants = { id: 4, slug: 'grants', name: 'Sponsored Programs', description: '', document_count: 0, tags: [] }
const tags = [1, 2, 3, 4, 5, 6].map((id) => ({ id, slug: `tag-${id}`, name: `Tag ${id}`, definition: null }))

function adminDocument(overrides: Partial<AdminDocumentDetail> = {}): AdminDocumentDetail {
  return {
    ...documentSummary({ office: null, topics: [], tags: [], is_authoritative: false }),
    status: 'draft',
    created_at: '2026-11-10T18:00:00Z',
    updated_at: '2026-11-11T18:30:00Z',
    updated_by: { id: 2, onyen: 'admin1', display_name: 'Test Admin' },
    content_text: '## Purpose\nThe imported text.',
    ...overrides,
  }
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/admin/documents/12']}>
      <Routes>
        <Route path="admin/documents/:id" element={<DocumentEditorPage />} />
        <Route path="admin/library" element={<p>Library page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('DocumentEditorPage', () => {
  beforeEach(() => {
    getDocumentMock.mockReset()
    updateMock.mockReset()
    changeStatusMock.mockReset()
    deleteMock.mockReset()
    vi.mocked(getOffices).mockResolvedValue([office])
    vi.mocked(getTopics).mockResolvedValue([irb, grants])
    vi.mocked(getTags).mockResolvedValue(tags)
  })

  it('shows the draft, its text, and why it cannot be published yet', async () => {
    getDocumentMock.mockResolvedValue(adminDocument())
    renderPage()

    expect(await screen.findByRole('heading', { level: 1, name: 'Export Controls' })).toBeInTheDocument()
    expect(getDocumentMock).toHaveBeenCalledWith('12')
    expect(screen.getByText('Draft')).toBeInTheDocument()
    expect(screen.getByText(/by Test Admin/)).toBeInTheDocument()
    expect(screen.getByText(/The imported text/)).toBeVisible()
    expect(screen.getByText(/add an office and a topic and save before publishing/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  })

  it('saves the edited metadata, then publishes', async () => {
    const user = userEvent.setup()
    getDocumentMock.mockResolvedValue(adminDocument({ tags: [tags[0]] }))
    const saved = adminDocument({ office, topics: [grants], tags: [tags[0], tags[2]], is_authoritative: true, doc_type: 'guidance' })
    updateMock.mockResolvedValue(saved)
    changeStatusMock.mockResolvedValue({ ...saved, status: 'active' })
    renderPage()

    await user.selectOptions(await screen.findByLabelText('Type'), 'guidance')
    await user.selectOptions(screen.getByLabelText('Owning office'), 'Office of Sponsored Programs')
    await user.click(screen.getByRole('checkbox', { name: 'Sponsored Programs' }))
    await user.selectOptions(screen.getByLabelText('Add a tag'), 'Tag 3')
    await user.click(screen.getByRole('checkbox', { name: /official source/i }))
    expect(screen.getByText('Save or discard your changes first.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Archive' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(updateMock).toHaveBeenCalledWith(12, {
      doc_type: 'guidance',
      office_id: 2,
      topic_ids: [4],
      tag_ids: [1, 3],
      is_authoritative: true,
    })
    expect(await screen.findByText('Changes saved.')).toBeInTheDocument()
    expect(screen.getByText(/ready to publish/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Publish' }))

    expect(changeStatusMock).toHaveBeenCalledWith(12, 'publish')
    expect(await screen.findByText(/researchers can now see this document/i)).toBeInTheDocument()
    expect(screen.getByText('Published')).toBeInTheDocument()
  })

  it('removes tags, allows at most five, and discards unsaved changes', async () => {
    const user = userEvent.setup()
    getDocumentMock.mockResolvedValue(adminDocument({ tags: tags.slice(0, 5), office }))
    renderPage()

    const select = await screen.findByLabelText('Add a tag')
    expect(select).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Remove Tag 2' }))
    expect(select).toBeEnabled()
    await user.selectOptions(screen.getByLabelText('Owning office'), 'No office')

    await user.click(screen.getByRole('button', { name: 'Discard' }))

    expect(screen.getByRole('button', { name: 'Remove Tag 2' })).toBeInTheDocument()
    expect(screen.getByLabelText('Owning office')).toHaveValue('2')
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  })

  it('shows the API error when a save fails', async () => {
    const user = userEvent.setup()
    getDocumentMock.mockResolvedValue(adminDocument({ status: 'active', office, topics: [irb] }))
    updateMock.mockRejectedValue(new ApiError('PATCH', '/admin/documents/12', 422, 'A published document must have an office'))
    renderPage()

    await user.selectOptions(await screen.findByLabelText('Owning office'), 'No office')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('A published document must have an office')
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument()
  })

  it('archives a published document, and falls back to a general message', async () => {
    const user = userEvent.setup()
    const published = adminDocument({ status: 'active', office, topics: [irb] })
    getDocumentMock.mockResolvedValue(published)
    changeStatusMock.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ ...published, status: 'archived' })
    renderPage()

    expect(await screen.findByText(/published: researchers can see it/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Archive' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("The document couldn't be updated.")

    await user.click(screen.getByRole('button', { name: 'Archive' }))
    expect(changeStatusMock).toHaveBeenLastCalledWith(12, 'archive')
    expect(await screen.findByText(/no longer see this document/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Restore as draft' })).toBeInTheDocument()
  })

  it('restores an archived document as a draft', async () => {
    const user = userEvent.setup()
    getDocumentMock.mockResolvedValue(adminDocument({ status: 'archived' }))
    changeStatusMock.mockResolvedValue(adminDocument({ status: 'draft' }))
    renderPage()

    expect(await screen.findByText(/hidden from researchers and answers, but kept/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Restore as draft' }))

    expect(changeStatusMock).toHaveBeenCalledWith(12, 'restore')
    expect(await screen.findByText(/restored as a draft/i)).toBeInTheDocument()
  })

  it('deletes permanently only after a confirmation that names the document', async () => {
    const user = userEvent.setup()
    getDocumentMock.mockResolvedValue(adminDocument({ status: 'archived' }))
    deleteMock.mockResolvedValue()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Delete permanently' }))
    const dialog = screen.getByRole('alertdialog', { name: /permanently delete “export controls”/i })
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(deleteMock).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Delete permanently' }))
    await user.click(screen.getByRole('button', { name: 'Yes, delete permanently' }))

    expect(deleteMock).toHaveBeenCalledWith(12)
    expect(await screen.findByText('Library page')).toBeInTheDocument()
  })

  it('shows why a permanent delete failed', async () => {
    const user = userEvent.setup()
    getDocumentMock.mockResolvedValue(adminDocument({ status: 'archived', source_url: null, citation: 'POL 1', updated_by: null }))
    deleteMock.mockRejectedValue(new ApiError('DELETE', '/admin/documents/12', 409, 'Archive the document before deleting it permanently'))
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Delete permanently' }))
    await user.click(screen.getByRole('button', { name: 'Yes, delete permanently' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Archive the document before deleting it permanently')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /view in the repository/i })).not.toBeInTheDocument()
  })

  it.each([
    [new ApiError('GET', '/admin/documents/12', 404, 'Document not found'), 'This document was not found.'],
    [new Error('network'), "This document couldn't be loaded."],
  ])('says when the document cannot be shown', async (error, text) => {
    getDocumentMock.mockRejectedValue(error)
    renderPage()

    expect(await screen.findByText(text)).toBeInTheDocument()
  })
})

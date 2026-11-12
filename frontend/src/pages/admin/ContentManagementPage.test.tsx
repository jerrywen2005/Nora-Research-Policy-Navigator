import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import type { AdminDocumentDetail } from '../../api/types'
import { documentSummary } from '../../test/fixtures'
import { importDocument, listAdminDocuments } from './adminApi'
import ContentManagementPage from './ContentManagementPage'

vi.mock('./adminApi', () => ({ importDocument: vi.fn(), listAdminDocuments: vi.fn() }))
const importMock = vi.mocked(importDocument)
const listMock = vi.mocked(listAdminDocuments)

const LINK = 'https://policies.unc.edu/TDClient/2833/Portal/KB/Article/132183'

const draft: AdminDocumentDetail = {
  ...documentSummary({ id: 30, title: 'Imported Policy' }),
  status: 'draft',
  created_at: '2026-11-12T10:00:00Z',
  updated_at: '2026-11-12T10:00:00Z',
  updated_by: null,
  content_text: '',
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/admin/content']}>
      <Routes>
        <Route path="admin/content" element={<ContentManagementPage />} />
        <Route path="admin/documents/:id" element={<p>Editor page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ContentManagementPage', () => {
  beforeEach(() => {
    importMock.mockReset()
    listMock.mockReset().mockResolvedValue({ items: [draft], total: 1 })
  })

  it('lists drafts to review', async () => {
    renderPage()

    expect(await screen.findByRole('link', { name: 'Imported Policy' })).toHaveAttribute('href', '/admin/documents/30')
    expect(listMock).toHaveBeenCalledWith({ status: 'draft', limit: 100 })
  })

  it('adds a document by its Repository link and opens it', async () => {
    const user = userEvent.setup()
    importMock.mockResolvedValue(draft)
    renderPage()

    await user.type(screen.getByLabelText('Repository link'), ` ${LINK} `)
    await user.click(screen.getByRole('button', { name: 'Add as draft' }))

    expect(importMock).toHaveBeenCalledWith(LINK)
    expect(await screen.findByText('Editor page')).toBeInTheDocument()
  })

  it('links to the existing document when the article was already added', async () => {
    const user = userEvent.setup()
    importMock.mockRejectedValue(new ApiError('POST', '/admin/documents', 409, 'This article is already document 12'))
    renderPage()

    await user.type(screen.getByLabelText('Repository link'), LINK)
    await user.click(screen.getByRole('button', { name: 'Add as draft' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('This article is already document 12')
    expect(screen.getByRole('link', { name: 'Open document 12' })).toHaveAttribute('href', '/admin/documents/12')
    expect(screen.getByRole('button', { name: 'Add as draft' })).toBeEnabled()
  })

  it.each([
    [new ApiError('POST', '/admin/documents', 422, 'Not a Research Policy Repository article link (policies.unc.edu)'), /not a research policy repository/i],
    [new Error('network'), /couldn't be added/i],
  ])('shows why an import failed', async (error, text) => {
    const user = userEvent.setup()
    importMock.mockRejectedValue(error)
    renderPage()

    await user.type(screen.getByLabelText('Repository link'), 'https://example.com/x')
    await user.click(screen.getByRole('button', { name: 'Add as draft' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(text)
    expect(screen.queryByRole('link', { name: /open document/i })).not.toBeInTheDocument()
  })

  it('says when there are no drafts, or they cannot be loaded', async () => {
    listMock.mockResolvedValue({ items: [], total: 0 })
    renderPage()
    expect(await screen.findByText('No drafts waiting for review.')).toBeInTheDocument()

    listMock.mockRejectedValue(new Error('network'))
    renderPage()
    expect(await screen.findByText("The drafts couldn't be loaded.")).toBeInTheDocument()
  })
})

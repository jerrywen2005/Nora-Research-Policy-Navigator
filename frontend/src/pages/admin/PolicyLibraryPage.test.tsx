import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdminDocument } from '../../api/types'
import { documentSummary } from '../../test/fixtures'
import { getTopics, listAdminDocuments } from './adminApi'
import PolicyLibraryPage from './PolicyLibraryPage'

vi.mock('./adminApi', () => ({ getTopics: vi.fn(), listAdminDocuments: vi.fn() }))
const listMock = vi.mocked(listAdminDocuments)

function adminDocument(id: number, overrides: Partial<AdminDocument> = {}): AdminDocument {
  return {
    ...documentSummary({ id, title: `Policy ${id}` }),
    status: 'active',
    created_at: '2026-11-10T18:00:00Z',
    updated_at: '2026-11-11T18:30:00Z',
    updated_by: null,
    ...overrides,
  }
}

function Location() {
  const location = useLocation()
  return <p data-testid="location">{location.search}</p>
}

function renderPage(path = '/admin/library') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="admin/library" element={<PolicyLibraryPage />} />
      </Routes>
      <Location />
    </MemoryRouter>,
  )
}

describe('PolicyLibraryPage', () => {
  beforeEach(() => {
    listMock.mockReset().mockResolvedValue({
      items: [
        adminDocument(1, {
          citation: 'POL 1',
          office: { id: 2, name: 'OSP', email: null, phone: null, url: null },
          topics: [{ id: 4, slug: 'grants', name: 'Sponsored Programs' }],
        }),
        adminDocument(2, { status: 'draft' }),
      ],
      total: 2,
    })
    vi.mocked(getTopics).mockReset().mockResolvedValue([
      { id: 4, slug: 'grants', name: 'Sponsored Programs', description: '', document_count: 1, tags: [] },
    ])
  })

  it('lists documents of every status, linking each to its editor', async () => {
    renderPage()

    const table = await screen.findByRole('table', { name: 'Documents' })
    expect(within(table).getByRole('link', { name: 'Policy 1' })).toHaveAttribute('href', '/admin/documents/1')
    expect(within(table).getByText('Published')).toBeInTheDocument()
    expect(within(table).getByText('Draft')).toBeInTheDocument()
    expect(within(table).getByText('OSP')).toBeInTheDocument()
    expect(within(table).getAllByText('None')).toHaveLength(2) // the draft has no topic or office
    expect(screen.getByText('Showing 1–2 of 2')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Pages' })).not.toBeInTheDocument()
    expect(listMock).toHaveBeenCalledWith({ q: '', status: undefined, topic: '', limit: 20, offset: 0 })
  })

  it('searches and filters through the URL, back to the first page', async () => {
    const user = userEvent.setup()
    renderPage('/admin/library?page=3')
    await screen.findByRole('table')

    await user.type(screen.getByRole('searchbox', { name: 'Search' }), '  export  ')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    expect(screen.getByTestId('location')).toHaveTextContent('?q=export')

    await user.selectOptions(screen.getByLabelText('Status'), 'Archived')
    await screen.findByRole('option', { name: 'Sponsored Programs' }) // the topics have loaded
    await user.selectOptions(screen.getByLabelText('Topic'), 'grants')

    expect(screen.getByTestId('location')).toHaveTextContent('?q=export&status=archived&topic=grants')
    expect(listMock).toHaveBeenLastCalledWith({ q: 'export', status: 'archived', topic: 'grants', limit: 20, offset: 0 })

    await user.selectOptions(screen.getByLabelText('Status'), 'All statuses')
    expect(screen.getByTestId('location')).toHaveTextContent('?q=export&topic=grants')
  })

  it('pages through more than 20 documents', async () => {
    const user = userEvent.setup()
    listMock.mockResolvedValue({ items: [adminDocument(1)], total: 45 })
    renderPage()

    const pager = await screen.findByRole('navigation', { name: 'Pages' })
    expect(within(pager).getByText('Page 1 of 3')).toBeInTheDocument()
    expect(within(pager).getByRole('button', { name: 'Previous' })).toBeDisabled()

    await user.click(within(pager).getByRole('button', { name: 'Next' }))

    expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument()
    expect(screen.getByText('Showing 21–21 of 45')).toBeInTheDocument()
    expect(listMock).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 20 }))

    await user.click(screen.getByRole('button', { name: 'Previous' }))
    expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument()
  })

  it('says when nothing matches or loading fails', async () => {
    listMock.mockResolvedValue({ items: [], total: 0 })
    renderPage()
    expect(await screen.findByText('No documents match.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()

    listMock.mockRejectedValue(new Error('network'))
    renderPage('/admin/library?q=x')
    expect(await screen.findByText("The documents couldn't be loaded.")).toBeInTheDocument()
  })
})

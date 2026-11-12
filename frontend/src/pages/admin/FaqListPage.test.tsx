import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { adminFaq } from '../../test/fixtures'
import { getTopics, listAdminFaqs } from './adminApi'
import FaqListPage from './FaqListPage'

vi.mock('./adminApi', () => ({
  getTopics: vi.fn(),
  listAdminFaqs: vi.fn(),
}))
const listMock = vi.mocked(listAdminFaqs)

const irb = { id: 1, slug: 'irb', name: 'Human Research & IRB', description: '', document_count: 0, tags: [] }

function Location() {
  const location = useLocation()
  return <p data-testid="location">{location.pathname + location.search}</p>
}

function renderPage(path = '/admin/faqs') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="admin/faqs" element={<FaqListPage />} />
      </Routes>
      <Location />
    </MemoryRouter>,
  )
}

describe('FaqListPage', () => {
  beforeEach(() => {
    listMock.mockReset()
    vi.mocked(getTopics).mockResolvedValue([irb])
  })

  it('lists FAQs of every status, calling out a missing topic', async () => {
    listMock.mockResolvedValue([
      adminFaq({ id: 1, question: 'Published one?', status: 'published', topic: { id: 1, slug: 'irb', name: 'IRB' } }),
      adminFaq({ id: 2, question: 'Draft one?', status: 'draft', topic: null, sources: [] }),
    ])
    renderPage()

    const rows = within(await screen.findByRole('table')).getAllByRole('row')
    expect(rows).toHaveLength(3)
    expect(within(rows[1]).getByRole('link', { name: 'Published one?' })).toHaveAttribute('href', '/admin/faqs/1')
    expect(within(rows[1]).getByText('Published')).toHaveClass('status-badge--active')
    expect(within(rows[1]).getByText('1')).toBeInTheDocument() // one source
    expect(within(rows[2]).getByText('None')).toBeInTheDocument()
    expect(listMock).toHaveBeenCalledWith({ status: undefined, topic: '' })
    expect(screen.getByRole('link', { name: 'New FAQ' })).toHaveAttribute('href', '/admin/faqs/new')
  })

  it('filters by status and topic through the URL', async () => {
    listMock.mockResolvedValue([])
    renderPage()
    expect(await screen.findByText('No FAQs yet. Write the first one.')).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'archived')
    await userEvent.selectOptions(await screen.findByLabelText('Topic'), 'irb')

    expect(screen.getByTestId('location')).toHaveTextContent('/admin/faqs?status=archived&topic=irb')
    expect(listMock).toHaveBeenLastCalledWith({ status: 'archived', topic: 'irb' })
    expect(await screen.findByText('No FAQs match.')).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Status'), '')
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/faqs?topic=irb')
  })

  it('says when the FAQs could not be loaded', async () => {
    listMock.mockRejectedValue(new Error('down'))
    vi.mocked(getTopics).mockRejectedValue(new Error('down'))
    renderPage()
    expect(await screen.findByText("The FAQs couldn't be loaded.")).toBeInTheDocument()
  })
})

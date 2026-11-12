import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import type { TopicDetail } from '../../api/types'
import SavedProvider from '../../saved/SavedProvider'
import { documentSummary, faq } from '../../test/fixtures'
import { getDocuments, getFaqs, getSaved, getTopic } from './researcherApi'
import TopicPage from './TopicPage'

vi.mock('./researcherApi', () => ({
  getDocuments: vi.fn(),
  getFaqs: vi.fn(),
  getTopic: vi.fn(),
  getSaved: vi.fn(),
  saveItem: vi.fn(),
  unsaveItem: vi.fn(),
}))
const getDocumentsMock = vi.mocked(getDocuments)
const getTopicMock = vi.mocked(getTopic)
const getFaqsMock = vi.mocked(getFaqs)

const topic: TopicDetail = {
  id: 1,
  slug: 'sponsored-programs',
  name: 'Sponsored Programs',
  description: 'Grants and contracts.',
  document_count: 2,
  tags: [
    { id: 3, slug: 'budgets', name: 'Budgets', definition: 'Use for budget rules.' },
    { id: 4, slug: 'effort', name: 'Effort Reporting', definition: null },
  ],
  office: { id: 2, name: 'Office of Sponsored Programs', email: null, phone: null, url: null },
}

function Location() {
  const location = useLocation()
  return <p data-testid="location">{location.pathname + location.search}</p>
}

function renderPage(path = '/browse/sponsored-programs') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <SavedProvider>
        <Routes>
          <Route path="browse/:slug" element={<TopicPage />} />
        </Routes>
        <Location />
      </SavedProvider>
    </MemoryRouter>,
  )
}

describe('TopicPage', () => {
  beforeEach(() => {
    getTopicMock.mockReset().mockResolvedValue(topic)
    getDocumentsMock.mockReset().mockImplementation(async (query) =>
      query.tag
        ? { items: [documentSummary({ id: 2, title: 'Budget Policy' })], total: 1 }
        : {
            items: [documentSummary({ id: 1, title: 'Grant Policy' }), documentSummary({ id: 2, title: 'Budget Policy' })],
            total: 2,
          },
    )
    vi.mocked(getSaved).mockReset().mockResolvedValue([])
    getFaqsMock.mockReset().mockResolvedValue([])
  })

  it('lists every document in the topic, with its office', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { level: 1, name: 'Sponsored Programs' })).toBeInTheDocument()
    expect(await screen.findByText('2 documents')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Grant Policy' })).toHaveAttribute('href', '/documents/1')
    expect(screen.getByText('Office of Sponsored Programs')).toBeInTheDocument()
    expect(getDocumentsMock).toHaveBeenCalledWith({ topic: 'sponsored-programs', tag: '', limit: 100 })
  })

  it('filters by one subtopic tag, kept in the URL, without reloading the topic', async () => {
    const user = userEvent.setup()
    renderPage()
    const filter = await screen.findByRole('group', { name: 'Filter by subtopic' })
    expect(within(filter).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(within(filter).getByRole('button', { name: 'Budgets' }))

    expect(await screen.findByText(/^1 document ·/)).toBeInTheDocument()
    expect(within(filter).getByRole('button', { name: 'Budgets' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(filter).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('location')).toHaveTextContent('/browse/sponsored-programs?tag=budgets')
    expect(screen.getByRole('link', { name: /this subtopic across all topics/i })).toHaveAttribute(
      'href',
      '/tags/budgets',
    )
    expect(getDocumentsMock).toHaveBeenLastCalledWith({ topic: 'sponsored-programs', tag: 'budgets', limit: 100 })
    expect(getTopicMock).toHaveBeenCalledTimes(1)

    await user.click(within(filter).getByRole('button', { name: 'All' }))

    expect(await screen.findByText('2 documents')).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/browse\/sponsored-programs$/)
  })

  it('starts filtered when the URL has a tag', async () => {
    renderPage('/browse/sponsored-programs?tag=budgets')

    expect(await screen.findByText(/^1 document ·/)).toBeInTheDocument()
  })

  it('has no filter or office panel when the topic has neither', async () => {
    getTopicMock.mockResolvedValue({ ...topic, tags: [], office: null })
    renderPage()

    expect(await screen.findByText('2 documents')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Filter by subtopic' })).not.toBeInTheDocument()
    expect(screen.queryByText('Responsible office')).not.toBeInTheDocument()
  })

  it('says an unknown topic was not found', async () => {
    getTopicMock.mockRejectedValue(new ApiError('GET', '/topics/x', 404, 'Topic not found'))
    renderPage()

    expect(await screen.findByText('This topic was not found.')).toBeInTheDocument()
  })

  it('says when the topic or its documents could not be loaded', async () => {
    getDocumentsMock.mockRejectedValue(new Error('network'))
    renderPage()

    expect(await screen.findByText("The documents couldn't be loaded.")).toBeInTheDocument()

    getTopicMock.mockRejectedValue(new Error('network'))
    renderPage('/browse/other')
    expect(await screen.findByText("This topic couldn't be loaded.")).toBeInTheDocument()
  })

  it("shows the topic's first three FAQs and links to the rest", async () => {
    getFaqsMock.mockResolvedValue([1, 2, 3, 4].map((id) => faq({ id, question: `Question ${id}?` })))
    renderPage()

    const section = await screen.findByRole('region', { name: 'Frequently asked questions' })
    expect(getFaqsMock).toHaveBeenCalledWith({ topic: 'sponsored-programs' })
    expect(within(section).getByText('Question 3?')).toBeInTheDocument()
    expect(within(section).queryByText('Question 4?')).not.toBeInTheDocument()
    expect(within(section).getByRole('link', { name: 'See all 4 FAQs for this topic' })).toHaveAttribute(
      'href',
      '/faqs?topic=sponsored-programs',
    )
  })

  it('shows a single FAQ without a link to more', async () => {
    getFaqsMock.mockResolvedValue([faq()])
    renderPage()

    expect(await screen.findByText(faq().question)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /See all/ })).not.toBeInTheDocument()
  })

  it('leaves out the FAQ section when the FAQs fail to load', async () => {
    getFaqsMock.mockRejectedValue(new Error('network'))
    renderPage()

    expect(await screen.findByText('2 documents')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Frequently asked questions' })).not.toBeInTheDocument()
  })
})

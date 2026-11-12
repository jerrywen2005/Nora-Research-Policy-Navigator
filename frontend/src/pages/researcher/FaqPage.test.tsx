import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Topic } from '../../api/types'
import { faq } from '../../test/fixtures'
import FaqPage from './FaqPage'
import { getFaqs, getTopics } from './researcherApi'

vi.mock('./researcherApi', () => ({
  getFaqs: vi.fn(),
  getTopics: vi.fn(),
}))
const getFaqsMock = vi.mocked(getFaqs)

function topic(id: number, slug: string, name: string): Topic {
  return { id, slug, name, description: '', document_count: 0, tags: [] }
}
const irb = topic(1, 'human-subjects-research', 'Human Research & IRB')
const grants = topic(4, 'sponsored-programs', 'Sponsored Programs')
const empty = topic(5, 'postdoctoral-affairs', 'Postdoctoral Affairs')

const irbFaq = faq()
const grantsFaq = faq({
  id: 7,
  question: 'When is my proposal due to OSP?',
  answer: 'Five business days before the sponsor deadline.\n- Budget\n- Narrative',
  topic: { id: 4, slug: 'sponsored-programs', name: 'Sponsored Programs' },
  sources: [{ id: 20, title: 'Proposal Deadline Policy', doc_type: 'policy', citation: null }],
})
const orphanFaq = faq({ id: 8, question: 'An FAQ whose topic was removed?', topic: null, sources: [] })

function Location() {
  const location = useLocation()
  return <p data-testid="location">{location.pathname + location.search}</p>
}

function renderPage(path = '/faqs') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="faqs" element={<FaqPage />} />
      </Routes>
      <Location />
    </MemoryRouter>,
  )
}

describe('FaqPage', () => {
  beforeEach(() => {
    getFaqsMock.mockReset().mockResolvedValue([grantsFaq, irbFaq, orphanFaq])
    vi.mocked(getTopics).mockReset().mockResolvedValue([irb, grants, empty])
  })

  it("groups published FAQs by topic in the topics' order, with Other last", async () => {
    renderPage()

    const headings = await screen.findAllByRole('heading', { level: 2 })
    expect(headings.map((h) => h.textContent)).toEqual(['Human Research & IRB', 'Sponsored Programs', 'Other'])
    expect(getFaqsMock).toHaveBeenCalledWith()
    // Topics without FAQs get no filter chip; "Other" isn't a filter either.
    const filter = screen.getByRole('group', { name: 'Filter by topic' })
    expect(within(filter).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'All',
      'Human Research & IRB',
      'Sponsored Programs',
    ])
  })

  it('opens an FAQ to show its answer as Markdown and its source policies', async () => {
    renderPage()

    await userEvent.click(await screen.findByText(grantsFaq.question))
    const item = screen.getByText(grantsFaq.question).closest('details') as HTMLElement
    expect(item).toHaveAttribute('open')
    expect(within(item).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Budget',
      'Narrative',
      'Proposal Deadline Policy',
    ])
    expect(within(item).getByRole('link', { name: 'Proposal Deadline Policy' })).toHaveAttribute('href', '/documents/20')

    const irbItem = screen.getByText(irbFaq.question).closest('details') as HTMLElement
    expect(within(irbItem).getByText('can’t').tagName).toBe('STRONG')
    expect(within(irbItem).getByText(/OHRE SOP 1301/)).toBeInTheDocument()
  })

  it('filters by one topic, kept in the URL', async () => {
    renderPage()
    const filter = await screen.findByRole('group', { name: 'Filter by topic' })

    await userEvent.click(within(filter).getByRole('button', { name: 'Sponsored Programs' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/faqs?topic=sponsored-programs')
    expect(within(filter).getByRole('button', { name: 'Sponsored Programs' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Sponsored Programs'])

    await userEvent.click(within(filter).getByRole('button', { name: 'All' }))
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/faqs$/)
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(3)
  })

  it('starts filtered from the URL, and says when a topic has no FAQs', async () => {
    renderPage('/faqs?topic=postdoctoral-affairs')
    expect(await screen.findByText('This topic has no FAQs yet.')).toBeInTheDocument()
  })

  it('has no filter when there is only one group', async () => {
    getFaqsMock.mockResolvedValue([irbFaq])
    renderPage()
    expect(await screen.findByText(irbFaq.question)).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Filter by topic' })).not.toBeInTheDocument()
  })

  it('says when there are no FAQs, or they could not be loaded', async () => {
    getFaqsMock.mockResolvedValue([])
    renderPage()
    expect(await screen.findByText('There are no FAQs yet.')).toBeInTheDocument()

    getFaqsMock.mockRejectedValue(new Error('network'))
    renderPage()
    expect(await screen.findByText("The FAQs couldn't be loaded.")).toBeInTheDocument()
  })
})

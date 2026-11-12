import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import type { Analytics } from '../../api/types'
import AdminOverview from './AdminOverview'
import { getAnalytics } from './adminApi'
import { presetRange } from './dateRange'

vi.mock('./adminApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./adminApi')>()),
  getAnalytics: vi.fn(),
}))
const getMock = vi.mocked(getAnalytics)

const TOPIC = { id: 1, slug: 'human-subjects-research', name: 'Human Research & IRB' }
const RCS = { id: 9, name: 'Research Compliance Services', email: 'rcs@unc.edu', phone: null, url: null }

function analytics(overrides: Partial<Analytics> = {}): Analytics {
  const { from, to } = presetRange(30)
  return {
    from,
    to,
    min_distinct_users: 2,
    activity: { active_users: 42, logins: 118 },
    interactions: { topic_views: 310, document_views: 522, searches: 204, questions: 100 },
    top_topics: [{ topic: TOPIC, count: 88 }],
    top_documents: [{ document_id: 12, title: 'Use of Existing Data', count: 41 }],
    most_cited_documents: [{ document_id: 3, title: 'Postdoctoral Scholar Policy', count: 23 }],
    top_search_terms: [{ text: 'irb exempt', count: 17 }],
    zero_result_searches: { total: 31, top_terms: [{ text: 'lab notebook retention', count: 4 }] },
    top_questions: [{ text: 'do i need irb approval?', count: 6 }],
    questions_by_outcome: { answered: 70, referred: 15, out_of_scope: 4, no_answer: 9, error: 2 },
    referrals_by_office: [{ office: RCS, count: 24 }],
    feedback: { rated: 40, helpful: 33, helpful_share: 0.825 },
    daily: [
      { date: from, logins: 4, topic_views: 9, document_views: 15, searches: 6, questions: 3 },
      { date: to, logins: 5, topic_views: 8, document_views: 11, searches: 12, questions: 7 },
    ],
    daily_questions_by_topic: [
      { date: from, topic: TOPIC, count: 1 },
      { date: to, topic: TOPIC, count: 5 },
      { date: to, topic: null, count: 2 },
    ],
    ...overrides,
  }
}

function Location() {
  return <p data-testid="location">{useLocation().search}</p>
}

function renderPage(path = '/admin') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/admin"
          element={
            <>
              <AdminOverview />
              <Location />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

const panel = (name: string) => screen.getByRole('region', { name })
// A label shows in its chart and again in the chart's data table.
const panelShows = (name: string, text: string) =>
  within(panel(name)).getAllByText(text).length > 0

describe('AdminOverview', () => {
  beforeEach(() => {
    getMock.mockReset().mockResolvedValue(analytics())
  })

  it('shows every measure for the default range, with the CSV export for it', async () => {
    renderPage()

    expect(await screen.findByText('42')).toBeInTheDocument() // active users
    expect(getMock).toHaveBeenCalledWith({})
    const { from, to } = presetRange(30)
    expect(screen.getByRole('button', { name: 'Last 30 days' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('link', { name: 'Download CSV' })).toHaveAttribute(
      'href',
      `/api/admin/analytics/export.csv?from=${from}&to=${to}`,
    )
    // Tiles: users, interactions, couldn't answer (100 - 70), helpful share.
    expect(screen.getByText('118 sign-ins')).toBeInTheDocument()
    expect(screen.getByText('70% answered')).toBeInTheDocument()
    expect(screen.getByText('31 with no results')).toBeInTheDocument()
    expect(screen.getByText('832')).toBeInTheDocument()
    expect(screen.getByText('15 to RCS, 4 not research')).toBeInTheDocument()
    expect(screen.getAllByText('83%').length).toBeGreaterThan(0)
    // Each ranked list, by its panel.
    expect(panelShows('Most Viewed Topics', 'Human Research & IRB')).toBe(true)
    expect(panelShows('Most Viewed Policies', 'Use of Existing Data')).toBe(true)
    expect(panelShows('Most Cited Policies', 'Postdoctoral Scholar Policy')).toBe(true)
    expect(panelShows('Top Search Terms', 'irb exempt')).toBe(true)
    expect(panelShows('Searches With No Results', 'lab notebook retention')).toBe(true)
    expect(panelShows('Most Asked Questions', 'do i need irb approval?')).toBe(true)
    expect(panelShows('Referrals by Office', 'Research Compliance Services')).toBe(true)
    expect(panelShows('Answer Outcomes', 'Not about research (Policy Office)')).toBe(true)
    expect(within(panel('Feedback Overview')).getAllByText('Not helpful').length).toBeGreaterThan(0)
  })

  it('shows which topics generate more questions over the range', async () => {
    renderPage()

    const topics = await screen.findByRole('region', { name: 'Questions by Topic' })
    const rows = within(topics).getAllByRole('row').map((row) => row.textContent)
    // Topic, total, first half, second half.
    expect(rows).toContain('Human Research & IRB615')
    expect(rows).toContain('Asked without a topic202')
  })

  it('switches the activity chart between measures', async () => {
    renderPage()
    const activity = await screen.findByRole('region', { name: 'Activity Over Time' })
    // The chart draws once it has measured its width.
    expect((await within(activity).findByRole('img')).getAttribute('aria-label')).toContain(
      '7 questions',
    )

    await userEvent.click(within(activity).getByRole('button', { name: 'Searches' }))

    expect(within(activity).getByRole('img').getAttribute('aria-label')).toContain('12 searches')
    expect(within(activity).getByText('Searches per day')).toBeInTheDocument()
  })

  it('loads a preset or a custom range and keeps it in the URL', async () => {
    renderPage()
    await screen.findByText('42')

    await userEvent.click(screen.getByRole('button', { name: 'Last 7 days' }))
    const week = presetRange(7)
    expect(getMock).toHaveBeenLastCalledWith(week)
    expect(screen.getByTestId('location')).toHaveTextContent(`?from=${week.from}&to=${week.to}`)

    const fromInput = screen.getByLabelText('From')
    await userEvent.clear(fromInput)
    await userEvent.type(fromInput, '2026-09-01')
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(getMock).toHaveBeenLastCalledWith({ from: '2026-09-01', to: week.to })
  })

  it('reads the range from the URL', async () => {
    renderPage('/admin?from=2026-10-01&to=2026-10-31')

    await screen.findByText('42')
    expect(getMock).toHaveBeenCalledWith({ from: '2026-10-01', to: '2026-10-31' })
  })

  it('explains empty measures instead of drawing empty charts', async () => {
    getMock.mockResolvedValue(
      analytics({
        interactions: { topic_views: 0, document_views: 0, searches: 0, questions: 0 },
        top_topics: [],
        top_search_terms: [],
        questions_by_outcome: { answered: 0, referred: 0, out_of_scope: 0, no_answer: 0, error: 0 },
        feedback: { rated: 0, helpful: 0, helpful_share: null },
        daily_questions_by_topic: [],
      }),
    )
    renderPage()

    expect(await screen.findByText('No ratings yet')).toBeInTheDocument()
    expect(screen.getByText('None yet')).toBeInTheDocument()
    expect(panelShows('Most Viewed Topics', 'Nothing in this range yet.')).toBe(true)
    expect(within(panel('Top Search Terms')).getByText(/at least 2 different people/)).toBeInTheDocument()
    expect(within(panel('Feedback Overview')).getByText(/no answers have been rated/i)).toBeInTheDocument()
    expect(panelShows('Answer Outcomes', 'Nothing in this range yet.')).toBe(true)
  })

  it('says why a range was rejected, or that loading failed', async () => {
    getMock.mockRejectedValue(new ApiError('GET', '/admin/analytics', 422, null))
    renderPage('/admin?from=2026-11-10&to=2026-11-01')
    expect(await screen.findByText(/date range isn’t valid/)).toBeInTheDocument()
  })

  it('says when analytics could not be loaded', async () => {
    getMock.mockRejectedValue(new Error('network'))
    renderPage()
    expect(await screen.findByText(/couldn’t be loaded/)).toBeInTheDocument()
  })
})

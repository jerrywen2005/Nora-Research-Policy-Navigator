import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import type { DocumentDetail } from '../../api/types'
import SavedProvider from '../../saved/SavedProvider'
import { documentSummary } from '../../test/fixtures'
import DocumentPage from './DocumentPage'
import { getDocument, getSaved } from './researcherApi'

vi.mock('./researcherApi', () => ({
  getDocument: vi.fn(),
  getSaved: vi.fn(),
  saveItem: vi.fn(),
  unsaveItem: vi.fn(),
}))
const getDocumentMock = vi.mocked(getDocument)

const office = { id: 2, name: 'Office of Research Security', email: 'ors@unc.edu', phone: null, url: null }

function documentDetail(overrides: Partial<DocumentDetail> = {}): DocumentDetail {
  return {
    ...documentSummary({
      citation: 'POL 12',
      office,
      topics: [{ id: 5, slug: 'international-research-and-security', name: 'International Research' }],
      tags: [{ id: 3, slug: 'export-controls', name: 'Export Controls', definition: 'Use for ITAR and EAR.' }],
      last_reviewed_at: '2026-08-01',
    }),
    content_text: '## Purpose\nFull text.',
    related_documents: [{ id: 14, title: 'Foreign Travel', doc_type: 'guidance', citation: 'GUI 4' }],
    ...overrides,
  }
}

function renderPage(id = '12') {
  render(
    <MemoryRouter initialEntries={[`/documents/${id}`]}>
      <SavedProvider>
        <Routes>
          <Route path="documents/:id" element={<DocumentPage />} />
        </Routes>
      </SavedProvider>
    </MemoryRouter>,
  )
}

describe('DocumentPage', () => {
  beforeEach(() => {
    getDocumentMock.mockReset()
    vi.mocked(getSaved).mockReset().mockResolvedValue([])
  })

  it('shows the summary, Repository link, office, topics, tags and related policies', async () => {
    getDocumentMock.mockResolvedValue(documentDetail())
    renderPage()

    expect(await screen.findByRole('heading', { level: 1, name: 'Export Controls' })).toBeInTheDocument()
    expect(getDocumentMock).toHaveBeenCalledWith('12')
    expect(screen.getByText('When export rules apply to research.')).toBeInTheDocument()
    expect(screen.getByText('POL 12')).toBeInTheDocument()
    expect(screen.getByText('Official')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /read the full text in the repository/i })).toHaveAttribute(
      'href',
      documentSummary().source_url,
    )
    expect(screen.getByText('Office of Research Security')).toBeInTheDocument()
    expect(screen.getByText('Last reviewed 2026-08-01')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save Export Controls' })).toBeInTheDocument()

    const subtopics = screen.getByRole('region', { name: 'Subtopics' })
    expect(within(subtopics).getByRole('link', { name: 'Export Controls' })).toHaveAttribute(
      'href',
      '/tags/export-controls',
    )
    const related = screen.getByRole('region', { name: 'Related policies' })
    expect(within(related).getByRole('link', { name: /foreign travel/i })).toHaveAttribute('href', '/documents/14')
    expect(within(related).getByText(/GUI 4/)).toBeInTheDocument()

    const topics = screen.getByRole('region', { name: 'Topics' })
    expect(within(topics).getByRole('link', { name: /international research/i })).toHaveAttribute(
      'href',
      '/browse/international-research-and-security',
    )
    // The back link goes to the document's first topic.
    for (const link of screen.getAllByRole('link', { name: /^international research$/i })) {
      expect(link).toHaveAttribute('href', '/browse/international-research-and-security')
    }
  })

  it('leaves out what the document lacks', async () => {
    getDocumentMock.mockResolvedValue(
      documentDetail({
        summary: null,
        source_url: null,
        citation: null,
        office: null,
        topics: [],
        tags: [],
        related_documents: [],
        is_authoritative: false,
        last_reviewed_at: null,
      }),
    )
    renderPage()

    expect(await screen.findByText(/no summary yet/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /repository/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Subtopics' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Related policies' })).not.toBeInTheDocument()
    expect(screen.queryByText('Responsible office')).not.toBeInTheDocument()
    expect(screen.queryByText('Official')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /all topics/i })).toHaveAttribute('href', '/browse')
  })

  it.each([404, 422])('says a missing document (%i) was not found', async (status) => {
    getDocumentMock.mockRejectedValue(new ApiError('GET', '/documents/abc', status, 'Not found'))
    renderPage('abc')

    expect(await screen.findByText('This document was not found.')).toBeInTheDocument()
  })

  it('says when the document could not be loaded', async () => {
    getDocumentMock.mockRejectedValue(new Error('network'))
    renderPage()

    expect(await screen.findByText("This document couldn't be loaded.")).toBeInTheDocument()
  })
})

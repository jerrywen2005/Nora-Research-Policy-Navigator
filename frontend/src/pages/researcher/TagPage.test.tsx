import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SavedProvider from '../../saved/SavedProvider'
import { documentSummary } from '../../test/fixtures'
import { getDocuments, getSaved, getTags } from './researcherApi'
import TagPage from './TagPage'

vi.mock('./researcherApi', () => ({
  getDocuments: vi.fn(),
  getTags: vi.fn(),
  getSaved: vi.fn(),
  saveItem: vi.fn(),
  unsaveItem: vi.fn(),
}))
const getDocumentsMock = vi.mocked(getDocuments)
const getTagsMock = vi.mocked(getTags)

const exportTag = { id: 3, slug: 'export-controls', name: 'Export Controls', definition: 'Use for ITAR and EAR.' }

function renderPage(slug = 'export-controls') {
  render(
    <MemoryRouter initialEntries={[`/tags/${slug}`]}>
      <SavedProvider>
        <Routes>
          <Route path="tags/:slug" element={<TagPage />} />
        </Routes>
      </SavedProvider>
    </MemoryRouter>,
  )
}

describe('TagPage', () => {
  beforeEach(() => {
    getDocumentsMock.mockReset()
    getTagsMock.mockReset().mockResolvedValue([exportTag])
    vi.mocked(getSaved).mockReset().mockResolvedValue([])
  })

  it('lists every policy with the tag, across topics', async () => {
    getDocumentsMock.mockResolvedValue({
      items: [documentSummary({ id: 1, title: 'Export Policy' }), documentSummary({ id: 2, title: 'Travel' })],
      total: 2,
    })
    renderPage()

    expect(await screen.findByRole('heading', { level: 1, name: 'Export Controls' })).toBeInTheDocument()
    expect(screen.getByText('Use for ITAR and EAR.')).toBeInTheDocument()
    expect(screen.getByText('2 policies across all topics')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Export Policy' })).toHaveAttribute('href', '/documents/1')
    expect(getDocumentsMock).toHaveBeenCalledWith({ tag: 'export-controls', limit: 100 })
  })

  it('handles one result and a tag without a definition', async () => {
    getTagsMock.mockResolvedValue([{ ...exportTag, definition: null }])
    getDocumentsMock.mockResolvedValue({ items: [documentSummary()], total: 1 })
    renderPage()

    expect(await screen.findByText('1 policy across all topics')).toBeInTheDocument()
    expect(screen.queryByText('Use for ITAR and EAR.')).not.toBeInTheDocument()
  })

  it('says an unknown tag was not found', async () => {
    getDocumentsMock.mockResolvedValue({ items: [], total: 0 })
    renderPage('no-such-tag')

    expect(await screen.findByText('This subtopic was not found.')).toBeInTheDocument()
  })

  it('says when the tag could not be loaded', async () => {
    getDocumentsMock.mockRejectedValue(new Error('network'))
    renderPage()

    expect(await screen.findByText("This subtopic couldn't be loaded.")).toBeInTheDocument()
  })
})

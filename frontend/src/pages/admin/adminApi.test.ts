import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  analyticsExportUrl,
  changeStatus,
  deleteDocument,
  getAdminDocument,
  getAnalytics,
  getOffices,
  getTags,
  getTopics,
  importDocument,
  listAdminDocuments,
  updateDocument,
} from './adminApi'

afterEach(() => {
  vi.unstubAllGlobals()
})

function stubFetch(status: number, body?: unknown) {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(body === undefined ? null : JSON.stringify(body), { status }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const json = { 'Content-Type': 'application/json' }

describe('adminApi', () => {
  it('lists documents, leaving out empty parameters', async () => {
    const fetchMock = stubFetch(200, { items: [], total: 0 })
    await listAdminDocuments({ q: '', status: 'draft', topic: 'irb', limit: 20, offset: 0 })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/documents?status=draft&topic=irb&limit=20&offset=0')
  })

  it('gets one document, escaping the id', async () => {
    const fetchMock = stubFetch(200, { id: 1 })
    await getAdminDocument('a/b')
    expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/documents/a%2Fb')
  })

  it('imports by link', async () => {
    const fetchMock = stubFetch(201, { id: 1 })
    await importDocument('https://policies.unc.edu/x')
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/documents', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ source_url: 'https://policies.unc.edu/x' }),
    })
  })

  it('edits metadata with PATCH', async () => {
    const fetchMock = stubFetch(200, { id: 1 })
    await updateDocument(1, { office_id: null })
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/documents/1', {
      method: 'PATCH',
      headers: json,
      body: JSON.stringify({ office_id: null }),
    })
  })

  it('changes status', async () => {
    const fetchMock = stubFetch(200, { id: 1 })
    await changeStatus(1, 'restore')
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/documents/1/restore', {
      method: 'POST',
      headers: undefined,
      body: undefined,
    })
  })

  it('deletes with confirm=true', async () => {
    const fetchMock = stubFetch(204)
    await expect(deleteDocument(1)).resolves.toBeUndefined()
    expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/documents/1?confirm=true')
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE')
  })

  it.each([
    [getOffices, '/api/offices'],
    [getTopics, '/api/topics'],
    [getTags, '/api/tags'],
  ])('gets the editor picker lists', async (get, path) => {
    const fetchMock = stubFetch(200, [])
    await get()
    expect(fetchMock.mock.calls[0][0]).toBe(path)
  })
})

describe('analytics', () => {
  it('asks for a date range, or the API default without one', async () => {
    let fetchMock = stubFetch(200, { from: '2026-11-01' })
    await expect(getAnalytics({ from: '2026-11-01', to: '2026-11-07' })).resolves.toEqual({
      from: '2026-11-01',
    })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/analytics?from=2026-11-01&to=2026-11-07',
      expect.objectContaining({ method: 'GET' }),
    )

    fetchMock = stubFetch(200, {})
    await getAnalytics({})
    expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/analytics?')
  })

  it('links the CSV export for the same range', () => {
    expect(analyticsExportUrl({ from: '2026-11-01', to: '2026-11-07' })).toBe(
      '/api/admin/analytics/export.csv?from=2026-11-01&to=2026-11-07',
    )
  })
})

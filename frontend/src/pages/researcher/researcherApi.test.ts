import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import {
  ask,
  clearRating,
  getDocument,
  getDocuments,
  getSaved,
  getTags,
  rateAnswer,
  saveItem,
  unsaveItem,
} from './researcherApi'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ask', () => {
  it('posts the question to /api/ask and returns the response', async () => {
    const body = { question_id: 1, outcome: 'referred' }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(ask({ question: 'Hi?', topic: null })).resolves.toEqual(body)
    expect(fetchMock).toHaveBeenCalledWith('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Hi?', topic: null }),
    })
  })

  it('rejects with the API error for a bad request', async () => {
    const error = { detail: 'Topic not found' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(error), { status: 404 })))

    const result = ask({ question: 'Hi?', topic: 'nope' })

    await expect(result).rejects.toBeInstanceOf(ApiError)
    await expect(result).rejects.toMatchObject({ status: 404, detail: 'Topic not found' })
  })
})

function stubFetch(status: number, body?: unknown) {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(body === undefined ? null : JSON.stringify(body), { status }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('feedback', () => {
  it('rates an answer with PUT and removes the rating with DELETE', async () => {
    const feedback = { question_id: 41, helpful: false, comment: 'Too vague' }
    let fetchMock = stubFetch(200, feedback)

    await expect(rateAnswer(41, { helpful: false, comment: 'Too vague' })).resolves.toEqual(feedback)
    expect(fetchMock).toHaveBeenCalledWith('/api/questions/41/feedback', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ helpful: false, comment: 'Too vague' }),
    })

    fetchMock = stubFetch(204)
    await expect(clearRating(41)).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith('/api/questions/41/feedback', {
      method: 'DELETE',
      headers: undefined,
      body: undefined,
    })
  })
})

describe('saved items', () => {
  it('lists, saves and removes saved items', async () => {
    let fetchMock = stubFetch(200, [])
    await expect(getSaved()).resolves.toEqual([])
    expect(fetchMock).toHaveBeenCalledWith('/api/saved', expect.objectContaining({ method: 'GET' }))

    const item = { id: 7, kind: 'document' }
    fetchMock = stubFetch(201, item)
    await expect(saveItem({ document_id: 12 })).resolves.toEqual(item)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/saved',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ document_id: 12 }) }),
    )

    fetchMock = stubFetch(204)
    await expect(unsaveItem(7)).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith('/api/saved/7', expect.objectContaining({ method: 'DELETE' }))
  })
})

describe('documents and tags', () => {
  it('gets one document by id, escaping the id', async () => {
    let fetchMock = stubFetch(200, { id: 12 })
    await expect(getDocument('12')).resolves.toEqual({ id: 12 })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/documents/12')

    fetchMock = stubFetch(404, { detail: 'Document not found' })
    await expect(getDocument('a/b')).rejects.toMatchObject({ status: 404 })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/documents/a%2Fb')
  })

  it('lists tags', async () => {
    const fetchMock = stubFetch(200, [])
    await expect(getTags()).resolves.toEqual([])
    expect(fetchMock.mock.calls[0][0]).toBe('/api/tags')
  })

  it('filters documents by topic and tag, leaving out empty parameters', async () => {
    const fetchMock = stubFetch(200, { items: [], total: 0 })
    await getDocuments({ topic: 'irb', tag: '', limit: 100 })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/documents?topic=irb&limit=100')
  })
})

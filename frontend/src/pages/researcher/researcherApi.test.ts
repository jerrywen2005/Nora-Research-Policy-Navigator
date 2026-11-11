import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import { ask } from './researcherApi'

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

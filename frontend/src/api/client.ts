// All requests use relative /api paths. The Vite proxy (dev) or nginx (prod)
// forwards them to FastAPI, so the frontend never needs the backend's URL.
// Request and response types are in ./types.ts (see docs/api.md).
const API_BASE = '/api'

// Thrown for any non-2xx response. `status` lets callers react to 401 (send to
// sign-in) or 403 (wrong role); `detail` is FastAPI's error message, if any.
export class ApiError extends Error {
  status: number
  detail: string | null

  constructor(method: string, path: string, status: number, detail: string | null) {
    super(`${method} ${path} failed with ${status}${detail ? `: ${detail}` : ''}`)
    this.status = status
    this.detail = detail
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    const detail = typeof errorBody?.detail === 'string' ? errorBody.detail : null
    throw new ApiError(method, path, response.status, detail)
  }
  // 204 No Content (e.g. logout) has no body to parse.
  if (response.status === 204) {
    return undefined as T
  }
  return response.json() as Promise<T>
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>('GET', path)
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('POST', path, body)
}

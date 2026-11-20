import type {
  ChatResponse,
  HealthState,
  RequestOptions,
} from '@/types'
import { normalizeBaseUrl } from '@/lib/storage'

const DEFAULT_TIMEOUT_MS = 90_000

export class ApiError extends Error {
  code: string
  status?: number
  details?: unknown

  constructor(code: string, message: string, status?: number, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.details = details
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function resolveBaseUrl(override?: string): string {
  return normalizeBaseUrl(
    override ?? import.meta.env.VITE_API_BASE_URL ?? '/api',
  )
}

function authHeader(token?: string): string | null {
  const value = token?.trim()
  if (!value) return null
  if (/^(bearer|basic)\s+/i.test(value)) return value
  return `Bearer ${value}`
}

async function request<T>(
  path: string,
  init: RequestInit,
  options: RequestOptions,
): Promise<T> {
  const base = resolveBaseUrl(options.baseUrl)
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body) headers.set('Content-Type', 'application/json')

  const authorization = authHeader(options.token)
  if (authorization) headers.set('Authorization', authorization)

  const controller = new AbortController()
  let timedOut = false
  const timer = window.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  const onAbort = () => controller.abort()

  if (options.signal) {
    if (options.signal.aborted) controller.abort()
    else options.signal.addEventListener('abort', onAbort, { once: true })
  }

  try {
    const response = await fetch(`${base}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    })

    const raw = await response.text()
    let body: unknown = undefined
    if (raw) {
      try {
        body = JSON.parse(raw)
      } catch {
        body = raw
      }
    }

    if (!response.ok) {
      const record =
        body && typeof body === 'object'
          ? (body as Record<string, unknown>)
          : {}
      throw new ApiError(
        typeof record.code === 'string'
          ? record.code
          : `http_${response.status}`,
        typeof record.message === 'string'
          ? record.message
          : `Request failed with status ${response.status}.`,
        response.status,
        record.details ?? body,
      )
    }

    return body as T
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (timedOut) {
      throw new ApiError(
        'timeout',
        'The request timed out. The local model may still be warming up.',
        504,
      )
    }
    if (options.signal?.aborted) {
      throw new DOMException('The request was aborted.', 'AbortError')
    }
    if (isAbortError(error)) throw error
    throw new ApiError(
      'network_error',
      'Could not reach the Empirical API. Is it running on the configured URL?',
      0,
      error,
    )
  } finally {
    window.clearTimeout(timer)
    options.signal?.removeEventListener('abort', onAbort)
  }
}

export function sendChat(
  message: string,
  sessionId: string,
  options: RequestOptions = {},
): Promise<ChatResponse> {
  return request<ChatResponse>(
    '/chat',
    {
      method: 'POST',
      headers: { 'X-Session-Id': sessionId },
      body: JSON.stringify({ message }),
    },
    options,
  )
}

export function confirmAction(
  actionId: string,
  sessionId: string,
  options: RequestOptions = {},
): Promise<ChatResponse> {
  return request<ChatResponse>(
    `/confirm/${encodeURIComponent(actionId)}`,
    {
      method: 'POST',
      headers: { 'X-Session-Id': sessionId },
    },
    options,
  )
}

export async function fetchHealth(
  options: RequestOptions = {},
): Promise<HealthState> {
  const base = resolveBaseUrl(options.baseUrl)
  const headers = new Headers({ Accept: 'application/json' })
  const authorization = authHeader(options.token)
  if (authorization) headers.set('Authorization', authorization)

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 5_000)

  try {
    const response = await fetch(`${base}/health`, {
      headers,
      signal: controller.signal,
    })
    let body: Record<string, unknown> = {}
    try {
      body = (await response.json()) as Record<string, unknown>
    } catch {
      body = {}
    }

    const status = typeof body.status === 'string' ? body.status : 'unknown'
    const model = typeof body.model === 'string' ? body.model : undefined
    const llm = typeof body.llm === 'string' ? body.llm : undefined

    if (response.status !== 200 && response.status !== 503) {
      return { reachable: false, ok: false, status: 'unreachable' }
    }

    if (response.status === 503) {
      return {
        reachable: true,
        ok: false,
        status: status === 'unknown' || status === 'ok' ? 'degraded' : status,
        model,
        llm,
      }
    }

    return {
      reachable: true,
      ok: status === 'ok',
      status,
      model,
      llm,
    }
  } catch {
    return {
      reachable: false,
      ok: false,
      status: 'unreachable',
    }
  } finally {
    window.clearTimeout(timer)
  }
}

import { ApiError } from '@/api/client'
import type { ChatData, ChatResponse, InventoryItem } from '@/types'

export function responseToContent(response: ChatResponse): string {
  switch (response.status) {
    case 'ok':
      return response.result ?? 'Done.'
    case 'no_action':
      return response.reason ?? 'No matching tool was found for that message.'
    case 'needs_confirmation':
      return response.summary ?? 'This action needs confirmation.'
    case 'error':
      return response.message ?? 'The request failed.'
    default:
      return response.result ?? response.reason ?? response.message ?? 'Done.'
  }
}

export function errorToResponse(error: unknown): ChatResponse {
  if (error instanceof ApiError) {
    return {
      status: 'error',
      code: error.code,
      message: error.message,
      details: error.details,
    }
  }
  if (error instanceof Error) {
    return {
      status: 'error',
      code: 'unexpected_error',
      message: error.message,
    }
  }
  return {
    status: 'error',
    code: 'unexpected_error',
    message: 'Something went wrong.',
  }
}

export function getItems(data: unknown): InventoryItem[] | null {
  if (!data || typeof data !== 'object') return null
  const value = (data as ChatData).items
  if (!Array.isArray(value)) return null
  return value.filter(
    (item): item is InventoryItem =>
      Boolean(item) &&
      typeof item === 'object' &&
      typeof (item as InventoryItem).id === 'number' &&
      typeof (item as InventoryItem).name === 'string',
  )
}

export function errorCodeLabel(code: string | undefined): string {
  switch (code) {
    case 'llm_busy':
      return 'Model busy'
    case 'llm_timeout':
      return 'Model timed out'
    case 'llm_unavailable':
      return 'Model unavailable'
    case 'action_unavailable':
      return 'Action unavailable'
    case 'invalid_model_output':
      return 'Model output rejected'
    case 'invalid_request':
      return 'Invalid request'
    case 'network_error':
      return 'Connection failed'
    case 'timeout':
      return 'Request timed out'
    default:
      return code ? code.replace(/_/g, ' ') : 'Error'
  }
}

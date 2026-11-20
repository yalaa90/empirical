export interface Latency {
  queue: number
  llm: number
  validate: number
  api: number
  total: number
}

export type ResponseStatus =
  | 'ok'
  | 'no_action'
  | 'needs_confirmation'
  | 'error'
  | (string & {})

export interface InventoryItem {
  id: number
  name: string
  qty: number
}

export interface ChatData {
  items?: InventoryItem[]
  count?: number
  id?: number
  name?: string
  qty?: number
  deleted?: boolean
  [key: string]: unknown
}

export interface ChatResponse {
  status: ResponseStatus
  tool?: string
  result?: string
  data?: ChatData | unknown
  reason?: string
  action_id?: string
  summary?: string
  expires_in_s?: number
  latency_ms?: Latency
  code?: string
  message?: string
  details?: unknown
}

export type MessageRole = 'user' | 'assistant'

export type ConfirmationState = 'confirmed' | 'cancelled' | 'expired'

export interface Message {
  id: string
  role: MessageRole
  content: string
  createdAt: number
  response?: ChatResponse
  pending?: boolean
  error?: boolean
  confirmation?: ConfirmationState
  expiresAt?: number
}

export interface Conversation {
  id: string
  title: string
  sessionId: string
  messages: Message[]
  createdAt: number
  updatedAt: number
}

export interface AppSettings {
  apiBaseUrl: string
  sessionPrefix: string
}

export interface HealthState {
  reachable: boolean
  ok: boolean
  status: string
  model?: string
  llm?: string
}

export interface RequestOptions {
  baseUrl?: string
  token?: string
  signal?: AbortSignal
  timeoutMs?: number
}

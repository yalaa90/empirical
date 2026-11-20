import type { ChatResponse } from '@/types'

export const EMBED_PROMPT_EVENT = 'empirical:prompt'

export interface EmbedConfig {
  embedded: boolean
  hostOrigin: string | null
}

function parseHostOrigin(value: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.origin
  } catch {
    return null
  }
}

function readConfig(): EmbedConfig {
  if (typeof window === 'undefined') {
    return { embedded: false, hostOrigin: null }
  }
  const params = new URLSearchParams(window.location.search)
  const embedded = params.get('embed') === '1'
  return {
    embedded,
    hostOrigin: embedded
      ? parseHostOrigin(params.get('hostOrigin'))
      : null,
  }
}

export const embedConfig = readConfig()

export function isEmbedded(): boolean {
  return embedConfig.embedded
}

export function postToHost(type: string, payload?: unknown): void {
  if (
    !embedConfig.embedded ||
    !embedConfig.hostOrigin ||
    window.parent === window
  ) {
    return
  }
  window.parent.postMessage(
    { source: 'empirical-web', type, payload },
    embedConfig.hostOrigin,
  )
}

export function postChatResponse(response: ChatResponse): void {
  postToHost('response', response)
}

import { useEffect } from 'react'
import { fetchHealth } from '@/api/client'
import {
  EMBED_PROMPT_EVENT,
  embedConfig,
  postToHost,
} from '@/lib/embed'
import { getToken } from '@/lib/storage'
import { useChatStore } from '@/store/chatStore'

interface HostMessage {
  source?: string
  type?: string
  payload?: unknown
}

export function useEmbedBridge() {
  useEffect(() => {
    if (!embedConfig.embedded || !embedConfig.hostOrigin) return

    const hostOrigin = embedConfig.hostOrigin
    let active = true

    const sendHealth = async () => {
      const { settings } = useChatStore.getState()
      const health = await fetchHealth({
        baseUrl: settings.apiBaseUrl,
        token: getToken(),
      })
      if (active) postToHost('health', health)
    }

    postToHost('ready', { version: '1.0.0' })
    void sendHealth()

    const interval = window.setInterval(() => {
      void sendHealth()
    }, 30_000)

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== hostOrigin) return
      const message = event.data as HostMessage | null
      if (!message || message.source !== 'northline-store') return

      if (message.type === 'ping') {
        void sendHealth()
        return
      }

      if (message.type === 'prompt') {
        const payload = message.payload as { text?: unknown } | undefined
        const text = typeof payload?.text === 'string' ? payload.text.trim() : ''
        if (!text) return
        window.dispatchEvent(
          new CustomEvent<string>(EMBED_PROMPT_EVENT, { detail: text }),
        )
      }
    }

    window.addEventListener('message', onMessage)

    return () => {
      active = false
      window.clearInterval(interval)
      window.removeEventListener('message', onMessage)
    }
  }, [])
}

import { useEffect, useRef } from 'react'
import type { Message } from '@/types'

export function useAutoScroll(messages: Message[]) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const stickToBottom = useRef(true)

  const isEmpty = messages.length === 0
  const last = messages[messages.length - 1]
  const signature = last
    ? `${last.id}:${last.pending ? 'pending' : 'done'}:${last.content.length}`
    : 'empty'
  const lastRole = last?.role
  const lastPending = last?.pending

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const onScroll = () => {
      const distance =
        container.scrollHeight - container.scrollTop - container.clientHeight
      stickToBottom.current = distance < 120
    }

    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const force = isEmpty || lastRole === 'user' || Boolean(lastPending)
    if (force || stickToBottom.current) {
      bottomRef.current?.scrollIntoView({ block: 'end' })
    }
  }, [signature, isEmpty, lastRole, lastPending])

  return { containerRef, bottomRef }
}

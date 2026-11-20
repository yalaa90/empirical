import { MessageBubble } from '@/components/chat/MessageBubble'
import { useAutoScroll } from '@/hooks/useAutoScroll'
import type { Conversation } from '@/types'

interface MessageListProps {
  conversation: Conversation
  onConfirm: (messageId: string) => void
  onCancel: (messageId: string) => void
  onRetry: (messageId: string) => void
}

export function MessageList({
  conversation,
  onConfirm,
  onCancel,
  onRetry,
}: MessageListProps) {
  const { containerRef, bottomRef } = useAutoScroll(conversation.messages)

  return (
    <div ref={containerRef} className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-4 py-6 md:px-6 md:py-8">
        {conversation.messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onConfirm={() => onConfirm(message.id)}
            onCancel={() => onCancel(message.id)}
            onRetry={() => onRetry(message.id)}
          />
        ))}
        <div ref={bottomRef} className="h-1" />
      </div>
    </div>
  )
}

import { useLayoutEffect } from 'react'
import { ChatComposer } from '@/components/chat/ChatComposer'
import { EmptyState } from '@/components/chat/EmptyState'
import { MessageList } from '@/components/chat/MessageList'
import { useChat } from '@/hooks/useChat'
import { useChatStore } from '@/store/chatStore'

export function ChatPage() {
  const conversations = useChatStore((state) => state.conversations)
  const activeId = useChatStore((state) => state.activeId)
  const ensureConversation = useChatStore((state) => state.ensureConversation)
  const { send, confirm, cancelConfirmation, retry, stop, isSending } = useChat()

  useLayoutEffect(() => {
    ensureConversation()
  }, [ensureConversation])

  const conversation =
    conversations.find((item) => item.id === activeId) ?? null

  if (!conversation) {
    return <div className="min-h-0 flex-1 bg-background" />
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {conversation.messages.length === 0 ? (
        <EmptyState onPrompt={send} />
      ) : (
        <MessageList
          conversation={conversation}
          onConfirm={(messageId) => void confirm(conversation.id, messageId)}
          onCancel={(messageId) =>
            cancelConfirmation(conversation.id, messageId)
          }
          onRetry={(messageId) => retry(conversation.id, messageId)}
        />
      )}

      <ChatComposer onSend={send} onStop={stop} isSending={isSending} />
    </div>
  )
}

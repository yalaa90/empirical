import { useCallback, useRef, useState } from 'react'
import { confirmAction, isAbortError, sendChat } from '@/api/client'
import { postChatResponse } from '@/lib/embed'
import { errorToResponse, responseToContent } from '@/lib/response'
import { getToken } from '@/lib/storage'
import { newId } from '@/lib/utils'
import { useChatStore } from '@/store/chatStore'
import type { ChatResponse, Message } from '@/types'

function userMessage(content: string): Message {
  return {
    id: newId('msg'),
    role: 'user',
    content,
    createdAt: Date.now(),
  }
}

function pendingAssistantMessage(): Message {
  return {
    id: newId('msg'),
    role: 'assistant',
    content: '',
    createdAt: Date.now(),
    pending: true,
  }
}

export function useChat() {
  const [isSending, setIsSending] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const sendingRef = useRef(false)

  const runRequest = useCallback(
    async (
      conversationId: string,
      sessionId: string,
      message: string,
      assistantId: string,
    ) => {
      const controller = new AbortController()
      abortRef.current = controller
      sendingRef.current = true
      setIsSending(true)

      const { settings } = useChatStore.getState()
      const token = getToken()

      try {
        const response = await sendChat(message, sessionId, {
          baseUrl: settings.apiBaseUrl,
          token,
          signal: controller.signal,
        })
        applyResponse(conversationId, assistantId, response)
        postChatResponse(response)
      } catch (error) {
        if (isAbortError(error)) {
          const response: ChatResponse = {
            status: 'error',
            code: 'aborted',
            message: 'You stopped this response.',
          }
          useChatStore.getState().updateMessage(conversationId, assistantId, {
            pending: false,
            error: true,
            content: 'Stopped.',
            response,
          })
          postChatResponse(response)
        } else {
          const response = errorToResponse(error)
          useChatStore.getState().updateMessage(conversationId, assistantId, {
            pending: false,
            error: true,
            content: responseToContent(response),
            response,
          })
          postChatResponse(response)
        }
      } finally {
        abortRef.current = null
        sendingRef.current = false
        setIsSending(false)
      }
    },
    [],
  )

  const send = useCallback(
    (raw: string) => {
      const text = raw.trim()
      if (!text || sendingRef.current) return

      const conversationId = useChatStore.getState().ensureConversation()
      const conversation = useChatStore
        .getState()
        .conversations.find((item) => item.id === conversationId)
      if (!conversation) return

      useChatStore.getState().appendMessage(conversationId, userMessage(text))
      const assistant = pendingAssistantMessage()
      useChatStore.getState().appendMessage(conversationId, assistant)

      void runRequest(conversationId, conversation.sessionId, text, assistant.id)
    },
    [runRequest],
  )

  const confirm = useCallback(
    async (conversationId: string, messageId: string) => {
      const conversation = useChatStore
        .getState()
        .conversations.find((item) => item.id === conversationId)
      const target = conversation?.messages.find(
        (message) => message.id === messageId,
      )
      const actionId = target?.response?.action_id
      if (!conversation || !actionId) return

      const { updateMessage } = useChatStore.getState()
      updateMessage(conversationId, messageId, { pending: true })

      const { settings } = useChatStore.getState()

      try {
        const response = await confirmAction(actionId, conversation.sessionId, {
          baseUrl: settings.apiBaseUrl,
          token: getToken(),
        })
        updateMessage(conversationId, messageId, {
          pending: false,
          error: false,
          confirmation: 'confirmed',
          content: responseToContent(response),
          response,
        })
        postChatResponse(response)
      } catch (error) {
        const response = errorToResponse(error)
        const expired =
          response.code === 'action_unavailable' ||
          response.code === 'http_404'
        updateMessage(conversationId, messageId, {
          pending: false,
          error: true,
          confirmation: expired ? 'expired' : undefined,
          content: expired
            ? 'This action is no longer available. Ask again to create a new confirmation.'
            : responseToContent(response),
          response,
        })
        postChatResponse(response)
      }
    },
    [],
  )

  const cancelConfirmation = useCallback(
    (conversationId: string, messageId: string) => {
      useChatStore.getState().updateMessage(conversationId, messageId, {
        confirmation: 'cancelled',
        pending: false,
        content: 'Cancelled.',
      })
    },
    [],
  )

  const retry = useCallback(
    (conversationId: string, messageId: string) => {
      if (sendingRef.current) return
      const conversation = useChatStore
        .getState()
        .conversations.find((item) => item.id === conversationId)
      if (!conversation) return

      const index = conversation.messages.findIndex(
        (message) => message.id === messageId,
      )
      if (index < 0) return

      let user: Message | undefined
      for (let i = index - 1; i >= 0; i -= 1) {
        if (conversation.messages[i].role === 'user') {
          user = conversation.messages[i]
          break
        }
      }
      if (!user) return

      useChatStore.getState().updateMessage(conversationId, messageId, {
        pending: true,
        error: false,
        content: '',
        response: undefined,
        confirmation: undefined,
        expiresAt: undefined,
      })
      void runRequest(
        conversationId,
        conversation.sessionId,
        user.content,
        messageId,
      )
    },
    [runRequest],
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return { send, confirm, cancelConfirmation, retry, stop, isSending }
}

function applyResponse(
  conversationId: string,
  messageId: string,
  response: ChatResponse,
) {
  const expiresAt =
    response.status === 'needs_confirmation' && response.expires_in_s
      ? Date.now() + response.expires_in_s * 1000
      : undefined

  useChatStore.getState().updateMessage(conversationId, messageId, {
    pending: false,
    error: response.status === 'error',
    content: responseToContent(response),
    response,
    expiresAt,
  })
}

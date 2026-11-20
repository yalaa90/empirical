import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppSettings, Conversation, Message } from '@/types'
import { newId, truncate } from '@/lib/utils'

const DEFAULT_SETTINGS: AppSettings = {
  apiBaseUrl: '/api',
  sessionPrefix: 'web',
}

const DEFAULT_TITLE = 'New chat'
const MAX_CONVERSATIONS = 100

export type Theme = 'light' | 'dark'

interface ChatState {
  conversations: Conversation[]
  activeId: string | null
  theme: Theme
  settings: AppSettings

  createConversation: (title?: string) => string
  ensureConversation: () => string
  selectConversation: (id: string) => void
  deleteConversation: (id: string) => void
  renameConversation: (id: string, title: string) => void
  clearConversations: () => void

  appendMessage: (conversationId: string, message: Message) => void
  updateMessage: (
    conversationId: string,
    messageId: string,
    patch: Partial<Message>,
  ) => void
  removeMessage: (conversationId: string, messageId: string) => void

  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  setSettings: (settings: Partial<AppSettings>) => void
}

function makeConversation(prefix: string, title = DEFAULT_TITLE): Conversation {
  const now = Date.now()
  return {
    id: newId('conv'),
    title,
    sessionId: newId(prefix || 'web'),
    messages: [],
    createdAt: now,
    updatedAt: now,
  }
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeId: null,
      theme: 'dark',
      settings: DEFAULT_SETTINGS,

      createConversation: (title) => {
        const conversation = makeConversation(
          get().settings.sessionPrefix,
          title,
        )
        set((state) => ({
          conversations: [conversation, ...state.conversations].slice(
            0,
            MAX_CONVERSATIONS,
          ),
          activeId: conversation.id,
        }))
        return conversation.id
      },

      ensureConversation: () => {
        const { activeId, conversations, selectConversation, createConversation } =
          get()
        if (activeId && conversations.some((c) => c.id === activeId)) {
          return activeId
        }
        if (conversations.length > 0) {
          selectConversation(conversations[0].id)
          return conversations[0].id
        }
        return createConversation()
      },

      selectConversation: (id) => {
        if (get().conversations.some((c) => c.id === id)) {
          set({ activeId: id })
        }
      },

      deleteConversation: (id) => {
        set((state) => {
          const conversations = state.conversations.filter((c) => c.id !== id)
          let activeId = state.activeId
          if (activeId === id) {
            activeId = conversations[0]?.id ?? null
          }
          return { conversations, activeId }
        })
      },

      renameConversation: (id, title) => {
        const clean = title.trim()
        if (!clean) return
        set((state) => ({
          conversations: state.conversations.map((conversation) =>
            conversation.id === id
              ? { ...conversation, title: truncate(clean, 80) }
              : conversation,
          ),
        }))
      },

      clearConversations: () => {
        set({ conversations: [], activeId: null })
      },

      appendMessage: (conversationId, message) => {
        set((state) => ({
          conversations: state.conversations.map((conversation) => {
            if (conversation.id !== conversationId) return conversation
            const shouldTitle =
              message.role === 'user' &&
              (conversation.title === DEFAULT_TITLE || !conversation.title)
            return {
              ...conversation,
              title: shouldTitle
                ? truncate(message.content, 48)
                : conversation.title,
              messages: [...conversation.messages, message],
              updatedAt: Date.now(),
            }
          }),
        }))
      },

      updateMessage: (conversationId, messageId, patch) => {
        set((state) => ({
          conversations: state.conversations.map((conversation) => {
            if (conversation.id !== conversationId) return conversation
            return {
              ...conversation,
              messages: conversation.messages.map((message) =>
                message.id === messageId ? { ...message, ...patch } : message,
              ),
              updatedAt: Date.now(),
            }
          }),
        }))
      },

      removeMessage: (conversationId, messageId) => {
        set((state) => ({
          conversations: state.conversations.map((conversation) =>
            conversation.id === conversationId
              ? {
                  ...conversation,
                  messages: conversation.messages.filter(
                    (message) => message.id !== messageId,
                  ),
                  updatedAt: Date.now(),
                }
              : conversation,
          ),
        }))
      },

      setTheme: (theme) => set({ theme }),

      toggleTheme: () =>
        set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),

      setSettings: (settings) =>
        set((state) => ({
          settings: {
            ...state.settings,
            ...settings,
            apiBaseUrl: (settings.apiBaseUrl ?? state.settings.apiBaseUrl).trim(),
            sessionPrefix: (
              settings.sessionPrefix ?? state.settings.sessionPrefix
            ).trim(),
          },
        })),
    }),
    {
      name: 'empirical.chat.v1',
      version: 1,
      partialize: (state) => ({
        conversations: state.conversations,
        activeId: state.activeId,
        theme: state.theme,
        settings: state.settings,
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<ChatState>
        return {
          ...current,
          ...saved,
          settings: {
            ...DEFAULT_SETTINGS,
            ...(saved.settings ?? {}),
          },
        }
      },
    },
  ),
)

export function activeConversation(
  conversations: Conversation[],
  activeId: string | null,
): Conversation | null {
  if (!activeId) return null
  return conversations.find((conversation) => conversation.id === activeId) ?? null
}

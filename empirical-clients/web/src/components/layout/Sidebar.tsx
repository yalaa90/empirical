import { useMemo, useState } from 'react'
import {
  Check,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Settings,
  Sparkles,
  SunMoon,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn, formatRelative, truncate } from '@/lib/utils'
import { useChatStore } from '@/store/chatStore'

interface SidebarProps {
  onNavigate?: () => void
  onOpenSettings: () => void
}

export function Sidebar({ onNavigate, onOpenSettings }: SidebarProps) {
  const conversations = useChatStore((state) => state.conversations)
  const activeId = useChatStore((state) => state.activeId)
  const theme = useChatStore((state) => state.theme)
  const createConversation = useChatStore((state) => state.createConversation)
  const selectConversation = useChatStore((state) => state.selectConversation)
  const renameConversation = useChatStore((state) => state.renameConversation)
  const deleteConversation = useChatStore((state) => state.deleteConversation)
  const toggleTheme = useChatStore((state) => state.toggleTheme)

  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const sorted = useMemo(
    () =>
      [...conversations].sort((a, b) => b.updatedAt - a.updatedAt),
    [conversations],
  )

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return sorted
    return sorted.filter((conversation) =>
      conversation.title.toLowerCase().includes(needle),
    )
  }, [query, sorted])

  const startRename = (id: string, title: string) => {
    setEditingId(id)
    setDraft(title)
  }

  const commitRename = () => {
    if (editingId) renameConversation(editingId, draft)
    setEditingId(null)
  }

  const handleNewChat = () => {
    createConversation()
    onNavigate?.()
  }

  return (
    <aside className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 px-4 pb-3 pt-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-lg shadow-emerald-500/20">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">Empirical Chat</p>
          <p className="truncate text-[11px] text-muted-foreground">
            Chat-to-API orchestrator
          </p>
        </div>
        <button
          type="button"
          onClick={onNavigate}
          className="ml-auto rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground md:hidden"
          aria-label="Close sidebar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-3 pb-2">
        <Button
          onClick={handleNewChat}
          variant="outline"
          className="w-full justify-start gap-2 border-sidebar-border bg-transparent hover:bg-sidebar-accent"
        >
          <Plus className="h-4 w-4" />
          New chat
        </Button>
      </div>

      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chats"
            aria-label="Search chats"
            className="h-8 w-full rounded-lg border border-transparent bg-sidebar-accent/60 pl-8 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-border focus:bg-background focus:outline-none"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        <p className="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
          History
        </p>

        {filtered.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            {conversations.length === 0
              ? 'No conversations yet.'
              : 'No chats match your search.'}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {filtered.map((conversation) => {
              const isActive = conversation.id === activeId
              const isEditing = conversation.id === editingId
              return (
                <li key={conversation.id}>
                  <div
                    className={cn(
                      'group flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-sidebar-accent text-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent/70',
                    )}
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />

                    {isEditing ? (
                      <div className="flex min-w-0 flex-1 items-center gap-1">
                        <input
                          autoFocus
                          value={draft}
                          onChange={(event) => setDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') commitRename()
                            if (event.key === 'Escape') setEditingId(null)
                          }}
                          className="min-w-0 flex-1 rounded border border-border bg-background px-1.5 py-0.5 text-xs text-foreground focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={commitRename}
                          className="rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                          aria-label="Save name"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          selectConversation(conversation.id)
                          onNavigate?.()
                        }}
                        onDoubleClick={() =>
                          startRename(conversation.id, conversation.title)
                        }
                        className="min-w-0 flex-1 text-left"
                        title={conversation.title}
                      >
                        <span className="block truncate text-[13px]">
                          {truncate(conversation.title, 34)}
                        </span>
                        <span className="block text-[10px] text-muted-foreground">
                          {formatRelative(conversation.updatedAt)}
                        </span>
                      </button>
                    )}

                    {!isEditing && (
                      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <button
                          type="button"
                          onClick={() =>
                            startRename(conversation.id, conversation.title)
                          }
                          className="rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                          aria-label="Rename chat"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Delete "${conversation.title}"? This only clears local history.`,
                              )
                            ) {
                              deleteConversation(conversation.id)
                            }
                          }}
                          className="rounded p-1 text-muted-foreground hover:bg-background hover:text-destructive"
                          aria-label="Delete chat"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-1 border-t border-sidebar-border p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          className="flex-1 justify-start gap-2 text-muted-foreground hover:text-foreground"
        >
          <SunMoon className="h-4 w-4" />
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onOpenSettings}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </aside>
  )
}

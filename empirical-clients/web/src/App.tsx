import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { ChatPage } from '@/components/chat/ChatPage'
import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { SettingsDialog } from '@/components/settings/SettingsDialog'
import { useEmbedBridge } from '@/hooks/useEmbedBridge'
import { embedConfig } from '@/lib/embed'
import { useChatStore } from '@/store/chatStore'

export default function App() {
  const theme = useChatStore((state) => state.theme)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEmbedBridge()

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.style.colorScheme = theme
  }, [theme])

  if (embedConfig.embedded) {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden bg-background text-foreground">
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-background px-4">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold">
              Northline shopping assistant
            </p>
            <p className="truncate text-[10px] text-muted-foreground">
              Ask about products, cart, or checkout
            </p>
          </div>
        </div>
        <ChatPage />
      </div>
    )
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-background text-foreground">
      <div className="hidden w-72 shrink-0 border-r border-sidebar-border md:block">
        <Sidebar onOpenSettings={() => setSettingsOpen(true)} />
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative z-10 h-full w-72 max-w-[85vw] border-r border-sidebar-border shadow-2xl">
            <Sidebar
              onNavigate={() => setSidebarOpen(false)}
              onOpenSettings={() => {
                setSidebarOpen(false)
                setSettingsOpen(true)
              }}
            />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />
        <ChatPage />
      </div>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  )
}

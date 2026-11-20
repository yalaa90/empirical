import { Loader2, Menu, Moon, Sun, Wifi, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useHealth } from '@/hooks/useHealth'
import { cn } from '@/lib/utils'
import { useChatStore } from '@/store/chatStore'
import type { HealthState } from '@/types'

interface HeaderProps {
  onOpenSidebar: () => void
}

export function Header({ onOpenSidebar }: HeaderProps) {
  const conversations = useChatStore((state) => state.conversations)
  const activeId = useChatStore((state) => state.activeId)
  const theme = useChatStore((state) => state.theme)
  const toggleTheme = useChatStore((state) => state.toggleTheme)
  const { health, refresh } = useHealth()

  const conversation =
    conversations.find((item) => item.id === activeId) ?? null

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur md:px-5">
      <Button
        variant="ghost"
        size="icon-sm"
        className="md:hidden"
        onClick={onOpenSidebar}
        aria-label="Open sidebar"
      >
        <Menu className="h-4 w-4" />
      </Button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-medium">
          {conversation?.title ?? 'Empirical Chat'}
        </h1>
        <p className="truncate text-[11px] text-muted-foreground">
          {conversation ? `session ${conversation.sessionId}` : 'Chat-to-API'}
        </p>
      </div>

      <HealthBadge health={health} onRefresh={refresh} />

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={toggleTheme}
        aria-label="Toggle theme"
        className="text-muted-foreground hover:text-foreground"
      >
        {theme === 'dark' ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )}
      </Button>
    </header>
  )
}

function HealthBadge({
  health,
  onRefresh,
}: {
  health: HealthState
  onRefresh: () => void
}) {
  const checking = health.status === 'checking'
  const label = health.ok
    ? 'API online'
    : health.reachable
      ? 'LLM degraded'
      : 'API offline'

  return (
    <button
      type="button"
      onClick={() => void onRefresh()}
      title={
        checking
          ? 'Checking API health…'
          : health.model
            ? `${label} · ${health.model}`
            : `${label} — click to refresh`
      }
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-colors',
        health.ok &&
          'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
        !health.ok &&
          health.reachable &&
          'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
        !health.reachable &&
          !checking &&
          'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',
        checking && 'border-border bg-muted text-muted-foreground',
      )}
    >
      {checking ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : health.ok ? (
        <Wifi className="h-3 w-3" />
      ) : (
        <WifiOff className="h-3 w-3" />
      )}
      <span className="hidden sm:inline">{checking ? 'Checking…' : label}</span>
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full sm:hidden',
          health.ok
            ? 'bg-emerald-500'
            : health.reachable
              ? 'bg-amber-500'
              : 'bg-red-500',
        )}
      />
    </button>
  )
}

import { useEffect, useState, type RefObject } from 'react'
import { ExternalLink, Loader2, MessageCircle, Wifi, WifiOff, X } from 'lucide-react'
import { empiricalEmbedUrl, empiricalNewTabUrl } from '@/lib/empirical'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/store/uiStore'

interface ChatPanelProps {
  iframeRef: RefObject<HTMLIFrameElement | null>
  onIframeLoad: () => void
}

export function ChatPanel({ iframeRef, onIframeLoad }: ChatPanelProps) {
  const open = useUiStore((state) => state.chatOpen)
  const closeChat = useUiStore((state) => state.closeChat)
  const ready = useUiStore((state) => state.chatReady)
  const healthy = useUiStore((state) => state.chatHealthy)
  const [mounted, setMounted] = useState(open)

  useEffect(() => {
    if (open) setMounted(true)
  }, [open])

  if (!mounted) return null

  return (
    <section
      aria-label="Empirical shopping assistant"
      aria-hidden={!open}
      className={cn(
        'fixed inset-x-3 bottom-24 z-50 flex h-[min(640px,calc(100dvh-8rem))] flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-panel sm:inset-x-auto sm:right-5 sm:w-[420px]',
        open ? 'animate-slide-up' : 'hidden',
      )}
    >
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-stone-200 bg-stone-50 px-4">
        <span className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-stone-900 text-amber-300">
          <MessageCircle className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-stone-950">
            Empirical assistant
          </p>
          <p className="flex items-center gap-1.5 text-[11px] text-stone-500">
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                !ready
                  ? 'animate-pulse bg-stone-300'
                  : healthy
                    ? 'bg-emerald-500'
                    : 'bg-amber-500',
              )}
            />
            {!ready
              ? 'Connecting…'
              : healthy
                ? 'Ready to shop'
                : 'Model degraded'}
          </p>
        </div>

        <a
          href={empiricalNewTabUrl()}
          target="_blank"
          rel="noreferrer"
          className="rounded-full p-2 text-stone-400 transition-colors hover:bg-stone-200 hover:text-stone-800"
          aria-label="Open chat in a new tab"
          title="Open chat in a new tab"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
        <button
          type="button"
          onClick={closeChat}
          className="rounded-full p-2 text-stone-400 transition-colors hover:bg-stone-200 hover:text-stone-900"
          aria-label="Close chat"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {!ready && (
        <div className="flex items-center gap-2 border-b border-stone-200 bg-white px-4 py-2.5 text-[11px] text-stone-500">
          {healthy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <WifiOff className="h-3.5 w-3.5" />
          )}
          Waiting for the chat client at the configured Empirical web URL.
          <a
            href={empiricalNewTabUrl()}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1 font-semibold text-stone-800 hover:underline"
          >
            Open
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {ready && (
        <div className="flex items-center gap-1.5 border-b border-stone-100 bg-white px-4 py-1.5 text-[10px] font-medium uppercase tracking-wider text-stone-400">
          {healthy ? (
            <>
              <Wifi className="h-3 w-3 text-emerald-500" />
              Connected
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3 text-amber-500" />
              Assistant may be slow
            </>
          )}
          <span className="ml-auto normal-case tracking-normal">
            Try “find red t-shirts”
          </span>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={empiricalEmbedUrl()}
        onLoad={onIframeLoad}
        title="Empirical shopping assistant"
        className="min-h-0 w-full flex-1 border-0 bg-white"
        allow="clipboard-write"
      />
    </section>
  )
}

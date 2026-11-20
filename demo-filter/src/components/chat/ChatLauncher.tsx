import { useEffect } from 'react'
import { Sparkles, X } from 'lucide-react'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { useEmpiricalBridge } from '@/hooks/useEmpiricalBridge'
import { CHAT_PROMPT_EVENT } from '@/lib/chatPrompt'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/store/uiStore'

export function ChatLauncher() {
  const open = useUiStore((state) => state.chatOpen)
  const openChat = useUiStore((state) => state.openChat)
  const closeChat = useUiStore((state) => state.closeChat)
  const ready = useUiStore((state) => state.chatReady)
  const healthy = useUiStore((state) => state.chatHealthy)
  const { iframeRef, promptChat, onIframeLoad } = useEmpiricalBridge()

  useEffect(() => {
    const onPrompt = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail
      if (typeof detail === 'string' && detail.trim()) promptChat(detail)
    }
    window.addEventListener(CHAT_PROMPT_EVENT, onPrompt)
    return () => window.removeEventListener(CHAT_PROMPT_EVENT, onPrompt)
  }, [promptChat])

  return (
    <>
      <ChatPanel iframeRef={iframeRef} onIframeLoad={onIframeLoad} />

      <button
        type="button"
        onClick={open ? closeChat : openChat}
        className={cn(
          'fixed bottom-5 right-4 z-40 inline-flex h-14 items-center gap-2.5 rounded-full bg-stone-950 px-5 text-sm font-bold text-white shadow-panel transition-all hover:bg-stone-800 sm:right-5',
          open && 'bg-stone-800',
        )}
        aria-label={open ? 'Close Empirical assistant' : 'Open Empirical assistant'}
        aria-expanded={open}
      >
        {!open && (
          <span className="absolute inset-0 -z-10 animate-pulse-ring rounded-full bg-amber-300/50" />
        )}
        <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-amber-300 text-stone-950">
          {open ? (
            <X className="h-4 w-4" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
        </span>
        <span>{open ? 'Close chat' : 'Ask Empirical'}</span>
        {!open && (
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              ready && healthy
                ? 'bg-emerald-400'
                : ready
                  ? 'bg-amber-400'
                  : 'bg-stone-500',
            )}
          />
        )}
      </button>
    </>
  )
}

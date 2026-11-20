import { useEffect } from 'react'
import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/store/uiStore'

const ICONS = {
  success: CheckCircle2,
  info: Info,
  error: XCircle,
}

const TONES = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  info: 'border-stone-200 bg-white text-stone-950',
  error: 'border-red-200 bg-red-50 text-red-950',
}

const ICON_TONES = {
  success: 'text-emerald-600',
  info: 'text-stone-500',
  error: 'text-red-600',
}

export function ToastViewport() {
  const toast = useUiStore((state) => state.toast)
  const clearToast = useUiStore((state) => state.clearToast)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(clearToast, 4500)
    return () => window.clearTimeout(timer)
  }, [toast, clearToast])

  if (!toast) return null

  const Icon = ICONS[toast.tone]

  return (
    <div className="fixed bottom-5 left-4 z-[80] w-[min(24rem,calc(100vw-2rem))] animate-toast-in sm:left-6">
      <div
        role="status"
        aria-live="polite"
        className={cn(
          'flex items-start gap-3 rounded-2xl border p-4 shadow-soft',
          TONES[toast.tone],
        )}
      >
        <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', ICON_TONES[toast.tone])} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{toast.title}</p>
          {toast.message && (
            <p className="mt-0.5 text-xs leading-5 opacity-75">{toast.message}</p>
          )}
        </div>
        <button
          type="button"
          onClick={clearToast}
          className="rounded-full p-1 opacity-50 transition-opacity hover:opacity-100"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

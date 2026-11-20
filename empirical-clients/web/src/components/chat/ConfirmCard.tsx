import { useEffect, useState } from 'react'
import { Loader2, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface ConfirmCardProps {
  summary: string
  createdAt: number
  expiresIn: number
  expiresAt?: number
  busy: boolean
  onConfirm: () => void
  onCancel: () => void
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function ConfirmCard({
  summary,
  createdAt,
  expiresIn,
  expiresAt,
  busy,
  onConfirm,
  onCancel,
}: ConfirmCardProps) {
  const [now, setNow] = useState(() => Date.now())
  const deadline = expiresAt ?? createdAt + expiresIn * 1000
  const remaining = deadline - now
  const expired = remaining <= 0

  useEffect(() => {
    if (expired) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [expired])

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
      <div className="flex items-start gap-2.5">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            Confirmation required
          </p>
          <p className="mt-1 text-[0.9375rem] font-medium">{summary}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {expired
              ? 'This confirmation has expired. Ask again to create a new one.'
              : `Expires in ${formatCountdown(remaining)} · bound to this session`}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={onConfirm}
              disabled={busy || expired}
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Confirm
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onCancel}
              disabled={busy}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { AlertCircle, Check, Copy, RotateCcw, Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '@/components/ui/Button'
import { ConfirmCard } from '@/components/chat/ConfirmCard'
import { ResultCard } from '@/components/chat/ResultCard'
import { TypingIndicator } from '@/components/chat/TypingIndicator'
import { errorCodeLabel } from '@/lib/response'
import { cn, formatClock, formatLatency } from '@/lib/utils'
import type { Message } from '@/types'

interface MessageBubbleProps {
  message: Message
  onConfirm: () => void
  onCancel: () => void
  onRetry: () => void
}

export function MessageBubble({
  message,
  onConfirm,
  onCancel,
  onRetry,
}: MessageBubbleProps) {
  if (message.role === 'user') {
    return (
      <div className="flex animate-fade-in justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[0.9375rem] leading-6 text-primary-foreground shadow-sm">
          {message.content}
        </div>
      </div>
    )
  }

  const response = message.response
  const needsConfirmation =
    response?.status === 'needs_confirmation' && !message.confirmation
  const confirmed = message.confirmation === 'confirmed'
  const error = Boolean(message.error)

  return (
    <div className="flex animate-fade-in gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-sm">
        <Sparkles className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1 space-y-2.5">
        {message.pending && !needsConfirmation && <TypingIndicator />}

        {needsConfirmation && (
          <ConfirmCard
            summary={response?.summary ?? 'This action needs confirmation.'}
            createdAt={message.createdAt}
            expiresIn={response?.expires_in_s ?? 120}
            expiresAt={message.expiresAt}
            busy={Boolean(message.pending)}
            onConfirm={onConfirm}
            onCancel={onCancel}
          />
        )}

        {!needsConfirmation && !message.pending && error && (
          <ErrorNotice
            code={response?.code}
            message={message.content}
            onRetry={onRetry}
          />
        )}

        {!needsConfirmation && !message.pending && !error && (
          <div className="markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {confirmed && response?.status === 'ok' && (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <Check className="h-3 w-3" />
            Confirmed
          </span>
        )}

        {!message.pending && response?.status === 'ok' && (
          <ResultCard data={response.data} />
        )}

        {!message.pending &&
          response &&
          (response.status === 'ok' || response.status === 'no_action') && (
            <ResponseFooter tool={response.tool} response={response} />
          )}

        {!message.pending && !needsConfirmation && message.content && (
          <MessageActions message={message} />
        )}
      </div>
    </div>
  )
}

function ResponseFooter({
  tool,
  response,
}: {
  tool?: string
  response: NonNullable<Message['response']>
}) {
  const latency = response.latency_ms
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
      {tool && (
        <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px]">
          {tool}
        </span>
      )}
      {response.status === 'no_action' && <span>no action taken</span>}
      {latency && (
        <span
          title={`queue ${latency.queue}ms · llm ${latency.llm}ms · validate ${latency.validate}ms · api ${latency.api}ms`}
        >
          {formatLatency(latency.total)}
        </span>
      )}
    </div>
  )
}

function ErrorNotice({
  code,
  message,
  onRetry,
}: {
  code?: string
  message: string
  onRetry: () => void
}) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
      <div className="flex items-start gap-2.5">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-destructive">
            {errorCodeLabel(code)}
          </p>
          <p className="mt-1 break-words text-sm text-foreground/90">{message}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="mt-2 h-7 gap-1.5 text-xs"
          >
            <RotateCcw className="h-3 w-3" />
            Retry
          </Button>
        </div>
      </div>
    </div>
  )
}

function MessageActions({ message }: { message: Message }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="flex items-center gap-3 pt-0.5 text-[11px] text-muted-foreground">
      <button
        type="button"
        onClick={() => void copy()}
        className={cn(
          'inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:bg-accent hover:text-foreground',
          copied && 'text-emerald-500',
        )}
      >
        {copied ? (
          <Check className="h-3 w-3" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
        {copied ? 'Copied' : 'Copy'}
      </button>
      <span>{formatClock(message.createdAt)}</span>
    </div>
  )
}

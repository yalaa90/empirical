import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Square } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EMBED_PROMPT_EVENT } from '@/lib/embed'
import { cn } from '@/lib/utils'

const MAX_CHARS = 500

interface ChatComposerProps {
  onSend: (message: string) => void
  onStop: () => void
  isSending: boolean
}

export function ChatComposer({ onSend, onStop, isSending }: ChatComposerProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const element = textareaRef.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, 200)}px`
  }, [value])

  useEffect(() => {
    const onHostPrompt = (event: Event) => {
      const prompt = (event as CustomEvent<string>).detail
      if (typeof prompt !== 'string') return
      const text = prompt.trim().slice(0, MAX_CHARS)
      if (!text) return

      if (isSending) {
        setValue(text)
        window.requestAnimationFrame(() => textareaRef.current?.focus())
        return
      }

      onSend(text)
      setValue('')
      window.requestAnimationFrame(() => textareaRef.current?.focus())
    }

    window.addEventListener(EMBED_PROMPT_EVENT, onHostPrompt)
    return () => window.removeEventListener(EMBED_PROMPT_EVENT, onHostPrompt)
  }, [isSending, onSend])

  const canSend = value.trim().length > 0 && value.length <= MAX_CHARS

  const submit = () => {
    if (!canSend || isSending) return
    onSend(value)
    setValue('')
    window.requestAnimationFrame(() => textareaRef.current?.focus())
  }

  return (
    <div className="shrink-0 border-t border-border bg-background/85 px-3 py-3 backdrop-blur md:px-6">
      <div className="mx-auto w-full max-w-3xl">
        <div
          className={cn(
            'flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm transition-colors focus-within:border-ring/60',
          )}
        >
          <textarea
            ref={textareaRef}
            value={value}
            rows={1}
            maxLength={MAX_CHARS}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault()
                submit()
              }
            }}
            placeholder="Message Empirical…"
            aria-label="Message"
            className="max-h-[200px] min-h-[38px] flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground"
          />

          {isSending ? (
            <Button
              size="icon"
              variant="secondary"
              onClick={onStop}
              aria-label="Stop response"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </Button>
          ) : (
            <Button
              size="icon"
              onClick={submit}
              disabled={!canSend}
              aria-label="Send message"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="mt-1.5 flex items-center justify-between px-1 text-[11px] text-muted-foreground">
          <span className="hidden sm:inline">
            Enter to send · Shift+Enter for a new line
          </span>
          <span className="sm:hidden">Empirical turns messages into API calls.</span>
          <span
            className={cn(
              'tabular-nums',
              value.length > MAX_CHARS - 50 && 'text-amber-500',
            )}
          >
            {value.length}/{MAX_CHARS}
          </span>
        </div>
      </div>
    </div>
  )
}

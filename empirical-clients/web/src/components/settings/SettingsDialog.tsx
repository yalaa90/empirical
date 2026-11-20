import { useEffect, useState } from 'react'
import {
  Check,
  Eye,
  EyeOff,
  Loader2,
  PlugZap,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react'
import { fetchHealth } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { getToken, setToken } from '@/lib/storage'
import { cn } from '@/lib/utils'
import { useChatStore } from '@/store/chatStore'
import type { HealthState } from '@/types'

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
}

const inputClass =
  'mt-1.5 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring'

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const settings = useChatStore((state) => state.settings)
  const setSettings = useChatStore((state) => state.setSettings)
  const clearConversations = useChatStore((state) => state.clearConversations)
  const conversations = useChatStore((state) => state.conversations)

  const [apiBaseUrl, setApiBaseUrl] = useState(settings.apiBaseUrl)
  const [sessionPrefix, setSessionPrefix] = useState(settings.sessionPrefix)
  const [token, setTokenValue] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<HealthState | null>(null)

  useEffect(() => {
    if (!open) return
    setApiBaseUrl(settings.apiBaseUrl)
    setSessionPrefix(settings.sessionPrefix)
    setTokenValue(getToken())
    setShowToken(false)
    setTestResult(null)
  }, [open, settings.apiBaseUrl, settings.sessionPrefix])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const save = () => {
    setSettings({
      apiBaseUrl: apiBaseUrl.trim() || '/api',
      sessionPrefix: sessionPrefix.trim() || 'web',
    })
    setToken(token)
    onClose()
  }

  const testConnection = async () => {
    setTesting(true)
    setTestResult(null)
    const result = await fetchHealth({ baseUrl: apiBaseUrl, token })
    setTestResult(result)
    setTesting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">Connection settings</h2>
            <p className="text-xs text-muted-foreground">
              Stored locally in this browser.
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <label className="block">
            <span className="text-xs font-medium">API base URL</span>
            <input
              value={apiBaseUrl}
              onChange={(event) => setApiBaseUrl(event.target.value)}
              placeholder="/api"
              spellCheck={false}
              className={inputClass}
            />
            <span className="mt-1 block text-[11px] text-muted-foreground">
              <code className="rounded bg-muted px-1">/api</code> uses the
              built-in proxy. Absolute URLs require CORS on empirical-api.
            </span>
          </label>

          <label className="block">
            <span className="text-xs font-medium">Session prefix</span>
            <input
              value={sessionPrefix}
              onChange={(event) => setSessionPrefix(event.target.value)}
              placeholder="web"
              spellCheck={false}
              className={inputClass}
            />
            <span className="mt-1 block text-[11px] text-muted-foreground">
              New chats receive a unique <code className="rounded bg-muted px-1">X-Session-Id</code>{' '}
              starting with this prefix. Existing chats keep their session id.
            </span>
          </label>

          <label className="block">
            <span className="text-xs font-medium">Bearer token (optional)</span>
            <div className="relative">
              <input
                value={token}
                onChange={(event) => setTokenValue(event.target.value)}
                type={showToken ? 'text' : 'password'}
                placeholder="Forwarded as Authorization"
                spellCheck={false}
                autoComplete="off"
                className={cn(inputClass, 'pr-10')}
              />
              <button
                type="button"
                onClick={() => setShowToken((value) => !value)}
                className="absolute right-1 top-1/2 mt-0.5 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label={showToken ? 'Hide token' : 'Show token'}
              >
                {showToken ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            <span className="mt-1 block text-[11px] text-muted-foreground">
              Kept in sessionStorage only and cleared when this tab closes.
            </span>
          </label>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void testConnection()}
              disabled={testing}
            >
              {testing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <PlugZap className="h-3.5 w-3.5" />
              )}
              Test connection
            </Button>

            {testResult && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-xs',
                  testResult.ok
                    ? 'text-emerald-500'
                    : testResult.reachable
                      ? 'text-amber-500'
                      : 'text-destructive',
                )}
              >
                {testResult.ok ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <X className="h-3.5 w-3.5" />
                )}
                {testResult.ok
                  ? `Connected${testResult.model ? ` · ${testResult.model}` : ''}`
                  : testResult.reachable
                    ? `Degraded (${testResult.status})`
                    : 'Unreachable'}
              </span>
            )}
          </div>

          <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-3">
            <p className="text-xs font-medium text-destructive">Local history</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {conversations.length} conversation
              {conversations.length === 1 ? '' : 's'} stored in this browser.
              The Empirical API does not keep conversation history.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={conversations.length === 0}
              onClick={() => {
                if (
                  window.confirm(
                    'Delete all conversations stored in this browser? This cannot be undone.',
                  )
                ) {
                  clearConversations()
                  onClose()
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear all history
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={() => {
              setApiBaseUrl('/api')
              setSessionPrefix('web')
              setTokenValue('')
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={save}>
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

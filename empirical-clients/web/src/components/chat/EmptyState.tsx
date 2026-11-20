import {
  CreditCard,
  List,
  PackagePlus,
  Search,
  ShoppingBag,
  Sparkles,
  Trash2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { embedConfig } from '@/lib/embed'

const INVENTORY_PROMPTS: { icon: LucideIcon; label: string; prompt: string }[] = [
  { icon: PackagePlus, label: 'Add inventory', prompt: 'add 3 apples' },
  { icon: List, label: 'List everything', prompt: 'list all items' },
  { icon: Search, label: 'Filter items', prompt: 'show me apples' },
  { icon: Trash2, label: 'Delete an item', prompt: 'delete item 5' },
]

const SHOP_PROMPTS: { icon: LucideIcon; label: string; prompt: string }[] = [
  { icon: Search, label: 'Find red t-shirts', prompt: 'find tshirt with color red' },
  { icon: List, label: 'Hoodies under $60', prompt: 'show me hoodies under 60 dollars' },
  { icon: ShoppingBag, label: 'Add to cart', prompt: 'add the black hoodie to my cart' },
  { icon: CreditCard, label: 'Go to checkout', prompt: 'go to checkout' },
]

export function EmptyState({
  onPrompt,
}: {
  onPrompt: (prompt: string) => void
}) {
  const shopping = embedConfig.embedded
  const prompts = shopping ? SHOP_PROMPTS : INVENTORY_PROMPTS

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-10">
      <div className="w-full max-w-2xl text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 text-white shadow-lg shadow-amber-500/20">
          <Sparkles className="h-6 w-6" />
        </div>

        <h2 className="mt-5 text-2xl font-semibold tracking-tight">
          {shopping ? 'What are you shopping for?' : 'What can I help with?'}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {shopping
            ? 'Ask for products in plain English. Empirical turns your message into a validated store API call and the storefront reacts.'
            : 'Empirical converts plain English into validated inventory API calls. Try one of these to get started.'}
        </p>

        <div className="mt-7 grid gap-2 sm:grid-cols-2">
          {prompts.map(({ icon: Icon, label, prompt }) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onPrompt(prompt)}
              className="group flex items-start gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-ring/50 hover:bg-accent/50"
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:text-foreground">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{label}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  “{prompt}”
                </span>
              </span>
            </button>
          ))}
        </div>

        <p className="mt-6 text-[11px] text-muted-foreground">
          {shopping
            ? 'Filters, cart changes, and navigation apply in the storefront. Destructive actions ask for confirmation.'
            : 'Destructive actions ask for confirmation before they run. History is stored only in this browser.'}
        </p>
      </div>
    </div>
  )
}

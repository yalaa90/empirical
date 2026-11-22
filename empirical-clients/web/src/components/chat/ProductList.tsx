import { useState } from 'react'
import { Check, Package, Plus } from 'lucide-react'
import {
  EMBED_PROMPT_EVENT,
  requestAddToCart,
  resolveHostAsset,
} from '@/lib/embed'
import { cn } from '@/lib/utils'
import type { ProductItem } from '@/types'

const priceFormat = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
})

export function ProductList({ products }: { products: ProductItem[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card text-sm shadow-sm">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Products
        </span>
        <span className="text-xs text-muted-foreground">
          {products.length} item{products.length === 1 ? '' : 's'}
        </span>
      </div>
      <ul className="max-h-96 divide-y divide-border/60 overflow-y-auto">
        {products.map((product) => (
          <ProductRow key={product.id} product={product} />
        ))}
      </ul>
    </div>
  )
}

function ProductRow({ product }: { product: ProductItem }) {
  const [imageFailed, setImageFailed] = useState(false)
  const [added, setAdded] = useState(false)
  const image = resolveHostAsset(product.image)
  const soldOut = typeof product.stock === 'number' && product.stock <= 0

  const add = () => {
    if (soldOut) return
    if (!requestAddToCart(product)) {
      // Standalone chat: fall back to asking the assistant.
      window.dispatchEvent(
        new CustomEvent<string>(EMBED_PROMPT_EVENT, {
          detail: `add ${product.name} to cart`,
        }),
      )
    }
    setAdded(true)
    window.setTimeout(() => setAdded(false), 1500)
  }

  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-muted/40">
        {image && !imageFailed ? (
          <img
            src={image}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <Package className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{product.name}</p>
        <p className="text-xs text-muted-foreground">
          {typeof product.price === 'number' && priceFormat.format(product.price)}
          {soldOut && <span className="ml-2 text-destructive">Sold out</span>}
        </p>
      </div>
      <button
        type="button"
        onClick={add}
        disabled={soldOut}
        aria-label={`Add ${product.name} to cart`}
        title={soldOut ? 'Sold out' : 'Add to cart'}
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors',
          'border-border bg-background hover:bg-primary hover:text-primary-foreground',
          'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-background disabled:hover:text-current',
          added && 'border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-500',
        )}
      >
        {added ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      </button>
    </li>
  )
}

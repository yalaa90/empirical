import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { Check, ChevronLeft, ChevronRight, Package, Plus } from 'lucide-react'
import {
  EMBED_PROMPT_EVENT,
  requestAddToCart,
  requestOpenProduct,
  resolveHostAsset,
} from '@/lib/embed'
import { cn } from '@/lib/utils'
import type { ProductItem } from '@/types'

const priceFormat = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
})

function askAssistant(text: string) {
  window.dispatchEvent(new CustomEvent<string>(EMBED_PROMPT_EVENT, { detail: text }))
}

export function ProductList({ products }: { products: ProductItem[] }) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)

  const updateArrows = () => {
    const track = trackRef.current
    if (!track) return
    setCanPrev(track.scrollLeft > 4)
    setCanNext(track.scrollLeft + track.clientWidth < track.scrollWidth - 4)
  }

  useEffect(() => {
    updateArrows()
    const track = trackRef.current
    if (!track) return
    const observer = new ResizeObserver(updateArrows)
    observer.observe(track)
    return () => observer.disconnect()
  }, [products.length])

  const scrollBy = (direction: 1 | -1) => {
    const track = trackRef.current
    if (!track) return
    track.scrollBy({ left: direction * track.clientWidth * 0.8, behavior: 'smooth' })
  }

  const open = (product: ProductItem) => {
    setSelectedId(product.id)
    if (!requestOpenProduct(product)) askAssistant(`open ${product.name}`)
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card text-sm shadow-sm">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Products
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {products.length} item{products.length === 1 ? '' : 's'}
          </span>
          <ArrowButton direction={-1} disabled={!canPrev} onClick={() => scrollBy(-1)} />
          <ArrowButton direction={1} disabled={!canNext} onClick={() => scrollBy(1)} />
        </div>
      </div>
      <div
        ref={trackRef}
        onScroll={updateArrows}
        role="listbox"
        aria-label="Products"
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth p-3 [scrollbar-width:thin]"
      >
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            selected={selectedId === product.id}
            onOpen={() => open(product)}
          />
        ))}
      </div>
    </div>
  )
}

function ArrowButton({
  direction,
  disabled,
  onClick,
}: {
  direction: 1 | -1
  disabled: boolean
  onClick: () => void
}) {
  const Icon = direction === 1 ? ChevronRight : ChevronLeft
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === 1 ? 'Next products' : 'Previous products'}
      className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background transition-colors hover:bg-accent disabled:cursor-default disabled:opacity-30 disabled:hover:bg-background"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  )
}

function ProductCard({
  product,
  selected,
  onOpen,
}: {
  product: ProductItem
  selected: boolean
  onOpen: () => void
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const [added, setAdded] = useState(false)
  const image = resolveHostAsset(product.image)
  const soldOut = typeof product.stock === 'number' && product.stock <= 0

  const add = (event: MouseEvent) => {
    event.stopPropagation()
    if (soldOut) return
    if (!requestAddToCart(product)) askAssistant(`add ${product.name} to cart`)
    setAdded(true)
    window.setTimeout(() => setAdded(false), 1500)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onOpen()
    }
  }

  return (
    <div
      role="option"
      aria-selected={selected}
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={onKeyDown}
      title={`View ${product.name}`}
      className={cn(
        'group relative flex w-36 shrink-0 cursor-pointer snap-start flex-col overflow-hidden rounded-lg border bg-background transition-all',
        'hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        selected ? 'border-primary ring-2 ring-primary/40' : 'border-border/70',
      )}
    >
      <div className="flex aspect-square w-full items-center justify-center overflow-hidden bg-muted/40">
        {image && !imageFailed ? (
          <img
            src={image}
            alt={product.name}
            loading="lazy"
            draggable={false}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <Package className="h-8 w-8 text-muted-foreground" />
        )}
      </div>

      <button
        type="button"
        onClick={add}
        disabled={soldOut}
        aria-label={`Add ${product.name} to cart`}
        title={soldOut ? 'Sold out' : 'Add to cart'}
        className={cn(
          'absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full border shadow-sm transition-colors',
          'border-border bg-background/95 hover:bg-primary hover:text-primary-foreground',
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-background/95 disabled:hover:text-current',
          added && 'border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-500',
        )}
      >
        {added ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      </button>

      <div className="flex flex-1 flex-col gap-0.5 p-2">
        <p className="line-clamp-2 text-xs font-medium leading-4">{product.name}</p>
        <p className="mt-auto pt-1 text-xs text-muted-foreground">
          {typeof product.price === 'number' && priceFormat.format(product.price)}
          {soldOut && <span className="ml-1.5 text-destructive">Sold out</span>}
        </p>
      </div>
    </div>
  )
}

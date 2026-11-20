import { Link } from 'react-router-dom'
import { Plus, ShoppingBag } from 'lucide-react'
import { ProductImage } from '@/components/catalog/ProductImage'
import { RatingStars } from '@/components/catalog/RatingStars'
import { useCartStore } from '@/store/cartStore'
import { useUiStore } from '@/store/uiStore'
import {
  cn,
  COLOR_SWATCHES,
  formatPrice,
  CATEGORY_SINGULAR,
} from '@/lib/utils'
import type { Product } from '@/types'

export function ProductCard({ product }: { product: Product }) {
  const addItem = useCartStore((state) => state.addItem)
  const showToast = useUiStore((state) => state.showToast)
  const outOfStock = product.stock <= 0

  const quickAdd = () => {
    if (outOfStock) return
    addItem(product.id, 1)
    showToast({
      tone: 'success',
      title: 'Added to cart',
      message: `${product.name} · ${formatPrice(product.price)}`,
    })
  }

  return (
    <article className="group relative flex flex-col">
      <Link
        to={`/product/${product.id}`}
        className="relative block overflow-hidden rounded-2xl bg-stone-100"
      >
        <ProductImage
          product={product}
          className="aspect-[4/5] w-full"
          imageClassName="group-hover:scale-[1.04]"
        />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {outOfStock ? (
            <span className="rounded-full bg-stone-950/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur">
              Sold out
            </span>
          ) : product.stock <= 5 ? (
            <span className="rounded-full bg-amber-300/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-stone-950 backdrop-blur">
              Low stock
            </span>
          ) : null}
        </div>
        <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-white/70 bg-white/80 shadow-sm backdrop-blur">
          <span
            className="h-3.5 w-3.5 rounded-full border border-stone-300"
            style={{ backgroundColor: COLOR_SWATCHES[product.color] }}
            title={product.color}
          />
        </span>
      </Link>

      <div className="flex flex-1 flex-col pt-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">
              {product.brand} · {CATEGORY_SINGULAR[product.category]}
            </p>
            <Link
              to={`/product/${product.id}`}
              className="mt-1 block truncate text-sm font-semibold text-stone-900 hover:underline"
            >
              {product.name}
            </Link>
          </div>
          <span
            className={cn(
              'shrink-0 text-sm font-bold text-stone-950',
              outOfStock && 'text-stone-400',
            )}
          >
            {formatPrice(product.price)}
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between gap-3">
          <RatingStars rating={product.rating} />
          <button
            type="button"
            onClick={quickAdd}
            disabled={outOfStock}
            aria-label={`Add ${product.name} to cart`}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 text-[11px] font-semibold text-stone-700 transition-colors hover:border-stone-900 hover:bg-stone-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {outOfStock ? (
              <ShoppingBag className="h-3.5 w-3.5" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            {outOfStock ? 'Sold out' : 'Quick add'}
          </button>
        </div>
      </div>
    </article>
  )
}

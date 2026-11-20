import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Minus,
  Plus,
  ShieldCheck,
  Truck,
} from 'lucide-react'
import { ProductCard } from '@/components/catalog/ProductCard'
import { ProductImage } from '@/components/catalog/ProductImage'
import { RatingStars } from '@/components/catalog/RatingStars'
import { Button } from '@/components/ui/Button'
import { getProductById, getRelatedProducts } from '@/lib/catalog'
import {
  CATEGORY_LABELS,
  COLOR_LABELS,
  COLOR_SWATCHES,
  formatPrice,
} from '@/lib/utils'
import { useCartStore } from '@/store/cartStore'
import { useUiStore } from '@/store/uiStore'

export function ProductPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const product = getProductById(id)
  const addItem = useCartStore((state) => state.addItem)
  const openCart = useUiStore((state) => state.openCart)
  const showToast = useUiStore((state) => state.showToast)

  const [size, setSize] = useState(product?.sizes[0] ?? 'One size')
  const [qty, setQty] = useState(1)

  useEffect(() => {
    setSize(product?.sizes[0] ?? 'One size')
    setQty(1)
  }, [product?.id, product?.sizes])

  if (!product) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-600">
          Not found
        </p>
        <h1 className="mt-2 text-3xl font-extrabold text-stone-950">
          That product is no longer here
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          It may have sold out or the link is incorrect.
        </p>
        <Button className="mt-6" onClick={() => navigate('/')}>
          Back to the catalog
        </Button>
      </div>
    )
  }

  const related = getRelatedProducts(product)
  const outOfStock = product.stock <= 0

  const addToCart = () => {
    if (outOfStock) return
    addItem(product.id, qty, size)
    showToast({
      tone: 'success',
      title: 'Added to cart',
      message: `${product.name} · Size ${size} · ${formatPrice(product.price)}`,
    })
    openCart()
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <nav className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
        <Link to="/" className="hover:text-stone-900">
          Home
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link
          to={`/?category=${product.category}`}
          className="hover:text-stone-900"
        >
          {CATEGORY_LABELS[product.category]}
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="truncate font-medium text-stone-800">
          {product.name}
        </span>
      </nav>

      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </button>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        <div className="grid gap-3 sm:grid-cols-[76px_1fr]">
          <div className="order-2 hidden gap-3 sm:order-1 sm:flex sm:flex-col">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="overflow-hidden rounded-xl border border-stone-200 bg-white"
              >
                <ProductImage
                  product={product}
                  className="aspect-square w-full"
                />
              </div>
            ))}
          </div>
          <ProductImage
            product={product}
            className="order-1 aspect-[4/5] w-full rounded-3xl sm:order-2"
          />
        </div>

        <div className="lg:pt-2">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">
            <span>{product.brand}</span>
            <span className="h-1 w-1 rounded-full bg-stone-300" />
            <span>{CATEGORY_LABELS[product.category]}</span>
          </div>

          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-stone-950 sm:text-4xl">
            {product.name}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-4">
            <RatingStars rating={product.rating} />
            <span className="text-xs text-stone-400">
              {product.stock > 0
                ? `${product.stock} in stock`
                : 'Currently sold out'}
            </span>
          </div>

          <div className="mt-5 flex items-baseline gap-3">
            <span className="text-3xl font-extrabold text-stone-950">
              {formatPrice(product.price)}
            </span>
            <span className="text-xs text-stone-400">Tax calculated at checkout</span>
          </div>

          <p className="mt-5 max-w-xl text-sm leading-7 text-stone-600">
            {product.description}
          </p>

          <div className="mt-6 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">
              Color
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700">
              <span
                className="h-3 w-3 rounded-full border border-stone-300"
                style={{ backgroundColor: COLOR_SWATCHES[product.color] }}
              />
              {COLOR_LABELS[product.color]}
            </span>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                Size
              </span>
              <span className="text-[11px] text-stone-400">
                True to size
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {product.sizes.map((option) => {
                const selected = size === option
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSize(option)}
                    className={
                      selected
                        ? 'inline-flex h-10 min-w-10 items-center justify-center rounded-xl border border-stone-950 bg-stone-950 px-3 text-xs font-bold text-white'
                        : 'inline-flex h-10 min-w-10 items-center justify-center rounded-xl border border-stone-300 bg-white px-3 text-xs font-semibold text-stone-700 transition-colors hover:border-stone-500'
                    }
                    aria-pressed={selected}
                  >
                    {option}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <div className="inline-flex h-12 items-center justify-between rounded-full border border-stone-300 bg-white px-2 sm:w-36">
              <button
                type="button"
                onClick={() => setQty((value) => Math.max(1, value - 1))}
                className="flex h-9 w-9 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100"
                aria-label="Decrease quantity"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold">{qty}</span>
              <button
                type="button"
                onClick={() =>
                  setQty((value) => Math.min(product.stock || 1, value + 1))
                }
                className="flex h-9 w-9 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100"
                aria-label="Increase quantity"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <Button
              size="lg"
              className="flex-1"
              onClick={addToCart}
              disabled={outOfStock}
            >
              {outOfStock ? 'Sold out' : `Add to cart · ${formatPrice(product.price * qty)}`}
            </Button>
          </div>

          <div className="mt-6 grid gap-2.5 rounded-2xl border border-stone-200 bg-white p-4 text-xs text-stone-600 sm:grid-cols-2">
            <span className="inline-flex items-center gap-2">
              <Truck className="h-4 w-4 text-stone-400" />
              Free shipping over $75
            </span>
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-stone-400" />
              30-day demo returns
            </span>
            <span className="inline-flex items-center gap-2">
              <Check className="h-4 w-4 text-stone-400" />
              In stock and ready to ship
            </span>
            <span className="inline-flex items-center gap-2">
              <Check className="h-4 w-4 text-stone-400" />
              No real payment required
            </span>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-16 border-t border-stone-200 pt-10">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-600">
                You might also like
              </p>
              <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-stone-950">
                More from Northline
              </h2>
            </div>
            <Link
              to={`/?category=${product.category}`}
              className="text-xs font-semibold text-stone-500 hover:text-stone-950"
            >
              View all
            </Link>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-9 md:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

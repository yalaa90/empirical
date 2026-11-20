import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ProductImage } from '@/components/catalog/ProductImage'
import {
  FREE_SHIPPING_THRESHOLD,
  getCartLines,
  getCartTotals,
  useCartStore,
} from '@/store/cartStore'
import { useUiStore } from '@/store/uiStore'
import { formatPrice } from '@/lib/utils'

export function CartDrawer() {
  const open = useUiStore((state) => state.cartOpen)
  const closeCart = useUiStore((state) => state.closeCart)
  const items = useCartStore((state) => state.items)
  const setQty = useCartStore((state) => state.setQty)
  const removeItem = useCartStore((state) => state.removeItem)

  const lines = getCartLines(items)
  const totals = getCartTotals(items)
  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - totals.subtotal)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeCart()
    }
    window.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, closeCart])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        type="button"
        aria-label="Close cart"
        onClick={closeCart}
        className="absolute inset-0 bg-stone-950/35 backdrop-blur-[2px]"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        className="absolute right-0 top-0 flex h-full w-full max-w-md animate-slide-up flex-col bg-stone-50 shadow-panel"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-stone-200 px-5">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-stone-500" />
            <h2 className="text-sm font-bold text-stone-950">
              Your cart
              <span className="ml-2 text-stone-400">
                {items.reduce((count, item) => count + item.qty, 0)}
              </span>
            </h2>
          </div>
          <button
            type="button"
            onClick={closeCart}
            className="rounded-full p-2 text-stone-500 transition-colors hover:bg-stone-200 hover:text-stone-950"
            aria-label="Close cart"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-stone-100 text-stone-400">
              <ShoppingBag className="h-7 w-7" />
            </span>
            <h3 className="mt-4 text-lg font-semibold text-stone-900">
              Your cart is empty
            </h3>
            <p className="mt-1 max-w-xs text-sm text-stone-500">
              Add a few essentials, or ask the assistant to find something for
              you.
            </p>
            <Button className="mt-5" onClick={closeCart}>
              Continue shopping
            </Button>
          </div>
        ) : (
          <>
            <div className="border-b border-stone-200 bg-white px-5 py-3">
              {remaining > 0 ? (
                <p className="text-xs text-stone-500">
                  Add{' '}
                  <span className="font-semibold text-stone-900">
                    {formatPrice(remaining)}
                  </span>{' '}
                  more for free shipping.
                </p>
              ) : (
                <p className="text-xs font-semibold text-emerald-600">
                  Free shipping unlocked.
                </p>
              )}
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-100">
                <div
                  className="h-full rounded-full bg-stone-900 transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      (totals.subtotal / FREE_SHIPPING_THRESHOLD) * 100,
                    )}%`,
                  }}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <ul className="space-y-4">
                {lines.map((line) => (
                  <li
                    key={`${line.productId}-${line.size}`}
                    className="flex gap-3.5 rounded-2xl border border-stone-200 bg-white p-3"
                  >
                    <Link
                      to={`/product/${line.product.id}`}
                      onClick={closeCart}
                      className="shrink-0"
                    >
                      <ProductImage
                        product={line.product}
                        className="h-24 w-20 rounded-xl"
                      />
                    </Link>

                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link
                            to={`/product/${line.product.id}`}
                            onClick={closeCart}
                            className="block truncate text-sm font-semibold text-stone-900 hover:underline"
                          >
                            {line.product.name}
                          </Link>
                          <p className="mt-0.5 text-xs text-stone-500">
                            Size {line.size}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(line.productId, line.size)}
                          className="rounded-full p-1.5 text-stone-400 transition-colors hover:bg-red-50 hover:text-red-600"
                          aria-label={`Remove ${line.product.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="mt-auto flex items-center justify-between pt-2">
                        <div className="inline-flex h-8 items-center rounded-full border border-stone-200">
                          <button
                            type="button"
                            onClick={() =>
                              setQty(line.productId, line.size, line.qty - 1)
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-7 text-center text-xs font-semibold">
                            {line.qty}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setQty(line.productId, line.size, line.qty + 1)
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100"
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <span className="text-sm font-bold text-stone-950">
                          {formatPrice(line.lineTotal)}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="shrink-0 border-t border-stone-200 bg-white p-5">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between text-stone-500">
                  <dt>Subtotal</dt>
                  <dd className="font-medium text-stone-900">
                    {formatPrice(totals.subtotal)}
                  </dd>
                </div>
                <div className="flex justify-between text-stone-500">
                  <dt>Shipping</dt>
                  <dd className="font-medium text-stone-900">
                    {totals.shipping === 0
                      ? 'Free'
                      : formatPrice(totals.shipping)}
                  </dd>
                </div>
                <div className="flex justify-between text-stone-500">
                  <dt>Estimated tax</dt>
                  <dd className="font-medium text-stone-900">
                    {formatPrice(totals.tax)}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-stone-200 pt-2 text-base font-bold text-stone-950">
                  <dt>Total</dt>
                  <dd>{formatPrice(totals.total)}</dd>
                </div>
              </dl>

              <Link
                to="/checkout"
                onClick={closeCart}
                className="mt-4 flex h-12 w-full items-center justify-center rounded-full bg-stone-900 text-sm font-semibold text-white transition-colors hover:bg-stone-800"
              >
                Checkout
              </Link>
              <button
                type="button"
                onClick={closeCart}
                className="mt-2 h-10 w-full text-xs font-semibold text-stone-500 transition-colors hover:text-stone-900"
              >
                Continue shopping
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  )
}

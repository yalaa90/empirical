import { Link, useLocation } from 'react-router-dom'
import { MessageCircle, ShoppingBag } from 'lucide-react'
import { CATEGORIES } from '@/lib/filters'
import { cn, CATEGORY_LABELS } from '@/lib/utils'
import { useCartStore, getCartCount } from '@/store/cartStore'
import { useUiStore } from '@/store/uiStore'

export function Header() {
  const items = useCartStore((state) => state.items)
  const openCart = useUiStore((state) => state.openCart)
  const openChat = useUiStore((state) => state.openChat)
  const count = getCartCount(items)
  const location = useLocation()

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-stone-50/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="group flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-900 text-sm font-black text-amber-300 transition-transform group-hover:-rotate-6">
            N
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-sm font-black tracking-[0.18em] text-stone-950">
              NORTHLINE
            </span>
            <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.22em] text-stone-500">
              Supply Co.
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          <Link
            to="/"
            className={cn(
              'rounded-full px-3.5 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-200/60 hover:text-stone-950',
              location.pathname === '/' &&
                !new URLSearchParams(location.search).get('category') &&
                'bg-stone-200/70 text-stone-950',
            )}
          >
            New in
          </Link>
          {CATEGORIES.map((category) => {
            const active =
              location.pathname === '/' &&
              new URLSearchParams(location.search).get('category') === category
            return (
              <Link
                key={category}
                to={`/?category=${category}`}
                className={cn(
                  'rounded-full px-3.5 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-200/60 hover:text-stone-950',
                  active && 'bg-stone-200/70 text-stone-950',
                )}
              >
                {CATEGORY_LABELS[category]}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={openChat}
            className="hidden h-10 items-center gap-2 rounded-full border border-stone-300 bg-white px-4 text-xs font-semibold text-stone-700 transition-colors hover:border-stone-400 hover:text-stone-950 sm:inline-flex"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Ask Empirical
          </button>

          <button
            type="button"
            onClick={openCart}
            className="relative inline-flex h-10 items-center gap-2 rounded-full bg-stone-900 px-4 text-xs font-semibold text-white transition-colors hover:bg-stone-800"
          >
            <ShoppingBag className="h-4 w-4" />
            <span className="hidden sm:inline">Cart</span>
            <span
              className={cn(
                'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold',
                count > 0
                  ? 'bg-amber-300 text-stone-950'
                  : 'bg-stone-700 text-stone-300',
              )}
            >
              {count}
            </span>
          </button>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-t border-stone-200/70 px-4 py-2 lg:hidden">
        <Link
          to="/"
          className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-200/60"
        >
          New in
        </Link>
        {CATEGORIES.map((category) => (
          <Link
            key={category}
            to={`/?category=${category}`}
            className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-200/60"
          >
            {CATEGORY_LABELS[category]}
          </Link>
        ))}
      </div>
    </header>
  )
}

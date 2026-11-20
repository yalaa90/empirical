import { useMemo } from 'react'
import { ArrowRight, MessageCircle, Search, Sparkles, Truck } from 'lucide-react'
import { ActiveFilters } from '@/components/catalog/ActiveFilters'
import { FilterBar } from '@/components/catalog/FilterBar'
import { ProductGrid } from '@/components/catalog/ProductGrid'
import { ProductImage } from '@/components/catalog/ProductImage'
import { Button } from '@/components/ui/Button'
import { useCatalogFilters } from '@/hooks/useCatalogFilters'
import { products } from '@/lib/catalog'
import { filterProducts } from '@/lib/filters'
import { requestChatPrompt } from '@/lib/chatPrompt'
import { formatPrice } from '@/lib/utils'
import { useUiStore } from '@/store/uiStore'

const CHAT_PROMPTS = [
  'Find red t-shirts',
  'Show hoodies under $60',
  'Add the black hoodie to my cart',
]

export function HomePage() {
  const { filters, update, reset } = useCatalogFilters()
  const openChat = useUiStore((state) => state.openChat)
  const visibleProducts = useMemo(
    () => filterProducts(products, filters),
    [filters],
  )

  const featured = [products[0], products[26], products[47]].filter(Boolean)

  const startChat = (prompt: string) => {
    openChat()
    requestChatPrompt(prompt)
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <section className="relative mt-5 overflow-hidden rounded-[2rem] bg-stone-950 text-white sm:mt-8">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
            backgroundSize: '42px 42px',
          }}
        />
        <div className="absolute -right-24 -top-32 h-96 w-96 rounded-full bg-amber-400/20 blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />

        <div className="relative grid gap-10 px-6 py-10 sm:px-10 sm:py-14 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:px-14">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200">
              <Sparkles className="h-3.5 w-3.5" />
              Chat-powered shopping demo
            </span>

            <h1 className="mt-6 max-w-2xl text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Everyday gear,
              <span className="block text-amber-300">zero guesswork.</span>
            </h1>

            <p className="mt-5 max-w-xl text-sm leading-7 text-stone-300 sm:text-base">
              Browse 100 sample products, filter by color, size, and price — or
              ask the Empirical assistant to do it for you. It can even add items to
              your cart and take you to checkout.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a
                href="#catalog"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-amber-300 px-6 text-sm font-bold text-stone-950 transition-colors hover:bg-amber-200"
              >
                Shop the catalog
                <ArrowRight className="h-4 w-4" />
              </a>
              <Button
                variant="ghost"
                className="h-12 border border-white/15 px-6 text-sm font-semibold text-white hover:bg-white/10 hover:text-white"
                onClick={openChat}
              >
                <MessageCircle className="h-4 w-4" />
                Ask the assistant
              </Button>
            </div>

            <div className="mt-8 flex flex-wrap gap-2">
              {CHAT_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => startChat(prompt)}
                  className="rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-[11px] font-medium text-stone-200 transition-colors hover:border-amber-300/40 hover:bg-white/10 hover:text-white"
                >
                  “{prompt}”
                </button>
              ))}
            </div>
          </div>

          <div className="relative hidden min-h-[340px] lg:block">
            {featured.map((product, index) => (
              <div
                key={product.id}
                className={[
                  'absolute overflow-hidden rounded-2xl border border-white/15 bg-stone-900 shadow-2xl',
                  index === 0 &&
                    'left-0 top-6 z-20 w-52 rotate-[-5deg] animate-fade-in',
                  index === 1 &&
                    'right-2 top-0 z-10 w-48 rotate-[5deg] animate-fade-in',
                  index === 2 &&
                    'bottom-0 left-1/3 z-30 w-48 rotate-[2deg] animate-fade-in',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <ProductImage
                  product={product}
                  className="aspect-[4/5] w-full"
                />
                <div className="flex items-center justify-between gap-2 bg-stone-950/95 px-3 py-2.5">
                  <span className="truncate text-[11px] font-medium text-stone-300">
                    {product.name}
                  </span>
                  <span className="shrink-0 text-[11px] font-bold text-amber-300">
                    {formatPrice(product.price)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative grid grid-cols-3 divide-x divide-white/10 border-t border-white/10 bg-white/[0.03]">
          {[
            { label: 'Products', value: '100' },
            { label: 'Colors', value: '6' },
            { label: 'Free shipping', value: '$75+' },
          ].map((stat) => (
            <div key={stat.label} className="px-5 py-4 text-center">
              <p className="text-sm font-bold text-white sm:text-base">
                {stat.value}
              </p>
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-stone-400">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="catalog" className="scroll-mt-24 pt-12">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-600">
              The collection
            </p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-stone-950 sm:text-3xl">
              Shop all products
            </h2>
          </div>
          <div className="flex items-center gap-4 text-xs text-stone-500">
            <span className="inline-flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5" />
              Search, filter, sort
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5" />
              Free shipping over $75
            </span>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <FilterBar
            filters={filters}
            update={update}
            reset={reset}
            resultCount={visibleProducts.length}
          />
          <ActiveFilters filters={filters} update={update} />
        </div>

        <div className="mt-8">
          <ProductGrid products={visibleProducts} onReset={reset} />
        </div>
      </section>
    </div>
  )
}

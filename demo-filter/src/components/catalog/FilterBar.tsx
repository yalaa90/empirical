import { Search, SlidersHorizontal, X } from 'lucide-react'
import {
  CATEGORIES,
  COLORS,
  SIZES,
  SORT_KEYS,
  hasActiveFilters,
} from '@/lib/filters'
import { catalogMaxPrice, catalogPriceFloor } from '@/lib/catalog'
import {
  CATEGORY_LABELS,
  COLOR_LABELS,
  SORT_LABELS,
  cn,
  formatPrice,
} from '@/lib/utils'
import type { CatalogFilters } from '@/types'

interface FilterBarProps {
  filters: CatalogFilters
  update: (patch: Partial<CatalogFilters>, options?: { replace?: boolean }) => void
  reset: () => void
  resultCount: number
}

const selectClass =
  'h-10 rounded-xl border border-stone-300 bg-white px-3 text-xs font-medium text-stone-700 outline-none transition-colors focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10'

export function FilterBar({
  filters,
  update,
  reset,
  resultCount,
}: FilterBarProps) {
  const priceValue = filters.maxPrice ?? catalogMaxPrice

  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            value={filters.query}
            onChange={(event) => update({ query: event.target.value }, { replace: true })}
            placeholder="Search products, colors, brands…"
            aria-label="Search products"
            className="h-11 w-full rounded-xl border border-stone-300 bg-stone-50/70 pl-11 pr-10 text-sm text-stone-900 outline-none transition-colors placeholder:text-stone-400 focus:border-stone-900 focus:bg-white focus:ring-2 focus:ring-stone-900/10"
          />
          {filters.query && (
            <button
              type="button"
              onClick={() => update({ query: '' }, { replace: true })}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-400 xl:inline-flex">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filter
          </span>

          <select
            value={filters.category}
            onChange={(event) =>
              update({
                category: event.target.value as CatalogFilters['category'],
              })
            }
            aria-label="Filter by category"
            className={selectClass}
          >
            <option value="all">All categories</option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>

          <select
            value={filters.color}
            onChange={(event) =>
              update({ color: event.target.value as CatalogFilters['color'] })
            }
            aria-label="Filter by color"
            className={selectClass}
          >
            <option value="all">All colors</option>
            {COLORS.map((color) => (
              <option key={color} value={color}>
                {COLOR_LABELS[color]}
              </option>
            ))}
          </select>

          <select
            value={filters.size}
            onChange={(event) => update({ size: event.target.value })}
            aria-label="Filter by size"
            className={selectClass}
          >
            <option value="all">All sizes</option>
            {SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>

          <select
            value={filters.sort}
            onChange={(event) =>
              update({ sort: event.target.value as CatalogFilters['sort'] })
            }
            aria-label="Sort products"
            className={selectClass}
          >
            {SORT_KEYS.map((sort) => (
              <option key={sort} value={sort}>
                {SORT_LABELS[sort]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-stone-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <span className="w-24 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
            Max price
          </span>
          <input
            type="range"
            min={catalogPriceFloor}
            max={catalogMaxPrice}
            step={1}
            value={priceValue}
            onChange={(event) => {
              const value = Number(event.target.value)
              update(
                { maxPrice: value >= catalogMaxPrice ? null : value },
                { replace: true },
              )
            }}
            aria-label="Maximum price"
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-stone-200 accent-stone-900"
          />
          <span
            className={cn(
              'w-24 shrink-0 text-right text-xs font-semibold',
              filters.maxPrice === null ? 'text-stone-400' : 'text-stone-900',
            )}
          >
            {filters.maxPrice === null
              ? 'Any price'
              : `Up to ${formatPrice(filters.maxPrice)}`}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <span className="text-xs text-stone-500">
            {resultCount} product{resultCount === 1 ? '' : 's'}
          </span>
          {hasActiveFilters(filters) && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-stone-100 px-3 text-[11px] font-semibold text-stone-600 transition-colors hover:bg-stone-200 hover:text-stone-950"
            >
              <X className="h-3 w-3" />
              Clear all
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

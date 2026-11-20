import { X } from 'lucide-react'
import {
  CATEGORY_LABELS,
  COLOR_LABELS,
  SORT_LABELS,
  formatPrice,
} from '@/lib/utils'
import type { CatalogFilters } from '@/types'

interface ActiveFiltersProps {
  filters: CatalogFilters
  update: (patch: Partial<CatalogFilters>) => void
}

export function ActiveFilters({ filters, update }: ActiveFiltersProps) {
  const chips: { key: string; label: string; clear: () => void }[] = []

  if (filters.query) {
    chips.push({
      key: 'query',
      label: `“${filters.query}”`,
      clear: () => update({ query: '' }),
    })
  }
  if (filters.category !== 'all') {
    chips.push({
      key: 'category',
      label: CATEGORY_LABELS[filters.category],
      clear: () => update({ category: 'all' }),
    })
  }
  if (filters.color !== 'all') {
    chips.push({
      key: 'color',
      label: COLOR_LABELS[filters.color],
      clear: () => update({ color: 'all' }),
    })
  }
  if (filters.size !== 'all') {
    chips.push({
      key: 'size',
      label: `Size ${filters.size}`,
      clear: () => update({ size: 'all' }),
    })
  }
  if (filters.maxPrice !== null) {
    chips.push({
      key: 'price',
      label: `Up to ${formatPrice(filters.maxPrice)}`,
      clear: () => update({ maxPrice: null }),
    })
  }
  if (filters.sort !== 'featured') {
    chips.push({
      key: 'sort',
      label: SORT_LABELS[filters.sort],
      clear: () => update({ sort: 'featured' }),
    })
  }

  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.clear}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 text-[11px] font-semibold text-stone-700 transition-colors hover:border-stone-400 hover:bg-stone-100"
        >
          {chip.label}
          <X className="h-3 w-3 text-stone-400" />
        </button>
      ))}
    </div>
  )
}

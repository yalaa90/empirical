import { SearchX } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ProductCard } from '@/components/catalog/ProductCard'
import type { Product } from '@/types'

interface ProductGridProps {
  products: Product[]
  onReset: () => void
}

export function ProductGrid({ products, onReset }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-stone-300 bg-white/60 px-6 py-20 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-stone-100 text-stone-400">
          <SearchX className="h-6 w-6" />
        </span>
        <h3 className="mt-4 text-lg font-semibold text-stone-900">
          No products match those filters
        </h3>
        <p className="mt-1 max-w-sm text-sm text-stone-500">
          Try a broader search, or ask the Empirical assistant for a different
          color, size, or budget.
        </p>
        <Button variant="outline" className="mt-5" onClick={onReset}>
          Clear filters
        </Button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}

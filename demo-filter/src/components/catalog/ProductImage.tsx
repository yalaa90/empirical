import { useState } from 'react'
import { cn, COLOR_SWATCHES } from '@/lib/utils'
import type { Product } from '@/types'

interface ProductImageProps {
  product: Product
  className?: string
  imageClassName?: string
}

export function ProductImage({
  product,
  className,
  imageClassName,
}: ProductImageProps) {
  const [failed, setFailed] = useState(false)
  const swatch = COLOR_SWATCHES[product.color]

  if (failed) {
    return (
      <div
        className={cn(
          'flex items-center justify-center overflow-hidden bg-stone-100',
          className,
        )}
        style={{
          backgroundImage: `linear-gradient(135deg, ${swatch}22, #ffffff 55%, ${swatch}33)`,
        }}
        role="img"
        aria-label={product.name}
      >
        <span className="px-4 text-center text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
          {product.brand}
        </span>
      </div>
    )
  }

  return (
    <div className={cn('overflow-hidden bg-stone-100', className)}>
      <img
        src={product.image}
        alt={product.name}
        loading="lazy"
        onError={() => setFailed(true)}
        className={cn(
          'h-full w-full object-cover transition-transform duration-500',
          imageClassName,
        )}
      />
    </div>
  )
}

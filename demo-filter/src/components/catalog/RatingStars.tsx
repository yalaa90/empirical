import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

export function RatingStars({
  rating,
  className,
}: {
  rating: number
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <span className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Star
            key={index}
            className={cn(
              'h-3 w-3',
              index < Math.round(rating)
                ? 'fill-amber-400 text-amber-400'
                : 'fill-stone-200 text-stone-200',
            )}
          />
        ))}
      </span>
      <span className="text-[11px] font-medium text-stone-500">
        {rating.toFixed(1)}
      </span>
    </span>
  )
}

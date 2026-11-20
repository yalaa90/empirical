import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg' | 'icon'

const variants: Record<Variant, string> = {
  primary:
    'bg-stone-900 text-white shadow-sm hover:bg-stone-800 active:bg-stone-950 disabled:bg-stone-400',
  secondary:
    'bg-amber-400 text-stone-950 shadow-sm hover:bg-amber-300 active:bg-amber-500 disabled:bg-amber-200',
  outline:
    'border border-stone-300 bg-white text-stone-900 hover:border-stone-400 hover:bg-stone-50',
  ghost: 'text-stone-600 hover:bg-stone-100 hover:text-stone-950',
  danger:
    'bg-red-600 text-white shadow-sm hover:bg-red-500 active:bg-red-700 disabled:bg-red-300',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 rounded-full px-4 text-xs font-semibold',
  md: 'h-11 rounded-full px-5 text-sm font-semibold',
  lg: 'h-12 rounded-full px-7 text-sm font-semibold',
  icon: 'h-10 w-10 rounded-full',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex select-none items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  )
}

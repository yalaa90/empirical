import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Category, ProductColor, SortKey } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value)
}

export function formatDate(value: number): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export const CATEGORY_LABELS: Record<Category, string> = {
  tshirt: 'T-Shirts',
  hoodie: 'Hoodies',
  shoes: 'Shoes',
  hat: 'Hats',
  accessory: 'Accessories',
}

export const CATEGORY_SINGULAR: Record<Category, string> = {
  tshirt: 'T-Shirt',
  hoodie: 'Hoodie',
  shoes: 'Shoes',
  hat: 'Hat',
  accessory: 'Accessory',
}

export const COLOR_LABELS: Record<ProductColor, string> = {
  red: 'Red',
  blue: 'Blue',
  black: 'Black',
  white: 'White',
  green: 'Green',
  yellow: 'Yellow',
}

export const COLOR_SWATCHES: Record<ProductColor, string> = {
  red: '#b91c1c',
  blue: '#1d4ed8',
  black: '#1c1917',
  white: '#fafaf9',
  green: '#15803d',
  yellow: '#eab308',
}

export const SORT_LABELS: Record<SortKey, string> = {
  featured: 'Featured',
  'price-asc': 'Price: low to high',
  'price-desc': 'Price: high to low',
  rating: 'Top rated',
}

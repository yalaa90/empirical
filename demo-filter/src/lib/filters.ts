import type {
  CatalogFilters,
  Category,
  Product,
  ProductColor,
  SortKey,
} from '@/types'

export const CATEGORIES: Category[] = [
  'tshirt',
  'hoodie',
  'shoes',
  'hat',
  'accessory',
]

export const COLORS: ProductColor[] = [
  'red',
  'blue',
  'black',
  'white',
  'green',
  'yellow',
]

export const SIZES = ['S', 'M', 'L', 'XL', 'XXL', 'One size', '7', '8', '9', '10', '11', '12']

export const SORT_KEYS: SortKey[] = [
  'featured',
  'price-asc',
  'price-desc',
  'rating',
]

export const DEFAULT_FILTERS: CatalogFilters = {
  query: '',
  category: 'all',
  color: 'all',
  size: 'all',
  maxPrice: null,
  sort: 'featured',
}

export function isCategory(value: string): value is Category {
  return CATEGORIES.includes(value as Category)
}

export function isColor(value: string): value is ProductColor {
  return COLORS.includes(value as ProductColor)
}

function isSortKey(value: string): value is SortKey {
  return SORT_KEYS.includes(value as SortKey)
}

export function parseFilters(params: URLSearchParams): CatalogFilters {
  const category = params.get('category')
  const color = params.get('color')
  const sort = params.get('sort')
  const size = params.get('size')
  const maxPriceRaw = Number(params.get('maxPrice'))
  const maxPrice =
    params.has('maxPrice') && Number.isFinite(maxPriceRaw) && maxPriceRaw > 0
      ? maxPriceRaw
      : null

  return {
    query: params.get('q')?.trim() ?? '',
    category: category && isCategory(category) ? category : 'all',
    color: color && isColor(color) ? color : 'all',
    size: size && SIZES.includes(size) ? size : 'all',
    maxPrice,
    sort: sort && isSortKey(sort) ? sort : 'featured',
  }
}

export function toSearchParams(filters: CatalogFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.query.trim()) params.set('q', filters.query.trim())
  if (filters.category !== 'all') params.set('category', filters.category)
  if (filters.color !== 'all') params.set('color', filters.color)
  if (filters.size !== 'all') params.set('size', filters.size)
  if (filters.maxPrice !== null) params.set('maxPrice', String(filters.maxPrice))
  if (filters.sort !== 'featured') params.set('sort', filters.sort)
  return params
}

export function filterProducts(
  products: Product[],
  filters: CatalogFilters,
): Product[] {
  const query = filters.query.trim().toLowerCase()
  const normalizedQuery =
    query === 'all' || query === '*' || query === 'everything' ? '' : query

  const matches = products.filter((product) => {
    if (filters.category !== 'all' && product.category !== filters.category) {
      return false
    }
    if (filters.color !== 'all' && product.color !== filters.color) {
      return false
    }
    if (filters.size !== 'all' && !product.sizes.includes(filters.size)) {
      return false
    }
    if (filters.maxPrice !== null && product.price > filters.maxPrice) {
      return false
    }
    if (normalizedQuery) {
      const haystack = [
        product.name,
        product.brand,
        product.description,
        product.category,
        product.color,
        ...product.tags,
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(normalizedQuery)) return false
    }
    return true
  })

  return sortProducts(matches, filters.sort)
}

function sortProducts(products: Product[], sort: SortKey): Product[] {
  const next = [...products]
  switch (sort) {
    case 'price-asc':
      return next.sort((a, b) => a.price - b.price)
    case 'price-desc':
      return next.sort((a, b) => b.price - a.price)
    case 'rating':
      return next.sort((a, b) => b.rating - a.rating)
    default:
      return next
  }
}

export function hasActiveFilters(filters: CatalogFilters): boolean {
  return (
    filters.query !== '' ||
    filters.category !== 'all' ||
    filters.color !== 'all' ||
    filters.size !== 'all' ||
    filters.maxPrice !== null ||
    filters.sort !== 'featured'
  )
}

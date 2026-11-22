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

const CATEGORY_PATTERNS: Array<[Category, RegExp]> = [
  ['tshirt', /\b(?:tshirts?|shirts?|tees?)\b/i],
  ['hoodie', /\bhood(?:ie|y)s?\b/i],
  ['shoes', /\b(?:shoes?|sneakers?|footwear)\b/i],
  ['hat', /\b(?:hats?|caps?|beanies?)\b/i],
  ['accessory', /\b(?:accessor(?:y|ies)|bags?|wallets?|bottles?|socks?|totes?)\b/i],
]

const IRREGULAR_PLURALS: Record<string, string> = {
  accessories: 'accessory',
  beanies: 'beanie',
}

const QUERY_ALIASES: Record<string, string> = {
  tee: 'tshirt',
  tees: 'tshirt',
  shirt: 'tshirt',
  shirts: 'tshirt',
  tshirt: 'tshirt',
  tshirts: 'tshirt',
  hoodie: 'hoodie',
  hoodies: 'hoodie',
  hoody: 'hoodie',
  shoe: 'shoes',
  shoes: 'shoes',
  sneaker: 'shoes',
  sneakers: 'shoes',
  hat: 'hat',
  hats: 'hat',
  cap: 'hat',
  caps: 'hat',
  accessory: 'accessory',
  accessories: 'accessory',
}

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'the',
  'to',
  'my',
  'me',
  'in',
  'of',
  'for',
  'with',
  'please',
  'find',
  'show',
  'get',
  'add',
  'put',
  'open',
  'go',
  'take',
  'want',
  'need',
  'some',
])

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

export function inferCategoryFromQuery(value: string): Category | null {
  const matches = CATEGORY_PATTERNS.filter(([, pattern]) => pattern.test(value)).map(
    ([category]) => category,
  )
  return matches.length === 1 ? matches[0] : null
}

export function normalizeCategory(value: string): Category | null {
  const lowered = value.trim().toLowerCase()
  if (isCategory(lowered)) return lowered
  return inferCategoryFromQuery(lowered)
}

function singularize(token: string): string {
  if (IRREGULAR_PLURALS[token]) return IRREGULAR_PLURALS[token]
  if (token.length > 4 && token.endsWith('ies')) return token.slice(0, -3) + 'y'
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) {
    return token.slice(0, -1)
  }
  return token
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
    .map(singularize)
}

function tokenizeQuery(value: string): string[] {
  return tokenize(value).map((token) => QUERY_ALIASES[token] ?? token)
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
    category: category ? normalizeCategory(category) ?? 'all' : 'all',
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
  const rawQuery = filters.query.trim()
  const normalizedQuery = rawQuery.toLowerCase()
  const matchAll = ['', 'all', '*', 'everything'].includes(normalizedQuery)
  const queryTokens = tokenizeQuery(rawQuery)

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
    if (!matchAll && normalizedQuery) {
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
      if (!haystack.includes(normalizedQuery) && queryTokens.length > 0) {
        const haystackTokens = new Set(tokenize(haystack))
        const matchesToken = queryTokens.some((token) => {
          if (haystackTokens.has(token)) return true
          for (const candidate of haystackTokens) {
            if (candidate.startsWith(token) || token.startsWith(candidate)) {
              return true
            }
          }
          return false
        })
        if (!matchesToken) return false
      }
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

import { describe, expect, it } from 'vitest'
import rawProducts from '@/data/products.json'
import {
  DEFAULT_FILTERS,
  filterProducts,
  inferCategoryFromQuery,
  normalizeCategory,
  parseFilters,
  toSearchParams,
} from '@/lib/filters'
import type { Product } from '@/types'

const products = rawProducts as Product[]

describe('catalog', () => {
  it('contains 100 products', () => {
    expect(products).toHaveLength(100)
  })

  it('contains 25 t-shirts and 5 red t-shirts', () => {
    expect(products.filter((product) => product.category === 'tshirt')).toHaveLength(25)
    expect(
      products.filter(
        (product) => product.category === 'tshirt' && product.color === 'red',
      ),
    ).toHaveLength(5)
  })
})

describe('parseFilters', () => {
  it('parses valid filters from URL params', () => {
    const filters = parseFilters(
      new URLSearchParams(
        'q=hoodie&category=hoodie&color=black&size=L&maxPrice=60&sort=price-asc',
      ),
    )
    expect(filters).toEqual({
      query: 'hoodie',
      category: 'hoodie',
      color: 'black',
      size: 'L',
      maxPrice: 60,
      sort: 'price-asc',
    })
  })

  it('ignores invalid filters', () => {
    const filters = parseFilters(
      new URLSearchParams('category=nope&color=pink&size=huge&maxPrice=-4&sort=random'),
    )
    expect(filters).toEqual(DEFAULT_FILTERS)
  })

  it('normalizes category aliases from URL params', () => {
    expect(parseFilters(new URLSearchParams('category=t-shirts')).category).toBe(
      'tshirt',
    )
    expect(parseFilters(new URLSearchParams('category=hoodies')).category).toBe(
      'hoodie',
    )
  })

  it('round-trips through search params', () => {
    const filters = {
      ...DEFAULT_FILTERS,
      query: 'red shirt',
      category: 'tshirt' as const,
      color: 'red' as const,
      maxPrice: 50,
    }
    expect(parseFilters(toSearchParams(filters))).toEqual(filters)
  })
})

describe('category inference', () => {
  it('normalizes category aliases', () => {
    expect(normalizeCategory('t-shirts')).toBe('tshirt')
    expect(normalizeCategory('tshirts')).toBe('tshirt')
    expect(normalizeCategory('hoodies')).toBe('hoodie')
    expect(normalizeCategory('accessories')).toBe('accessory')
    expect(normalizeCategory('unknown')).toBeNull()
  })

  it('infers category from a search query', () => {
    expect(inferCategoryFromQuery('find t-shirts')).toBe('tshirt')
    expect(inferCategoryFromQuery('red hoodies')).toBe('hoodie')
    expect(inferCategoryFromQuery('all')).toBeNull()
  })
})

describe('filterProducts', () => {
  it('filters red t-shirts', () => {
    const result = filterProducts(products, {
      ...DEFAULT_FILTERS,
      query: 'tshirt',
      category: 'tshirt',
      color: 'red',
    })
    expect(result).toHaveLength(5)
    expect(
      result.every(
        (product) => product.category === 'tshirt' && product.color === 'red',
      ),
    ).toBe(true)
  })

  it('matches plural category queries', () => {
    expect(
      filterProducts(products, { ...DEFAULT_FILTERS, query: 't-shirts' }),
    ).toHaveLength(25)
    expect(
      filterProducts(products, { ...DEFAULT_FILTERS, query: 'hoodies' }),
    ).toHaveLength(20)
    expect(
      filterProducts(products, {
        ...DEFAULT_FILTERS,
        query: 'accessories',
        category: 'accessory',
      }),
    ).toHaveLength(20)
  })

  it('matches category aliases like tees', () => {
    expect(
      filterProducts(products, { ...DEFAULT_FILTERS, query: 'tees' }),
    ).toHaveLength(25)
  })

  it('applies a maximum price', () => {
    const result = filterProducts(products, {
      ...DEFAULT_FILTERS,
      category: 'hoodie',
      maxPrice: 60,
    })
    expect(result.length).toBeGreaterThan(0)
    expect(result.every((product) => product.price <= 60)).toBe(true)
  })

  it('sorts by price ascending', () => {
    const result = filterProducts(products, {
      ...DEFAULT_FILTERS,
      sort: 'price-asc',
    })
    const prices = result.map((product) => product.price)
    expect(prices).toEqual([...prices].sort((a, b) => a - b))
  })

  it('treats "all" as no text query', () => {
    expect(
      filterProducts(products, { ...DEFAULT_FILTERS, query: 'all' }),
    ).toHaveLength(products.length)
  })
})

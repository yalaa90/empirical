import rawProducts from '@/data/products.json'
import type { Product } from '@/types'

export const products = rawProducts as Product[]

const byId = new Map(products.map((product) => [product.id, product]))

export function getProductById(id: number | string | undefined): Product | undefined {
  const numeric = typeof id === 'string' ? Number(id) : id
  if (numeric === undefined || Number.isNaN(numeric)) return undefined
  return byId.get(numeric)
}

export function getRelatedProducts(product: Product, limit = 4): Product[] {
  return products
    .filter((item) => item.id !== product.id)
    .sort((a, b) => {
      const score = (candidate: Product) =>
        (candidate.category === product.category ? 2 : 0) +
        (candidate.color === product.color ? 1 : 0)
      return score(b) - score(a)
    })
    .slice(0, limit)
}

export const catalogMaxPrice = Math.ceil(
  Math.max(...products.map((product) => product.price)),
)

export const catalogPriceFloor = Math.floor(
  Math.min(...products.map((product) => product.price)),
)

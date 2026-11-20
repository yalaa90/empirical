export type Category = 'tshirt' | 'hoodie' | 'shoes' | 'hat' | 'accessory'

export type ProductColor =
  | 'red'
  | 'blue'
  | 'black'
  | 'white'
  | 'green'
  | 'yellow'

export interface Product {
  id: number
  name: string
  slug: string
  brand: string
  category: Category
  color: ProductColor
  sizes: string[]
  price: number
  rating: number
  stock: number
  description: string
  tags: string[]
  image: string
}

export type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'rating'

export interface CatalogFilters {
  query: string
  category: Category | 'all'
  color: ProductColor | 'all'
  size: string | 'all'
  maxPrice: number | null
  sort: SortKey
}

export interface CartItem {
  productId: number
  qty: number
  size: string
}

export interface CartLine extends CartItem {
  product: Product
  lineTotal: number
}

export interface Customer {
  name: string
  email: string
  address: string
  city: string
  postalCode: string
  country: string
}

export interface OrderItem {
  productId: number
  name: string
  image: string
  price: number
  qty: number
  size: string
}

export interface Order {
  id: string
  createdAt: number
  customer: Customer
  items: OrderItem[]
  subtotal: number
  shipping: number
  tax: number
  total: number
}

export interface ChatFilterPayload {
  query?: string
  category?: string
  color?: string
  max_price?: number | string | null
}

export interface ChatActionData {
  action?: string
  filters?: ChatFilterPayload
  count?: number
  product_ids?: number[]
  product_id?: number
  name?: string
  product_name?: string
  qty?: number
  price?: number
  page?: string
  removed?: boolean
  message?: string
  [key: string]: unknown
}

export interface EmpiricalResponsePayload {
  status?: string
  tool?: string
  result?: string
  data?: ChatActionData | unknown
  reason?: string
  message?: string
  code?: string
  summary?: string
}

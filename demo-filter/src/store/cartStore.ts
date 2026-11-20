import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getProductById } from '@/lib/catalog'
import type { CartItem, CartLine } from '@/types'

interface CartState {
  items: CartItem[]
  addItem: (productId: number, qty?: number, size?: string) => void
  removeItem: (productId: number, size: string) => void
  setQty: (productId: number, size: string, qty: number) => void
  clear: () => void
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (productId, qty = 1, size) => {
        const product = getProductById(productId)
        if (!product || product.stock <= 0 || qty <= 0) return

        const chosenSize = size ?? product.sizes[0] ?? 'One size'

        set((state) => {
          const existing = state.items.find(
            (item) => item.productId === productId && item.size === chosenSize,
          )
          if (existing) {
            return {
              items: state.items.map((item) =>
                item.productId === productId && item.size === chosenSize
                  ? { ...item, qty: Math.min(product.stock, item.qty + qty) }
                  : item,
              ),
            }
          }
          return {
            items: [
              ...state.items,
              { productId, qty: Math.min(product.stock, qty), size: chosenSize },
            ],
          }
        })
      },

      removeItem: (productId, size) => {
        set((state) => ({
          items: state.items.filter(
            (item) => !(item.productId === productId && item.size === size),
          ),
        }))
      },

      setQty: (productId, size, qty) => {
        const product = getProductById(productId)
        if (!product) return
        if (qty <= 0) {
          get().removeItem(productId, size)
          return
        }
        set((state) => ({
          items: state.items.map((item) =>
            item.productId === productId && item.size === size
              ? { ...item, qty: Math.min(product.stock, qty) }
              : item,
          ),
        }))
      },

      clear: () => set({ items: [] }),
    }),
    {
      name: 'northline.cart.v1',
      version: 2,
      partialize: (state) => ({ items: state.items }),
      migrate: (persisted) => {
        const state = persisted as { items?: CartItem[] }
        return {
          items: (state.items ?? []).map((item) => ({
            ...item,
            size: item.size ?? 'One size',
          })),
        }
      },
    },
  ),
)

export function getCartLines(items: CartItem[]): CartLine[] {
  return items.flatMap((item) => {
    const product = getProductById(item.productId)
    if (!product) return []
    return [
      {
        ...item,
        product,
        lineTotal: Math.round(product.price * item.qty * 100) / 100,
      },
    ]
  })
}

export function getCartCount(items: CartItem[]): number {
  return items.reduce((total, item) => total + item.qty, 0)
}

export function getCartSubtotal(items: CartItem[]): number {
  const total = items.reduce((sum, item) => {
    const product = getProductById(item.productId)
    return sum + (product ? product.price * item.qty : 0)
  }, 0)
  return Math.round(total * 100) / 100
}

export const FREE_SHIPPING_THRESHOLD = 75
export const SHIPPING_FEE = 6.95
export const TAX_RATE = 0.08

export function getCartTotals(items: CartItem[]) {
  const subtotal = getCartSubtotal(items)
  const shipping =
    subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE
  const tax = Math.round(subtotal * TAX_RATE * 100) / 100
  const total = Math.round((subtotal + shipping + tax) * 100) / 100
  return { subtotal, shipping, tax, total }
}

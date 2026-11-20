import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getProductById } from '@/lib/catalog'
import { getCartTotals } from '@/store/cartStore'
import type { CartItem, Customer, Order, OrderItem } from '@/types'

interface OrderState {
  orders: Order[]
  createOrder: (customer: Customer, items: CartItem[]) => Order | null
}

function makeOrderId(): string {
  return `NL-${Date.now().toString(36).slice(-5).toUpperCase()}${Math.floor(
    Math.random() * 90 + 10,
  )}`
}

export const useOrderStore = create<OrderState>()(
  persist(
    (set) => ({
      orders: [],

      createOrder: (customer, items) => {
        const orderItems: OrderItem[] = items.flatMap((item) => {
          const product = getProductById(item.productId)
          if (!product) return []
          return [
            {
              productId: product.id,
              name: product.name,
              image: product.image,
              price: product.price,
              qty: item.qty,
              size: item.size,
            },
          ]
        })
        if (orderItems.length === 0) return null

        const totals = getCartTotals(items)
        const order: Order = {
          id: makeOrderId(),
          createdAt: Date.now(),
          customer,
          items: orderItems,
          ...totals,
        }

        set((state) => ({ orders: [order, ...state.orders].slice(0, 25) }))
        return order
      },
    }),
    {
      name: 'northline.orders.v1',
      version: 1,
      partialize: (state) => ({ orders: state.orders }),
    },
  ),
)

export function findOrder(orders: Order[], id: string | undefined): Order | undefined {
  if (!id) return undefined
  return orders.find((order) => order.id === id)
}

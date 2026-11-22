import { useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { EMPIRICAL_WEB_ORIGIN } from '@/lib/empirical'
import { getProductById } from '@/lib/catalog'
import {
  DEFAULT_FILTERS,
  inferCategoryFromQuery,
  isColor,
  normalizeCategory,
  toSearchParams,
} from '@/lib/filters'
import { formatPrice } from '@/lib/utils'
import { useCartStore } from '@/store/cartStore'
import { useUiStore } from '@/store/uiStore'
import type {
  EmpiricalResponsePayload,
  CatalogFilters,
  ChatActionData,
  ChatFilterPayload,
} from '@/types'

interface ChatMessage {
  source?: string
  type?: string
  payload?: unknown
}

function numeric(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function chatFiltersToCatalog(filters: ChatFilterPayload | undefined): CatalogFilters {
  const next: CatalogFilters = { ...DEFAULT_FILTERS }
  if (!filters) return next

  const query = typeof filters.query === 'string' ? filters.query.trim() : ''
  if (query && query !== '*' && query.toLowerCase() !== 'all') {
    next.query = query
  }
  const inferredCategory = inferCategoryFromQuery(query)
  const explicitCategory =
    typeof filters.category === 'string' ? normalizeCategory(filters.category) : null
  if (inferredCategory) {
    next.category = inferredCategory
  } else if (explicitCategory) {
    next.category = explicitCategory
  }
  if (typeof filters.color === 'string' && isColor(filters.color)) {
    next.color = filters.color
  }
  const maxPrice = numeric(filters.max_price)
  if (maxPrice !== null && maxPrice > 0) next.maxPrice = maxPrice
  return next
}

function describeFilters(filters: CatalogFilters): string {
  const parts: string[] = []
  if (filters.query) parts.push(`“${filters.query}”`)
  if (filters.category !== 'all') parts.push(filters.category.replace('tshirt', 't-shirt'))
  if (filters.color !== 'all') parts.push(filters.color)
  if (filters.maxPrice !== null) parts.push(`under ${formatPrice(filters.maxPrice)}`)
  return parts.length > 0 ? parts.join(' · ') : 'all products'
}

export function useEmpiricalBridge() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const readyRef = useRef(false)
  const pendingPromptRef = useRef<string | null>(null)
  const navigate = useNavigate()

  const postToChat = useCallback((type: string, payload?: unknown) => {
    const target = iframeRef.current?.contentWindow
    if (!target) return
    target.postMessage(
      { source: 'northline-store', type, payload },
      EMPIRICAL_WEB_ORIGIN,
    )
  }, [])

  const handleAction = useCallback(
    (response: EmpiricalResponsePayload) => {
      const ui = useUiStore.getState()
      const cart = useCartStore.getState()

      if (response.status === 'needs_confirmation') {
        ui.showToast({
          tone: 'info',
          title: 'Confirm in the chat',
          message: response.summary ?? 'This action needs confirmation in the chat.',
        })
        return
      }

      if (response.status === 'no_action') {
        ui.showToast({
          tone: 'info',
          title: 'No storefront action',
          message:
            response.reason ??
            'Try naming a product, color, size, or budget more explicitly.',
        })
        return
      }

      if (response.status === 'error') {
        ui.showToast({
          tone: 'error',
          title: 'Assistant error',
          message:
            response.message ??
            response.code?.replaceAll('_', ' ') ??
            'The chat request failed.',
        })
        return
      }

      if (response.status !== 'ok') return

      const data =
        response.data && typeof response.data === 'object'
          ? (response.data as ChatActionData)
          : ({} as ChatActionData)
      const action = data.action ?? response.tool

      switch (action) {
        case 'search_products': {
          const filters = chatFiltersToCatalog(data.filters)
          const params = toSearchParams(filters)
          navigate({ pathname: '/', search: params.toString() })
          const count = numeric(data.count) ?? 0
          ui.showToast({
            tone: count > 0 ? 'success' : 'info',
            title:
              count > 0
                ? `Showing ${count} product${count === 1 ? '' : 's'}`
                : 'No products matched',
            message: describeFilters(filters),
          })
          window.setTimeout(() => {
            document
              .getElementById('catalog')
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }, 250)
          break
        }

        case 'add_to_cart': {
          const productId = numeric(data.product_id)
          const product = productId ? getProductById(productId) : undefined
          if (!product) {
            ui.showToast({
              tone: 'error',
              title: 'Product not found',
              message: 'The assistant picked a product that is not in this demo catalog.',
            })
            break
          }
          if (product.stock <= 0) {
            ui.showToast({
              tone: 'error',
              title: 'Sold out',
              message: `${product.name} is currently out of stock.`,
            })
            break
          }
          const qty = Math.max(1, numeric(data.qty) ?? 1)
          cart.addItem(product.id, qty)
          ui.openCart()
          ui.showToast({
            tone: 'success',
            title: 'Added to cart',
            message: `${product.name} · ${formatPrice(product.price)}`,
          })
          break
        }

        case 'remove_from_cart': {
          const productId = numeric(data.product_id)
          if (!productId) break
          const matches = cart.items.filter((item) => item.productId === productId)
          if (matches.length === 0) {
            ui.showToast({
              tone: 'info',
              title: 'Not in your cart',
              message: 'That product is not currently in the cart.',
            })
            break
          }
          matches.forEach((item) => cart.removeItem(item.productId, item.size))
          ui.showToast({
            tone: 'success',
            title: 'Removed from cart',
            message: typeof data.name === 'string' ? data.name : 'Item removed.',
          })
          break
        }

        case 'empty_cart': {
          cart.clear()
          ui.showToast({
            tone: 'success',
            title: 'Cart emptied',
            message: 'All items were removed from your cart.',
          })
          break
        }

        case 'open_product': {
          const productId = numeric(data.product_id)
          if (!productId) break
          ui.closeChat()
          navigate(`/product/${productId}`)
          break
        }

        case 'navigate': {
          const page = typeof data.page === 'string' ? data.page : 'home'
          ui.closeChat()
          if (page === 'cart') {
            ui.openCart()
          } else if (page === 'checkout') {
            navigate('/checkout')
          } else {
            navigate('/')
          }
          break
        }

        default: {
          if (response.result) {
            ui.showToast({
              tone: 'success',
              title: 'Assistant',
              message: response.result,
            })
          }
        }
      }
    },
    [navigate],
  )

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== EMPIRICAL_WEB_ORIGIN) return
      if (event.source !== iframeRef.current?.contentWindow) return

      const message = event.data as ChatMessage | null
      if (!message || message.source !== 'empirical-web') return

      if (message.type === 'ready') {
        readyRef.current = true
        useUiStore.getState().setChatReady(true)
        const pending = pendingPromptRef.current
        if (pending) {
          pendingPromptRef.current = null
          window.setTimeout(() => postToChat('prompt', { text: pending }), 120)
        }
        return
      }

      if (message.type === 'health') {
        const payload = message.payload as { ok?: boolean } | undefined
        useUiStore.getState().setChatHealthy(Boolean(payload?.ok))
        return
      }

      if (message.type === 'response') {
        handleAction((message.payload ?? {}) as EmpiricalResponsePayload)
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [handleAction, postToChat])

  const promptChat = useCallback(
    (text: string) => {
      const ui = useUiStore.getState()
      ui.openChat()
      if (readyRef.current) {
        postToChat('prompt', { text })
      } else {
        pendingPromptRef.current = text
      }
    },
    [postToChat],
  )

  const onIframeLoad = useCallback(() => {
    postToChat('ping')
    if (readyRef.current && pendingPromptRef.current) {
      const pending = pendingPromptRef.current
      pendingPromptRef.current = null
      postToChat('prompt', { text: pending })
    }
  }, [postToChat])

  return { iframeRef, promptChat, onIframeLoad }
}

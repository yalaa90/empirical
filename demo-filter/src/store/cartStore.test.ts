import { beforeEach, describe, expect, it } from 'vitest'
import { useCartStore } from './cartStore'

describe('emptying the cart', () => {
  beforeEach(() => {
    useCartStore.setState({
      items: [
        { productId: 1, qty: 2, size: 'M' },
        { productId: 7, qty: 1, size: 'L' },
      ],
    })
  })

  it('removes every line with clear()', () => {
    expect(useCartStore.getState().items).toHaveLength(2)

    useCartStore.getState().clear()

    expect(useCartStore.getState().items).toEqual([])
  })

  it('removes only the selected line with removeItem()', () => {
    useCartStore.getState().removeItem(1, 'M')

    expect(useCartStore.getState().items).toEqual([
      { productId: 7, qty: 1, size: 'L' },
    ])
  })
})

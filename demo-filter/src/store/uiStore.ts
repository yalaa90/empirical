import { create } from 'zustand'

export type ToastTone = 'success' | 'info' | 'error'

export interface ToastMessage {
  id: number
  title: string
  message?: string
  tone: ToastTone
}

interface UiState {
  cartOpen: boolean
  chatOpen: boolean
  chatReady: boolean
  chatHealthy: boolean
  toast: ToastMessage | null
  openCart: () => void
  closeCart: () => void
  toggleCart: () => void
  openChat: () => void
  closeChat: () => void
  setChatReady: (ready: boolean) => void
  setChatHealthy: (healthy: boolean) => void
  showToast: (input: Omit<ToastMessage, 'id'>) => void
  clearToast: () => void
}

let toastId = 0

export const useUiStore = create<UiState>()((set) => ({
  cartOpen: false,
  chatOpen: false,
  chatReady: false,
  chatHealthy: false,
  toast: null,

  openCart: () => set({ cartOpen: true }),
  closeCart: () => set({ cartOpen: false }),
  toggleCart: () => set((state) => ({ cartOpen: !state.cartOpen })),
  openChat: () => set({ chatOpen: true }),
  closeChat: () => set({ chatOpen: false }),
  setChatReady: (chatReady) => set({ chatReady }),
  setChatHealthy: (chatHealthy) => set({ chatHealthy }),
  showToast: (input) =>
    set({
      toast: {
        ...input,
        id: ++toastId,
      },
    }),
  clearToast: () => set({ toast: null }),
}))

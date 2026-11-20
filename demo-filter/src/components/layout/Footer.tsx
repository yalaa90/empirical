import { Link } from 'react-router-dom'
import { Code2, MessageCircle } from 'lucide-react'
import { useUiStore } from '@/store/uiStore'

export function Footer() {
  const openChat = useUiStore((state) => state.openChat)

  return (
    <footer className="mt-20 border-t border-stone-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-900 text-sm font-black text-amber-300">
              N
            </span>
            <span className="text-sm font-black tracking-[0.18em] text-stone-950">
              NORTHLINE
            </span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-6 text-stone-500">
            A demo storefront with 100 sample products, a working cart, and a
            chat assistant powered by Empirical. No real orders or payments are
            processed.
          </p>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-400">
            Shop
          </h3>
          <ul className="mt-4 space-y-2.5 text-sm text-stone-600">
            <li>
              <Link to="/?category=tshirt" className="hover:text-stone-950">
                T-Shirts
              </Link>
            </li>
            <li>
              <Link to="/?category=hoodie" className="hover:text-stone-950">
                Hoodies
              </Link>
            </li>
            <li>
              <Link to="/?category=shoes" className="hover:text-stone-950">
                Shoes
              </Link>
            </li>
            <li>
              <Link to="/?category=accessory" className="hover:text-stone-950">
                Accessories
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-400">
            Assistant
          </h3>
          <p className="mt-4 text-sm leading-6 text-stone-500">
            Ask for products in plain English, add them to your cart, and move
            through checkout.
          </p>
          <button
            type="button"
            onClick={openChat}
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-stone-300 px-4 py-2 text-xs font-semibold text-stone-700 transition-colors hover:border-stone-400 hover:text-stone-950"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Open Empirical chat
          </button>
        </div>
      </div>

      <div className="border-t border-stone-200">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-2 px-4 py-5 text-xs text-stone-400 sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <span>Northline Supply Co. — demo only.</span>
          <span className="inline-flex items-center gap-1.5">
            <Code2 className="h-3.5 w-3.5" />
            Built with React, Vite, and Empirical
          </span>
        </div>
      </div>
    </footer>
  )
}

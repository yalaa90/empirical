import { useEffect } from 'react'
import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import { CartDrawer } from '@/components/cart/CartDrawer'
import { ChatLauncher } from '@/components/chat/ChatLauncher'
import { Footer } from '@/components/layout/Footer'
import { Header } from '@/components/layout/Header'
import { ToastViewport } from '@/components/ui/Toast'
import { CheckoutPage } from '@/pages/CheckoutPage'
import { HomePage } from '@/pages/HomePage'
import { OrderPage } from '@/pages/OrderPage'
import { ProductPage } from '@/pages/ProductPage'

function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [pathname])

  return null
}

function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-[55vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-600">
        404
      </p>
      <h1 className="mt-2 text-3xl font-extrabold text-stone-950">
        This aisle does not exist
      </h1>
      <p className="mt-2 text-sm text-stone-500">
        The page you were looking for is not part of this demo store.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex h-11 items-center rounded-full bg-stone-900 px-6 text-sm font-semibold text-white hover:bg-stone-800"
      >
        Back to the catalog
      </Link>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <div className="flex min-h-screen flex-col bg-stone-50">
        <Header />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/product/:id" element={<ProductPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/order/:id" element={<OrderPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
      <CartDrawer />
      <ChatLauncher />
      <ToastViewport />
    </BrowserRouter>
  )
}

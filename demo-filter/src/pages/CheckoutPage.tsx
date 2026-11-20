import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Lock, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ProductImage } from '@/components/catalog/ProductImage'
import {
  getCartLines,
  getCartTotals,
  useCartStore,
} from '@/store/cartStore'
import { useOrderStore } from '@/store/orderStore'
import { useUiStore } from '@/store/uiStore'
import { formatPrice } from '@/lib/utils'
import type { Customer } from '@/types'

const EMPTY_CUSTOMER: Customer = {
  name: '',
  email: '',
  address: '',
  city: '',
  postalCode: '',
  country: 'United States',
}

type Errors = Partial<Record<keyof Customer, string>>

export function CheckoutPage() {
  const navigate = useNavigate()
  const items = useCartStore((state) => state.items)
  const clearCart = useCartStore((state) => state.clear)
  const createOrder = useOrderStore((state) => state.createOrder)
  const showToast = useUiStore((state) => state.showToast)

  const [customer, setCustomer] = useState<Customer>(EMPTY_CUSTOMER)
  const [errors, setErrors] = useState<Errors>({})

  const lines = getCartLines(items)
  const totals = getCartTotals(items)

  if (lines.length === 0) {
    return (
      <div className="mx-auto flex min-h-[55vh] max-w-xl flex-col items-center justify-center px-4 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-stone-100 text-stone-400">
          <ShoppingBag className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-3xl font-extrabold text-stone-950">
          Your cart is empty
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          Add something to your cart before checking out.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex h-11 items-center rounded-full bg-stone-900 px-6 text-sm font-semibold text-white hover:bg-stone-800"
        >
          Browse products
        </Link>
      </div>
    )
  }

  const setField = (field: keyof Customer, value: string) => {
    setCustomer((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const validate = (): boolean => {
    const next: Errors = {}
    if (!customer.name.trim()) next.name = 'Enter your full name.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim())) {
      next.email = 'Enter a valid email address.'
    }
    if (!customer.address.trim()) next.address = 'Enter a street address.'
    if (!customer.city.trim()) next.city = 'Enter a city.'
    if (!customer.postalCode.trim()) next.postalCode = 'Enter a postal code.'
    if (!customer.country.trim()) next.country = 'Enter a country.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!validate()) return

    const order = createOrder(customer, items)
    if (!order) {
      showToast({
        tone: 'error',
        title: 'Could not create the order',
        message: 'Please review your cart and try again.',
      })
      return
    }

    clearCart()
    navigate(`/order/${order.id}`)
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Continue shopping
      </Link>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-600">
            Checkout
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-stone-950 sm:text-4xl">
            Almost yours
          </h1>
        </div>
        <p className="inline-flex items-center gap-1.5 text-xs text-stone-500">
          <Lock className="h-3.5 w-3.5" />
          Demo checkout — no payment is processed
        </p>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
        <form onSubmit={submit} noValidate className="space-y-6">
          <section className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-6">
            <h2 className="text-lg font-bold text-stone-950">Contact</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field
                label="Full name"
                value={customer.name}
                error={errors.name}
                autoComplete="name"
                onChange={(value) => setField('name', value)}
              />
              <Field
                label="Email"
                type="email"
                value={customer.email}
                error={errors.email}
                autoComplete="email"
                onChange={(value) => setField('email', value)}
              />
            </div>
          </section>

          <section className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-6">
            <h2 className="text-lg font-bold text-stone-950">Shipping</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field
                  label="Street address"
                  value={customer.address}
                  error={errors.address}
                  autoComplete="street-address"
                  onChange={(value) => setField('address', value)}
                />
              </div>
              <Field
                label="City"
                value={customer.city}
                error={errors.city}
                autoComplete="address-level2"
                onChange={(value) => setField('city', value)}
              />
              <Field
                label="Postal code"
                value={customer.postalCode}
                error={errors.postalCode}
                autoComplete="postal-code"
                onChange={(value) => setField('postalCode', value)}
              />
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-stone-700">
                  Country
                  <select
                    value={customer.country}
                    onChange={(event) => setField('country', event.target.value)}
                    className="mt-1.5 h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10"
                  >
                    <option>United States</option>
                    <option>Canada</option>
                    <option>United Kingdom</option>
                    <option>Germany</option>
                    <option>Egypt</option>
                    <option>United Arab Emirates</option>
                  </select>
                </label>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-6">
            <h2 className="text-lg font-bold text-stone-950">Delivery</h2>
            <div className="mt-3 flex items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-stone-900">
                <span className="h-2 w-2 rounded-full bg-stone-900" />
              </span>
              <div>
                <p className="text-sm font-semibold text-stone-900">
                  Standard delivery
                </p>
                <p className="mt-0.5 text-xs text-stone-500">
                  3–5 business days. Free over $75, otherwise $6.95.
                </p>
              </div>
            </div>
          </section>

          <Button type="submit" size="lg" className="w-full">
            Place demo order · {formatPrice(totals.total)}
          </Button>
          <p className="text-center text-[11px] text-stone-400">
            No card details are collected. This is a demo checkout.
          </p>
        </form>

        <aside className="h-fit rounded-3xl border border-stone-200 bg-white p-5 sm:p-6 lg:sticky lg:top-24">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-stone-950">Order summary</h2>
            <span className="text-xs text-stone-500">
              {lines.reduce((count, line) => count + line.qty, 0)} items
            </span>
          </div>

          <ul className="mt-4 space-y-3">
            {lines.map((line) => (
              <li
                key={`${line.productId}-${line.size}`}
                className="flex items-center gap-3"
              >
                <ProductImage
                  product={line.product}
                  className="h-16 w-14 shrink-0 rounded-xl"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-stone-900">
                    {line.product.name}
                  </p>
                  <p className="mt-0.5 text-xs text-stone-500">
                    Size {line.size} · Qty {line.qty}
                  </p>
                </div>
                <span className="text-sm font-semibold text-stone-900">
                  {formatPrice(line.lineTotal)}
                </span>
              </li>
            ))}
          </ul>

          <dl className="mt-5 space-y-2 border-t border-stone-200 pt-4 text-sm">
            <div className="flex justify-between text-stone-500">
              <dt>Subtotal</dt>
              <dd className="font-medium text-stone-900">
                {formatPrice(totals.subtotal)}
              </dd>
            </div>
            <div className="flex justify-between text-stone-500">
              <dt>Shipping</dt>
              <dd className="font-medium text-stone-900">
                {totals.shipping === 0 ? 'Free' : formatPrice(totals.shipping)}
              </dd>
            </div>
            <div className="flex justify-between text-stone-500">
              <dt>Tax</dt>
              <dd className="font-medium text-stone-900">
                {formatPrice(totals.tax)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-stone-200 pt-3 text-base font-bold text-stone-950">
              <dt>Total</dt>
              <dd>{formatPrice(totals.total)}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  )
}

interface FieldProps {
  label: string
  value: string
  error?: string
  type?: string
  autoComplete?: string
  onChange: (value: string) => void
}

function Field({
  label,
  value,
  error,
  type = 'text',
  autoComplete,
  onChange,
}: FieldProps) {
  return (
    <label className="block text-xs font-semibold text-stone-700">
      {label}
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        className={
          error
            ? 'mt-1.5 h-11 w-full rounded-xl border border-red-400 bg-red-50/40 px-3 text-sm outline-none ring-2 ring-red-500/10'
            : 'mt-1.5 h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10'
        }
      />
      {error && <span className="mt-1 block text-[11px] text-red-600">{error}</span>}
    </label>
  )
}

import { Link, useParams } from 'react-router-dom'
import { CheckCircle2, PackageCheck } from 'lucide-react'
import { ProductImage } from '@/components/catalog/ProductImage'
import { findOrder, useOrderStore } from '@/store/orderStore'
import { getProductById } from '@/lib/catalog'
import { formatDate, formatPrice } from '@/lib/utils'

export function OrderPage() {
  const { id } = useParams()
  const orders = useOrderStore((state) => state.orders)
  const order = findOrder(orders, id)

  if (!order) {
    return (
      <div className="mx-auto flex min-h-[55vh] max-w-xl flex-col items-center justify-center px-4 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-stone-100 text-stone-400">
          <PackageCheck className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-3xl font-extrabold text-stone-950">
          Order not found
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          Demo orders are stored in this browser only. The order may have been
          cleared.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex h-11 items-center rounded-full bg-stone-900 px-6 text-sm font-semibold text-white hover:bg-stone-800"
        >
          Back to the store
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="rounded-[2rem] border border-emerald-200 bg-emerald-50/70 p-6 text-center sm:p-10">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/25">
          <CheckCircle2 className="h-8 w-8" />
        </span>
        <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">
          Order confirmed
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-stone-950 sm:text-4xl">
          Thanks, {order.customer.name.split(' ')[0]}.
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-stone-600">
          This is a demo order, so nothing will ship. Your order number is{' '}
          <span className="font-mono font-bold text-stone-900">{order.id}</span>.
        </p>
        <p className="mt-1 text-xs text-stone-500">
          Placed {formatDate(order.createdAt)}
        </p>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-stone-400">
            Items
          </h2>
          <ul className="mt-4 space-y-4">
            {order.items.map((item) => {
              const product = getProductById(item.productId)
              return (
                <li key={`${item.productId}-${item.size}`} className="flex items-center gap-3">
                  {product ? (
                    <ProductImage
                      product={product}
                      className="h-20 w-16 shrink-0 rounded-xl"
                    />
                  ) : (
                    <div className="h-20 w-16 shrink-0 rounded-xl bg-stone-100" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-stone-900">
                      {item.name}
                    </p>
                    <p className="mt-0.5 text-xs text-stone-500">
                      Size {item.size} · Qty {item.qty}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-stone-900">
                    {formatPrice(item.price * item.qty)}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>

        <div className="space-y-6">
          <section className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-stone-400">
              Summary
            </h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between text-stone-500">
                <dt>Subtotal</dt>
                <dd className="font-medium text-stone-900">
                  {formatPrice(order.subtotal)}
                </dd>
              </div>
              <div className="flex justify-between text-stone-500">
                <dt>Shipping</dt>
                <dd className="font-medium text-stone-900">
                  {order.shipping === 0 ? 'Free' : formatPrice(order.shipping)}
                </dd>
              </div>
              <div className="flex justify-between text-stone-500">
                <dt>Tax</dt>
                <dd className="font-medium text-stone-900">
                  {formatPrice(order.tax)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-stone-200 pt-2 text-base font-bold text-stone-950">
                <dt>Total</dt>
                <dd>{formatPrice(order.total)}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-stone-400">
              Shipping to
            </h2>
            <address className="mt-3 text-sm not-italic leading-6 text-stone-600">
              <span className="font-semibold text-stone-900">
                {order.customer.name}
              </span>
              <br />
              {order.customer.address}
              <br />
              {order.customer.city}, {order.customer.postalCode}
              <br />
              {order.customer.country}
              <br />
              {order.customer.email}
            </address>
          </section>
        </div>
      </div>

      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link
          to="/"
          className="inline-flex h-11 items-center rounded-full bg-stone-900 px-6 text-sm font-semibold text-white hover:bg-stone-800"
        >
          Continue shopping
        </Link>
        <Link
          to="/?category=accessory"
          className="inline-flex h-11 items-center rounded-full border border-stone-300 bg-white px-6 text-sm font-semibold text-stone-700 hover:border-stone-400"
        >
          Browse accessories
        </Link>
      </div>
    </div>
  )
}

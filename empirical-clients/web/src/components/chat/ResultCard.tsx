import { getItems } from '@/lib/response'
import { compactJson } from '@/lib/utils'

export function ResultCard({ data }: { data: unknown }) {
  const items = getItems(data)

  if (items) {
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-card text-sm shadow-sm">
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Inventory
          </span>
          <span className="text-xs text-muted-foreground">
            {items.length} item{items.length === 1 ? '' : 's'}
          </span>
        </div>
        {items.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">
            No items found.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                      {item.id}
                    </td>
                    <td className="px-3 py-2">{item.name}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {item.qty}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  if (!data || typeof data !== 'object') return null

  const record = data as Record<string, unknown>
  const entries = Object.entries(record).filter(
    ([, value]) =>
      value === null ||
      ['string', 'number', 'boolean'].includes(typeof value),
  )

  return (
    <div className="space-y-2">
      {entries.length > 0 && (
        <div className="grid gap-1 rounded-xl border border-border bg-muted/30 p-3 text-sm sm:grid-cols-2">
          {entries.map(([key, value]) => (
            <div key={key} className="flex items-baseline justify-between gap-3">
              <span className="text-xs text-muted-foreground">{key}</span>
              <span className="truncate font-mono text-xs">
                {String(value)}
              </span>
            </div>
          ))}
        </div>
      )}
      <details className="group rounded-lg border border-border/70 bg-muted/20">
        <summary className="cursor-pointer list-none px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground">
          Raw data
        </summary>
        <pre className="max-h-64 overflow-auto border-t border-border/70 p-3 text-[11px] leading-5 text-muted-foreground">
          {compactJson(data)}
        </pre>
      </details>
    </div>
  )
}

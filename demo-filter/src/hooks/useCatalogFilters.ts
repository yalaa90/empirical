import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  parseFilters,
  toSearchParams,
} from '@/lib/filters'
import type { CatalogFilters } from '@/types'

export function useCatalogFilters() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo(() => parseFilters(searchParams), [searchParams])

  const update = useCallback(
    (patch: Partial<CatalogFilters>, options?: { replace?: boolean }) => {
      const current = parseFilters(searchParams)
      const next = { ...current, ...patch }
      setSearchParams(toSearchParams(next), {
        replace: options?.replace ?? false,
        preventScrollReset: true,
      })
    },
    [searchParams, setSearchParams],
  )

  const reset = useCallback(() => {
    setSearchParams(new URLSearchParams(), { preventScrollReset: true })
  }, [setSearchParams])

  return { filters, update, reset }
}

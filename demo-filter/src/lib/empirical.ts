const configuredUrl =
  import.meta.env.VITE_EMPIRICAL_WEB_URL?.trim() || 'http://localhost:5175'

export const EMPIRICAL_WEB_URL = configuredUrl.replace(/\/+$/, '')

function originOf(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return url
  }
}

export const EMPIRICAL_WEB_ORIGIN = (
  import.meta.env.VITE_EMPIRICAL_WEB_ORIGIN?.trim() || originOf(EMPIRICAL_WEB_URL)
).replace(/\/+$/, '')

export function storefrontOrigin(): string {
  return (
    import.meta.env.VITE_STOREFRONT_ORIGIN?.trim() ||
    window.location.origin
  )
}

export function empiricalEmbedUrl(): string {
  const url = new URL(EMPIRICAL_WEB_URL)
  url.searchParams.set('embed', '1')
  url.searchParams.set('hostOrigin', storefrontOrigin())
  return url.toString()
}

export function empiricalNewTabUrl(): string {
  const url = new URL(EMPIRICAL_WEB_URL)
  url.searchParams.set('hostOrigin', storefrontOrigin())
  return url.toString()
}

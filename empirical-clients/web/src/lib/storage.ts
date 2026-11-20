const TOKEN_KEY = 'empirical.token'

export function getToken(): string {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setToken(token: string): void {
  try {
    if (token.trim()) sessionStorage.setItem(TOKEN_KEY, token.trim())
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    return
  }
}

export function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return '/api'
  return trimmed.replace(/\/+$/, '')
}

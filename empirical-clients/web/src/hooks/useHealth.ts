import { useCallback, useEffect, useState } from 'react'
import { fetchHealth } from '@/api/client'
import { getToken } from '@/lib/storage'
import { useChatStore } from '@/store/chatStore'
import type { HealthState } from '@/types'

const INITIAL: HealthState = {
  reachable: false,
  ok: false,
  status: 'checking',
}

export function useHealth() {
  const apiBaseUrl = useChatStore((state) => state.settings.apiBaseUrl)
  const [health, setHealth] = useState<HealthState>(INITIAL)

  const refresh = useCallback(async () => {
    const result = await fetchHealth({
      baseUrl: apiBaseUrl,
      token: getToken(),
    })
    setHealth(result)
  }, [apiBaseUrl])

  useEffect(() => {
    let active = true
    setHealth(INITIAL)

    const check = async () => {
      const result = await fetchHealth({
        baseUrl: apiBaseUrl,
        token: getToken(),
      })
      if (active) setHealth(result)
    }

    void check()
    const interval = window.setInterval(check, 30_000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [apiBaseUrl])

  return { health, refresh }
}

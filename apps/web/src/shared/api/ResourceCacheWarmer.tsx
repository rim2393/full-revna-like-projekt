import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthSession } from '../../features/auth/authSession'
import { useApiClient } from './apiClientContext'
import { resourceQueryKeys } from './resourceHooks'

const WARM_STALE_TIME_MS = 5 * 60_000

export function ResourceCacheWarmer() {
  const apiClient = useApiClient()
  const queryClient = useQueryClient()
  const { session, status } = useAuthSession()
  const warmedSessionRef = useRef<string | null>(null)

  useEffect(() => {
    if (status !== 'authenticated' || !session?.userId) {
      warmedSessionRef.current = null
      return
    }

    if (warmedSessionRef.current === session.userId) {
      return
    }

    warmedSessionRef.current = session.userId
    let cancelled = false

    const prefetch = (entries: Array<{ queryFn: () => Promise<unknown>; queryKey: readonly unknown[] }>) =>
      Promise.allSettled(
        entries.map((entry) =>
          queryClient.prefetchQuery({
            queryFn: entry.queryFn,
            queryKey: entry.queryKey,
            staleTime: WARM_STALE_TIME_MS,
          }),
        ),
      )

    const warmSecondary = () => {
      if (cancelled) {
        return
      }

      void prefetch([
        { queryFn: apiClient.listUsers, queryKey: resourceQueryKeys.users },
        { queryFn: apiClient.listSubscriptions, queryKey: resourceQueryKeys.subscriptions },
        { queryFn: apiClient.listSettingGroups, queryKey: resourceQueryKeys.settingGroups },
        { queryFn: apiClient.listSubscriptionPageConfigs, queryKey: resourceQueryKeys.subscriptionPageConfigs },
        { queryFn: apiClient.listSubscriptionTemplates, queryKey: resourceQueryKeys.subscriptionTemplates },
        { queryFn: apiClient.listResponseRules, queryKey: resourceQueryKeys.responseRules },
      ])
    }

    void prefetch([
      { queryFn: apiClient.readPanelIdentity, queryKey: resourceQueryKeys.panelIdentity },
      { queryFn: apiClient.listNodes, queryKey: resourceQueryKeys.nodes },
      { queryFn: apiClient.listProfiles, queryKey: resourceQueryKeys.profiles },
      { queryFn: apiClient.listHosts, queryKey: resourceQueryKeys.hosts },
      { queryFn: apiClient.listSquads, queryKey: resourceQueryKeys.squads },
      { queryFn: apiClient.listProtocolAdapters, queryKey: resourceQueryKeys.protocolAdapters },
    ])

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(warmSecondary, { timeout: 1200 })
      return () => {
        cancelled = true
        window.cancelIdleCallback(idleId)
      }
    }

    const timeoutId = globalThis.setTimeout(warmSecondary, 250)
    return () => {
      cancelled = true
      globalThis.clearTimeout(timeoutId)
    }
  }, [apiClient, queryClient, session?.userId, status])

  return null
}

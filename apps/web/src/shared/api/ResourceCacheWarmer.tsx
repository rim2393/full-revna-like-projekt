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

    const warm = () => {
      if (cancelled) {
        return
      }

      void Promise.allSettled([
        queryClient.prefetchQuery({
          queryFn: apiClient.readPanelIdentity,
          queryKey: resourceQueryKeys.panelIdentity,
          staleTime: WARM_STALE_TIME_MS,
        }),
        queryClient.prefetchQuery({
          queryFn: apiClient.listNodes,
          queryKey: resourceQueryKeys.nodes,
          staleTime: WARM_STALE_TIME_MS,
        }),
        queryClient.prefetchQuery({
          queryFn: apiClient.listProfiles,
          queryKey: resourceQueryKeys.profiles,
          staleTime: WARM_STALE_TIME_MS,
        }),
        queryClient.prefetchQuery({
          queryFn: apiClient.listHosts,
          queryKey: resourceQueryKeys.hosts,
          staleTime: WARM_STALE_TIME_MS,
        }),
        queryClient.prefetchQuery({
          queryFn: apiClient.listSquads,
          queryKey: resourceQueryKeys.squads,
          staleTime: WARM_STALE_TIME_MS,
        }),
        queryClient.prefetchQuery({
          queryFn: apiClient.listUsers,
          queryKey: resourceQueryKeys.users,
          staleTime: WARM_STALE_TIME_MS,
        }),
        queryClient.prefetchQuery({
          queryFn: apiClient.listLicenses,
          queryKey: resourceQueryKeys.licenses,
          staleTime: WARM_STALE_TIME_MS,
        }),
        queryClient.prefetchQuery({
          queryFn: apiClient.listSubscriptions,
          queryKey: resourceQueryKeys.subscriptions,
          staleTime: WARM_STALE_TIME_MS,
        }),
        queryClient.prefetchQuery({
          queryFn: apiClient.listSettingGroups,
          queryKey: resourceQueryKeys.settingGroups,
          staleTime: WARM_STALE_TIME_MS,
        }),
        queryClient.prefetchQuery({
          queryFn: apiClient.listSubscriptionPageConfigs,
          queryKey: resourceQueryKeys.subscriptionPageConfigs,
          staleTime: WARM_STALE_TIME_MS,
        }),
        queryClient.prefetchQuery({
          queryFn: apiClient.listSubscriptionTemplates,
          queryKey: resourceQueryKeys.subscriptionTemplates,
          staleTime: WARM_STALE_TIME_MS,
        }),
        queryClient.prefetchQuery({
          queryFn: apiClient.listResponseRules,
          queryKey: resourceQueryKeys.responseRules,
          staleTime: WARM_STALE_TIME_MS,
        }),
        queryClient.prefetchQuery({
          queryFn: apiClient.listProtocolAdapters,
          queryKey: resourceQueryKeys.protocolAdapters,
          staleTime: WARM_STALE_TIME_MS,
        }),
      ])
    }

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(warm, { timeout: 1200 })
      return () => {
        cancelled = true
        window.cancelIdleCallback(idleId)
      }
    }

    const timeoutId = globalThis.setTimeout(warm, 250)
    return () => {
      cancelled = true
      globalThis.clearTimeout(timeoutId)
    }
  }, [apiClient, queryClient, session?.userId, status])

  return null
}

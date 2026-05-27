import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApiClient } from './apiClientContext'
import type { ProvisioningJobCreateRequest } from './types'

export const resourceQueryKeys = {
  apiKeys: ['resource', 'api-keys'] as const,
  license: ['resource', 'license'] as const,
  nodes: ['resource', 'nodes'] as const,
  provisioningJob: (jobId: string) => ['resource', 'nodes', 'provisioning-job', jobId] as const,
  session: ['auth', 'session'] as const,
  users: ['resource', 'users'] as const,
}

export function useApiKeysPageData() {
  const apiClient = useApiClient()

  return useQuery({
    queryFn: apiClient.listApiKeys,
    queryKey: resourceQueryKeys.apiKeys,
  })
}

export function useLicensePageData() {
  const apiClient = useApiClient()

  return useQuery({
    queryFn: apiClient.readLicense,
    queryKey: resourceQueryKeys.license,
  })
}

export function useNodesPageData() {
  const apiClient = useApiClient()

  return useQuery({
    queryFn: apiClient.listNodes,
    queryKey: resourceQueryKeys.nodes,
  })
}

export function useCreateNodeProvisioningJob() {
  const apiClient = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: ProvisioningJobCreateRequest) =>
      apiClient.createProvisioningJob(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: resourceQueryKeys.nodes })
    },
  })
}

export function useUsersPageData() {
  const apiClient = useApiClient()

  return useQuery({
    queryFn: apiClient.listUsers,
    queryKey: resourceQueryKeys.users,
  })
}

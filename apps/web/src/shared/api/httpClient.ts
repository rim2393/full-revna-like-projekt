import type { AuthSession, LumenApiClient, ProvisioningJobCreateRequest } from './types'

type HttpClientOptions = {
  baseUrl: string
  fetcher?: typeof fetch
  getSession: () => AuthSession | null
}

export class LumenApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'LumenApiError'
    this.status = status
  }
}

export function createHttpLumenApiClient({
  baseUrl,
  fetcher = fetch,
  getSession,
}: HttpClientOptions): LumenApiClient {
  async function request<TResponse>(
    path: string,
    options: { body?: unknown; method?: 'GET' | 'POST' } = {},
  ): Promise<TResponse> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Lumen-User': getSession()?.userId ?? 'anonymous',
    }

    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json'
    }

    const response = await fetcher(new URL(path, baseUrl), {
      credentials: 'include',
      headers,
      method: options.method ?? 'GET',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })

    if (!response.ok) {
      let message = `API request failed with status ${response.status}`

      try {
        const payload = (await response.json()) as { error?: { message?: string } }
        message = payload.error?.message ?? message
      } catch {
        // Keep the status-based fallback when the server does not return JSON.
      }

      throw new LumenApiError(message, response.status)
    }

    return (await response.json()) as TResponse
  }

  return {
    createProvisioningJob: (payload: ProvisioningJobCreateRequest) =>
      request('/api/v1/nodes/provisioning-jobs', { body: payload, method: 'POST' }),
    getSession: () => request('/api/auth/session'),
    listApiKeys: () => request('/api/admin/api-keys'),
    listNodes: () => request('/api/v1/nodes'),
    listUsers: () => request('/api/admin/users'),
    readProvisioningJob: (jobId: string) => request(`/api/v1/nodes/provisioning-jobs/${jobId}`),
    readLicense: () => request('/api/admin/license'),
  }
}

import {
  apiKeyRecords,
  hostRecords,
  licenseSummary,
  mockSession,
  nodeRecords,
  profileRecords,
  protocolAdapters,
  settingRecords,
  squadRecords,
  subscriptionRecords,
  userRecords,
} from '../data/lumenData'
import type {
  ApiKeyCreateRequest,
  ApiKeyCreateResponse,
  HostCreateRequest,
  HostListResponse,
  HostRecord,
  LumenApiClient,
  NodeListResponse,
  NodeRecord,
  NodeResponse,
  PortCheckRequest,
  PortCheckResponse,
  ProtocolAdapterListResponse,
  ProtocolProfileCreateRequest,
  ProtocolProfileListResponse,
  ProtocolProfileRecord,
  ProvisioningJobCreateRequest,
  ProvisioningJobResponse,
  ResourceListResponse,
  SettingListResponse,
  SettingRecord,
  SettingUpdateRequest,
  SquadCreateRequest,
  SquadListResponse,
  SquadRecord,
  SubscriptionListResponse,
} from './types'

const generatedAt = '2026-05-27T00:00:00Z'

function asListResponse<TItem>(items: TItem[]): ResourceListResponse<TItem> {
  return {
    generatedAt,
    items,
    source: 'mock',
    total: items.length,
  }
}

function asNodeResponse(node: NodeRecord): NodeResponse {
  return {
    capabilities: {
      active_users: String(node.activeUsers),
      load_percent: String(node.loadPercent),
      transports: node.transports.join(','),
      version: node.version,
    },
    id: node.id,
    last_seen_at: node.lastSeenAt,
    name: node.name,
    public_address: `${node.name}.lumen.local`,
    region: node.region,
    status: node.status === 'healthy' ? 'active' : node.status === 'offline' ? 'offline' : 'failed',
  }
}

function asNodeListResponse(): NodeListResponse {
  return {
    items: nodeRecords.map(asNodeResponse),
  }
}

function buildMockProvisioningJob(
  request: ProvisioningJobCreateRequest,
  jobId = `job_${request.idempotency_key}`,
): ProvisioningJobResponse {
  const now = new Date().toISOString()

  return {
    created_at: now,
    error_code: null,
    error_message: null,
    id: jobId,
    idempotency_key: request.idempotency_key,
    kind: request.kind ?? 'node.provision',
    node_id: `node_${request.node.name}`,
    preflight_result: {},
    preflight_status: 'pending',
    requested_capabilities: request.requested_capabilities,
    ssh_credentials_ref: request.ssh.credentials_ref,
    ssh_host: request.ssh.host,
    ssh_port: request.ssh.port,
    ssh_username: request.ssh.username,
    status: 'queued',
    token_exchanged_at: null,
    token_issued_at: null,
    updated_at: now,
  }
}

export function createMockLumenApiClient(): LumenApiClient {
  const apiKeys = [...apiKeyRecords]
  const hosts = [...hostRecords]
  const profiles = [...profileRecords]
  const settings = [...settingRecords]
  const squads = [...squadRecords]
  const subscriptions = [...subscriptionRecords]

  function updateSettingValue(key: string, request: SettingUpdateRequest): SettingRecord {
    const existing = settings.find((setting) => setting.key === key)
    const next: SettingRecord = {
      id: existing?.id ?? `setting_${key}`,
      key,
      updated_at: new Date().toISOString(),
      updated_by: mockSession.userId,
      value_json: request.value_json,
    }
    if (existing) {
      Object.assign(existing, next)
      return existing
    }
    settings.push(next)
    return next
  }

  return {
    checkPortConflicts: async (request: PortCheckRequest): Promise<PortCheckResponse> => {
      const conflicts = profiles
        .filter((profile) => profile.node_id === request.node_id)
        .flatMap((profile) =>
          request.reservations
            .filter((reservation) =>
              profile.port_reservations.some(
                (existing) =>
                  existing.port === reservation.port &&
                  (existing.protocol ?? 'tcp') === (reservation.protocol ?? 'tcp'),
              ),
            )
            .map((reservation) => ({
              address: reservation.address ?? '0.0.0.0',
              message: `${profile.name} already reserves ${reservation.port}/${reservation.protocol ?? 'tcp'}`,
              port: reservation.port,
              profile_id: profile.id,
              profile_name: profile.name,
              protocol: reservation.protocol ?? 'tcp',
              suggested_port: reservation.port + 1,
            })),
        )
      return { allowed: conflicts.length === 0, conflicts }
    },
    createApiKey: async (request: ApiKeyCreateRequest): Promise<ApiKeyCreateResponse> => {
      const id = `key_${request.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'new'}`
      apiKeys.unshift({
        createdAt: generatedAt.slice(0, 10),
        expiresAt: request.expires_at ?? null,
        fingerprint: `fp_${id.slice(-6).toUpperCase()}`,
        id,
        lastUsedAt: null,
        name: request.name,
        owner: mockSession.name,
        scopes: request.scopes,
        status: 'active',
      })
      return {
        api_key: 'lumen_key_one_time_value',
        expires_at: request.expires_at ?? null,
        id,
        key_prefix: 'lumen_key_mock',
        name: request.name,
      }
    },
    createHost: async (request: HostCreateRequest): Promise<HostRecord> => {
      const host: HostRecord = {
        hostname: request.hostname,
        id: `host_${request.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        name: request.name,
        node_id: request.node_id,
        protocol_profile_id: request.protocol_profile_id ?? null,
        squad_id: request.squad_id ?? null,
        status: request.status ?? 'active',
        tags: request.tags ?? [],
      }
      hosts.unshift(host)
      return host
    },
    createProfile: async (
      request: ProtocolProfileCreateRequest,
    ): Promise<ProtocolProfileRecord> => {
      const profile: ProtocolProfileRecord = {
        adapter: request.adapter,
        config_json: request.config_json ?? {},
        credentials_ref: request.credentials_ref ?? null,
        id: `profile_${request.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        name: request.name,
        node_id: request.node_id,
        port_reservations: request.port_reservations ?? [],
        squad_id: request.squad_id ?? null,
        status: request.status ?? 'active',
      }
      profiles.unshift(profile)
      return profile
    },
    createProvisioningJob: async (request) => buildMockProvisioningJob(request),
    createSquad: async (request: SquadCreateRequest): Promise<SquadRecord> => {
      const squad: SquadRecord = {
        id: `squad_${request.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        kind: request.kind ?? 'internal',
        metadata_json: request.metadata_json ?? {},
        name: request.name,
        status: request.status ?? 'active',
      }
      squads.unshift(squad)
      return squad
    },
    getSession: async () => mockSession,
    listApiKeys: async () => asListResponse(apiKeys),
    listHosts: async (): Promise<HostListResponse> => ({ items: hosts }),
    listNodes: async () => asNodeListResponse(),
    listProfiles: async (): Promise<ProtocolProfileListResponse> => ({ items: profiles }),
    listProtocolAdapters: async (): Promise<ProtocolAdapterListResponse> => ({
      items: protocolAdapters,
    }),
    listSettings: async (): Promise<SettingListResponse> => ({ items: settings }),
    listSquads: async (): Promise<SquadListResponse> => ({ items: squads }),
    listSubscriptions: async (): Promise<SubscriptionListResponse> => ({
      items: subscriptions,
    }),
    listUsers: async () => asListResponse(userRecords),
    login: async () => ({
      challengeToken: 'mock-mfa-challenge',
      expiresAt: '2026-05-27T00:05:00.000Z',
      methods: [
        {
          confirmed_at: '2026-05-27T00:00:00.000Z',
          id: 'mock-mfa-method',
          kind: 'totp',
          label: 'Authenticator',
          last_used_at: null,
          status: 'active',
        },
      ],
    }),
    logout: async () => undefined,
    readProvisioningJob: async (jobId) =>
      buildMockProvisioningJob(
        {
          idempotency_key: jobId.replace(/^job_/, '') || 'mock-job',
          kind: 'node.provision',
          node: {
            name: 'mock-node',
            public_address: 'mock-node.lumen.local',
            region: 'mock',
          },
          requested_capabilities: {},
          ssh: {
            credentials_ref: 'vault://lumen/nodes/mock-node/ssh',
            host: 'mock-node.lumen.local',
            port: 22,
            username: 'root',
          },
        },
        jobId,
      ),
    readLicense: async () => licenseSummary,
    revokeApiKey: async (apiKeyId: string) => {
      const record = apiKeys.find((key) => key.id === apiKeyId)
      if (record) {
        record.status = 'revoked'
      }
    },
    verifyMfaChallenge: async () => ({
      ...mockSession,
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
    }),
    updateSetting: async (key: string, request: SettingUpdateRequest) =>
      updateSettingValue(key, request),
  }
}

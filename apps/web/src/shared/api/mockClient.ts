import {
  apiKeyRecords,
  licenseSummary,
  mockSession,
  nodeRecords,
  userRecords,
} from '../data/lumenData'
import type {
  LumenApiClient,
  NodeListResponse,
  NodeRecord,
  NodeResponse,
  ProvisioningJobCreateRequest,
  ProvisioningJobResponse,
  ResourceListResponse,
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
  return {
    createProvisioningJob: async (request) => buildMockProvisioningJob(request),
    getSession: async () => mockSession,
    listApiKeys: async () => asListResponse(apiKeyRecords),
    listNodes: async () => asNodeListResponse(),
    listUsers: async () => asListResponse(userRecords),
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
  }
}

export type ApiSource = 'api' | 'mock'

export type ResourceListResponse<TItem> = {
  generatedAt: string
  items: TItem[]
  source: ApiSource
  total: number
}

export type AuthSession = {
  email: string
  expiresAt: string
  name: string
  role: 'owner' | 'admin' | 'operator' | 'auditor'
  scopes: string[]
  userId: string
}

export type ApiKeyStatus = 'active' | 'expiring' | 'revoked'

export type ApiKeyRecord = {
  createdAt: string
  expiresAt: string | null
  fingerprint: string
  id: string
  lastUsedAt: string | null
  name: string
  owner: string
  scopes: string[]
  status: ApiKeyStatus
}

export type LicenseStatus = 'valid' | 'expiring' | 'invalid'

export type LicenseSummary = {
  auditEvents: Array<{
    at: string
    label: string
  }>
  expiresAt: string
  features: string[]
  issuedTo: string
  plan: string
  seatsLimit: number
  seatsUsed: number
  status: LicenseStatus
}

export type UserStatus = 'active' | 'limited' | 'disabled'

export type AdminUserRecord = {
  displayName: string
  email: string
  expiresAt: string
  id: string
  mfaEnabled: boolean
  role: 'owner' | 'admin' | 'operator' | 'user'
  status: UserStatus
  subscription: 'trial' | 'paid' | 'grace' | 'expired'
  trafficUsedGb: number
}

export type LegacyNodeStatus = 'healthy' | 'degraded' | 'offline'

export type NodeRecord = {
  activeUsers: number
  id: string
  lastSeenAt: string
  loadPercent: number
  name: string
  region: string
  status: LegacyNodeStatus
  transports: string[]
  version: string
}

export type NodeStatus =
  | 'provisioning'
  | 'installing'
  | 'active'
  | 'offline'
  | 'failed'
  | 'deleted'
  | 'license_paused'
  | 'paused'
  | 'quarantined'
  | (string & {})

export type NodeResponse = {
  capabilities: Record<string, string>
  id: string
  last_seen_at: string | null
  name: string
  public_address: string
  region: string
  status: NodeStatus
}

export type NodeListResponse = {
  items: NodeResponse[]
}

export type ProvisioningJobKind = 'node.provision'

export type ProvisioningJobStatus =
  | 'queued'
  | 'preflight_running'
  | 'preflight_passed'
  | 'install_token_issued'
  | 'installing'
  | 'active'
  | 'failed'
  | 'cancelled'
  | (string & {})

export type PreflightStatus = 'pending' | 'running' | 'passed' | 'failed' | (string & {})

export type ProvisioningJobCreateRequest = {
  idempotency_key: string
  kind?: ProvisioningJobKind
  node: {
    name: string
    public_address: string
    region: string
  }
  requested_capabilities: Record<string, string>
  ssh: {
    credentials_ref: string
    host: string
    port: number
    username: string
  }
}

export type ProvisioningJobResponse = {
  created_at: string
  error_code: string | null
  error_message: string | null
  id: string
  idempotency_key: string
  kind: ProvisioningJobKind
  node_id: string
  preflight_result: Record<string, string>
  preflight_status: PreflightStatus
  requested_capabilities: Record<string, string>
  ssh_credentials_ref: string
  ssh_host: string
  ssh_port: number
  ssh_username: string
  status: ProvisioningJobStatus
  token_exchanged_at: string | null
  token_issued_at: string | null
  updated_at: string
}

export type InstallTokenIssueResponse = {
  expires_at: string
  install_token: string
  provisioning_job_id: string
  token_prefix: string
}

export type InstallTokenExchangeResponse = {
  heartbeat_path: string
  node_id: string
  node_token: string
  node_token_prefix: string
  provisioning_job_id: string
}

export type LumenApiClient = {
  createProvisioningJob: (
    request: ProvisioningJobCreateRequest,
  ) => Promise<ProvisioningJobResponse>
  getSession: () => Promise<AuthSession | null>
  listApiKeys: () => Promise<ResourceListResponse<ApiKeyRecord>>
  listNodes: () => Promise<NodeListResponse>
  listUsers: () => Promise<ResourceListResponse<AdminUserRecord>>
  readProvisioningJob: (jobId: string) => Promise<ProvisioningJobResponse>
  readLicense: () => Promise<LicenseSummary | null>
}

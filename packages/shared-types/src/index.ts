export type UUID = string;
export type ISODateTime = string;

export type Role = "owner" | "admin" | "support" | "node" | "user";

export type Permission =
  | "api_key:manage"
  | "license:manage"
  | "node:manage"
  | "subscription:read"
  | "subscription:manage"
  | "user:manage";

export interface ErrorPayload {
  code: string;
  message: string;
  details: string[];
}

export interface ErrorEnvelope {
  error: ErrorPayload;
}

export interface HealthResponse {
  status: "ok";
  checked_at: ISODateTime;
}

export interface ReadinessResponse {
  status: "ok" | "degraded";
  dependencies: Record<string, string>;
}

export interface TokenPairResponse {
  access_token: string;
  refresh_token: string;
  token_type: "Bearer";
  expires_at: ISODateTime;
}

export interface PrincipalResponse {
  subject: UUID;
  email: string;
  roles: Role[];
  permissions: Permission[];
}

export interface UserResponse {
  id: UUID;
  email: string;
  role: Role;
  status: string;
  created_at: ISODateTime;
}

export interface ApiKeyResponse {
  id: UUID;
  name: string;
  key_prefix: string;
  scopes: string[];
  expires_at: ISODateTime | null;
  revoked_at: ISODateTime | null;
  last_used_at: ISODateTime | null;
}

export interface LicenseResponse {
  id: UUID;
  customer_ref: string | null;
  status: string;
  max_devices: number;
  starts_at: ISODateTime | null;
  expires_at: ISODateTime | null;
}

export interface NodeResponse {
  id: UUID;
  name: string;
  region: string;
  public_address: string;
  status: string;
  capabilities: Record<string, string>;
  last_seen_at: ISODateTime | null;
}

export interface SubscriptionResponse {
  id: UUID;
  public_id: string;
  user_id: UUID;
  license_id: UUID;
  node_id: UUID | null;
  status: string;
  delivery_profile: Record<string, string>;
  expires_at: ISODateTime | null;
  revoked_at: ISODateTime | null;
}


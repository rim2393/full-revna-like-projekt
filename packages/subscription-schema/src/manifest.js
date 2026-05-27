export const SUBSCRIPTION_MANIFEST_SCHEMA_VERSION = "lumen.subscription-manifest.v1";

export const SUPPORTED_SUBSCRIPTION_PROTOCOLS = Object.freeze([
  "vless",
  "trojan",
  "shadowsocks",
  "wireguard",
  "hysteria2"
]);

const SUPPORTED_PROTOCOL_SET = new Set(SUPPORTED_SUBSCRIPTION_PROTOCOLS);

const FORBIDDEN_INLINE_SECRET_KEYS = new Set([
  "secret",
  "secrets",
  "password",
  "passwd",
  "token",
  "accessToken",
  "access_token",
  "privateKey",
  "private_key",
  "subscriptionUrl",
  "subscription_url",
  "generatedConfig",
  "generated_config"
]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeKey(key) {
  return key.replace(/[-_]/g, "").toLowerCase();
}

function findForbiddenInlineSecretKeys(value, path = "$", violations = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => findForbiddenInlineSecretKeys(item, `${path}[${index}]`, violations));
    return violations;
  }

  if (!isPlainObject(value)) {
    return violations;
  }

  for (const [key, child] of Object.entries(value)) {
    const normalized = normalizeKey(key);
    for (const forbiddenKey of FORBIDDEN_INLINE_SECRET_KEYS) {
      if (normalized === normalizeKey(forbiddenKey)) {
        violations.push(`${path}.${key}`);
      }
    }
    findForbiddenInlineSecretKeys(child, `${path}.${key}`, violations);
  }

  return violations;
}

function requireString(value, path, errors) {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${path} must be a non-empty string`);
  }
}

function requirePort(value, path, errors) {
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    errors.push(`${path} must be an integer TCP/UDP port`);
  }
}

function normalizeProtocolEndpoint(endpoint = {}) {
  return Object.freeze({
    host: endpoint.host,
    port: endpoint.port,
    transport: endpoint.transport ?? "tcp",
    network: endpoint.network ?? "public"
  });
}

function normalizeProtocol(protocol = {}) {
  return Object.freeze({
    type: protocol.type,
    adapter: protocol.adapter ?? protocol.type,
    endpoint: normalizeProtocolEndpoint(protocol.endpoint),
    credentialsRef: protocol.credentialsRef,
    capabilities: Object.freeze([...(protocol.capabilities ?? [])]),
    rendererHints: Object.freeze({ ...(protocol.rendererHints ?? {}) })
  });
}

function normalizeNode(node = {}) {
  return Object.freeze({
    id: node.id,
    displayName: node.displayName ?? node.id,
    region: node.region ?? "unknown",
    priority: node.priority ?? 100,
    tags: Object.freeze([...(node.tags ?? [])]),
    protocols: Object.freeze((node.protocols ?? []).map(normalizeProtocol)),
    metadata: Object.freeze({ ...(node.metadata ?? {}) })
  });
}

export function createSubscriptionManifest(input = {}) {
  const manifest = Object.freeze({
    schemaVersion: SUBSCRIPTION_MANIFEST_SCHEMA_VERSION,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    provider: Object.freeze({
      id: input.provider?.id,
      name: input.provider?.name
    }),
    subscription: Object.freeze({
      id: input.subscription?.id,
      audience: input.subscription?.audience ?? "lumen-client",
      expiresAt: input.subscription?.expiresAt ?? null,
      refreshAfter: input.subscription?.refreshAfter ?? null
    }),
    nodes: Object.freeze((input.nodes ?? []).map(normalizeNode)),
    renderHints: Object.freeze({
      preferredFormats: Object.freeze([...(input.renderHints?.preferredFormats ?? ["lumen-json"])])
    }),
    metadata: Object.freeze({ ...(input.metadata ?? {}) })
  });

  return assertValidSubscriptionManifest(manifest);
}

export function validateSubscriptionManifest(manifest) {
  const errors = [];

  if (!isPlainObject(manifest)) {
    return { ok: false, errors: ["manifest must be an object"] };
  }

  if (manifest.schemaVersion !== SUBSCRIPTION_MANIFEST_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${SUBSCRIPTION_MANIFEST_SCHEMA_VERSION}`);
  }

  requireString(manifest.generatedAt, "generatedAt", errors);
  requireString(manifest.provider?.id, "provider.id", errors);
  requireString(manifest.provider?.name, "provider.name", errors);
  requireString(manifest.subscription?.id, "subscription.id", errors);
  requireString(manifest.subscription?.audience, "subscription.audience", errors);

  if (!Array.isArray(manifest.nodes)) {
    errors.push("nodes must be an array");
  } else {
    manifest.nodes.forEach((node, nodeIndex) => {
      const nodePath = `nodes[${nodeIndex}]`;
      requireString(node.id, `${nodePath}.id`, errors);
      requireString(node.displayName, `${nodePath}.displayName`, errors);
      requireString(node.region, `${nodePath}.region`, errors);

      if (!Number.isInteger(node.priority)) {
        errors.push(`${nodePath}.priority must be an integer`);
      }

      if (!Array.isArray(node.protocols) || node.protocols.length === 0) {
        errors.push(`${nodePath}.protocols must contain at least one protocol`);
      } else {
        node.protocols.forEach((protocol, protocolIndex) => {
          const protocolPath = `${nodePath}.protocols[${protocolIndex}]`;
          requireString(protocol.type, `${protocolPath}.type`, errors);
          requireString(protocol.adapter, `${protocolPath}.adapter`, errors);
          requireString(protocol.credentialsRef, `${protocolPath}.credentialsRef`, errors);
          requireString(protocol.endpoint?.host, `${protocolPath}.endpoint.host`, errors);
          requirePort(protocol.endpoint?.port, `${protocolPath}.endpoint.port`, errors);

          if (protocol.type && !SUPPORTED_PROTOCOL_SET.has(protocol.type)) {
            errors.push(`${protocolPath}.type is not supported: ${protocol.type}`);
          }
        });
      }
    });
  }

  const secretViolations = findForbiddenInlineSecretKeys(manifest);
  if (secretViolations.length > 0) {
    errors.push(`inline secret-like fields are not allowed: ${secretViolations.join(", ")}`);
  }

  return { ok: errors.length === 0, errors };
}

export function assertValidSubscriptionManifest(manifest) {
  const result = validateSubscriptionManifest(manifest);
  if (!result.ok) {
    throw new Error(`Invalid subscription manifest: ${result.errors.join("; ")}`);
  }
  return manifest;
}

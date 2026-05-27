import { assertNoInlineSecrets } from "./outbound-model.js";

export const FIREWALL_PLAN_VERSION = "lumen.node-agent.firewall-plan.v1";

export const FIREWALL_BACKENDS = Object.freeze([
  "nftables",
  "iptables",
  "windows-firewall",
  "manual"
]);

export const FIREWALL_RULE_ACTIONS = Object.freeze(["allow", "deny"]);
export const FIREWALL_RULE_DIRECTIONS = Object.freeze(["ingress", "egress"]);
export const FIREWALL_RULE_PROTOCOLS = Object.freeze(["tcp", "udp", "icmp"]);
export const FIREWALL_DEFAULT_POLICIES = Object.freeze(["allow", "deny"]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function freezeArray(value) {
  return Object.freeze([...(value ?? [])]);
}

function requireString(value, path, errors) {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${path} must be a non-empty string`);
  }
}

function assertKnown(value, allowed, path, errors) {
  if (!allowed.includes(value)) {
    errors.push(`${path} must be one of ${allowed.join(", ")}`);
  }
}

function assertPort(value, path, errors) {
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    errors.push(`${path} must be an integer port between 1 and 65535`);
  }
}

function normalizePorts(ports = []) {
  return freezeArray([...new Set(ports)]);
}

function validateFirewallRule(rule, path, errors) {
  if (!isPlainObject(rule)) {
    errors.push(`${path} must be an object`);
    return;
  }

  requireString(rule.id, `${path}.id`, errors);
  assertKnown(rule.action, FIREWALL_RULE_ACTIONS, `${path}.action`, errors);
  assertKnown(rule.direction, FIREWALL_RULE_DIRECTIONS, `${path}.direction`, errors);
  assertKnown(rule.protocol, FIREWALL_RULE_PROTOCOLS, `${path}.protocol`, errors);

  if (!Array.isArray(rule.ports)) {
    errors.push(`${path}.ports must be an array`);
  } else {
    rule.ports.forEach((port, index) => assertPort(port, `${path}.ports[${index}]`, errors));
  }

  if (!Array.isArray(rule.cidrs)) {
    errors.push(`${path}.cidrs must be an array`);
  } else {
    rule.cidrs.forEach((cidr, index) => requireString(cidr, `${path}.cidrs[${index}]`, errors));
  }

  if (rule.protocol !== "icmp" && Array.isArray(rule.ports) && rule.ports.length === 0) {
    errors.push(`${path}.ports must contain at least one port for tcp/udp rules`);
  }
}

export function validateFirewallPlan(plan) {
  const errors = [];

  if (!isPlainObject(plan)) {
    return { ok: false, errors: ["firewall plan must be an object"] };
  }

  if (plan.modelVersion !== FIREWALL_PLAN_VERSION) {
    errors.push(`modelVersion must be ${FIREWALL_PLAN_VERSION}`);
  }

  requireString(plan.id, "id", errors);
  requireString(plan.nodeId, "nodeId", errors);
  assertKnown(plan.backend, FIREWALL_BACKENDS, "backend", errors);
  assertKnown(plan.defaultInboundPolicy, FIREWALL_DEFAULT_POLICIES, "defaultInboundPolicy", errors);
  assertKnown(plan.defaultOutboundPolicy, FIREWALL_DEFAULT_POLICIES, "defaultOutboundPolicy", errors);

  if (!Array.isArray(plan.rules)) {
    errors.push("rules must be an array");
  } else {
    const seenIds = new Set();
    plan.rules.forEach((rule, index) => {
      validateFirewallRule(rule, `rules[${index}]`, errors);
      if (rule?.id && seenIds.has(rule.id)) {
        errors.push(`rules[${index}].id must be unique`);
      }
      seenIds.add(rule?.id);
    });
  }

  try {
    assertNoInlineSecrets(plan);
  } catch (error) {
    errors.push(error.message);
  }

  return { ok: errors.length === 0, errors };
}

export function createFirewallRule(input = {}) {
  const rule = Object.freeze({
    id: input.id,
    ownerId: input.ownerId ?? null,
    action: input.action ?? "allow",
    direction: input.direction ?? "ingress",
    protocol: (input.protocol ?? "tcp").toLowerCase(),
    ports: normalizePorts(input.ports),
    cidrs: freezeArray(input.cidrs ?? ["0.0.0.0/0"]),
    description: input.description ?? null
  });

  const errors = [];
  validateFirewallRule(rule, "rule", errors);
  if (errors.length > 0) {
    throw new Error(`Invalid firewall rule: ${errors.join("; ")}`);
  }

  return rule;
}

export function createFirewallPlan(input = {}) {
  assertNoInlineSecrets(input);

  const plan = Object.freeze({
    modelVersion: FIREWALL_PLAN_VERSION,
    id: input.id,
    nodeId: input.nodeId,
    backend: input.backend ?? "manual",
    defaultInboundPolicy: input.defaultInboundPolicy ?? "deny",
    defaultOutboundPolicy: input.defaultOutboundPolicy ?? "allow",
    rules: freezeArray((input.rules ?? []).map(createFirewallRule)),
    metadata: Object.freeze({ ...(input.metadata ?? {}) })
  });

  const result = validateFirewallPlan(plan);
  if (!result.ok) {
    throw new Error(`Invalid firewall plan: ${result.errors.join("; ")}`);
  }

  return plan;
}

export function createFirewallPlanFromOutbounds(outbounds = [], input = {}) {
  const rules = outbounds.map((outbound) => createFirewallRule({
    id: `allow-${outbound.id}`,
    ownerId: outbound.id,
    action: "allow",
    direction: "ingress",
    protocol: outbound.bind?.protocol ?? outbound.endpoint?.transport ?? "tcp",
    ports: [outbound.bind?.port ?? outbound.endpoint?.port],
    cidrs: input.cidrs ?? ["0.0.0.0/0"],
    description: `Allow inbound traffic for outbound ${outbound.id}`
  }));

  return createFirewallPlan({
    id: input.id,
    nodeId: input.nodeId,
    backend: input.backend,
    defaultInboundPolicy: input.defaultInboundPolicy,
    defaultOutboundPolicy: input.defaultOutboundPolicy,
    rules,
    metadata: input.metadata
  });
}

import { assertNoInlineSecrets } from "./outbound-model.js";

export const PROVISIONING_JOB_CONTRACT_VERSION = "lumen.node-agent.provisioning-job.v1";

export const PROVISIONING_JOB_KINDS = Object.freeze([
  "node.provision",
  "node.deprovision",
  "outbound.apply",
  "outbound.remove",
  "capabilities.report",
  "conflict.scan"
]);

export const PROVISIONING_JOB_STATUSES = Object.freeze([
  "queued",
  "accepted",
  "running",
  "succeeded",
  "failed",
  "cancelled"
]);

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

export function createProvisioningJob(input = {}) {
  const errors = [];

  requireString(input.id, "id", errors);
  requireString(input.nodeId, "nodeId", errors);
  requireString(input.idempotencyKey, "idempotencyKey", errors);
  assertKnown(input.kind, PROVISIONING_JOB_KINDS, "kind", errors);

  if (errors.length > 0) {
    throw new Error(`Invalid provisioning job: ${errors.join("; ")}`);
  }

  assertNoInlineSecrets(input.payload ?? {});

  return Object.freeze({
    contractVersion: PROVISIONING_JOB_CONTRACT_VERSION,
    id: input.id,
    kind: input.kind,
    nodeId: input.nodeId,
    idempotencyKey: input.idempotencyKey,
    requestedBy: input.requestedBy ?? "control-plane",
    createdAt: input.createdAt ?? new Date().toISOString(),
    deadlineAt: input.deadlineAt ?? null,
    payload: Object.freeze({ ...(input.payload ?? {}) })
  });
}

export function createProvisioningResult(job, input = {}) {
  const errors = [];

  requireString(job?.id, "job.id", errors);
  assertKnown(input.status, PROVISIONING_JOB_STATUSES, "status", errors);

  if (errors.length > 0) {
    throw new Error(`Invalid provisioning result: ${errors.join("; ")}`);
  }

  assertNoInlineSecrets(input.outputs ?? {});

  return Object.freeze({
    contractVersion: PROVISIONING_JOB_CONTRACT_VERSION,
    jobId: job.id,
    nodeId: job.nodeId,
    status: input.status,
    finishedAt: input.finishedAt ?? new Date().toISOString(),
    outputs: Object.freeze({ ...(input.outputs ?? {}) }),
    conflicts: Object.freeze([...(input.conflicts ?? [])]),
    error: input.error ?? null
  });
}

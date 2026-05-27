import test from "node:test";
import assert from "node:assert/strict";
import { createProvisioningJob, createProvisioningResult } from "../src/index.js";

test("creates provisioning job and result contracts", () => {
  const job = createProvisioningJob({
    id: "job-1",
    kind: "outbound.apply",
    nodeId: "ams-1",
    idempotencyKey: "job-1:ams-1",
    createdAt: "2026-05-26T00:00:00.000Z",
    payload: { outboundId: "ams-vless", credentialsRef: "vault://nodes/ams-1/vless" }
  });

  const result = createProvisioningResult(job, {
    status: "succeeded",
    finishedAt: "2026-05-26T00:01:00.000Z",
    outputs: { appliedOutboundId: "ams-vless" }
  });

  assert.equal(job.kind, "outbound.apply");
  assert.equal(result.jobId, "job-1");
});

test("rejects secret-like payload keys", () => {
  assert.throws(
    () => createProvisioningJob({
      id: "job-2",
      kind: "outbound.apply",
      nodeId: "ams-1",
      idempotencyKey: "job-2:ams-1",
      payload: { accessToken: "do-not-store" }
    }),
    /Inline secret-like fields/
  );
});

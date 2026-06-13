import test from "node:test";
import assert from "node:assert/strict";
import { createOutboundPlan, validateOutboundPlan } from "../src/index.js";

test("creates outbound plan with a credentials reference only", () => {
  const plan = createOutboundPlan({
    id: "ams-vless",
    nodeId: "ams-1",
    protocol: "vless",
    endpoint: { host: "ams-1.example.net", port: 443 },
    credentialsRef: "vault://nodes/ams-1/vless",
    requiredCapabilities: ["runtime.xray_core"]
  });

  assert.equal(plan.adapter, "vless");
  assert.equal(plan.bind.port, 443);
  assert.equal(validateOutboundPlan(plan).ok, true);
  assert.equal(Object.isFrozen(plan), true);
});

test("rejects inline secret-like fields", () => {
  assert.throws(
    () => createOutboundPlan({
      id: "bad",
      nodeId: "ams-1",
      protocol: "trojan",
      endpoint: { host: "ams-1.example.net", port: 443 },
      credentialsRef: "vault://nodes/ams-1/trojan",
      metadata: { password: "do-not-store" }
    }),
    /Inline secret-like fields/
  );
});

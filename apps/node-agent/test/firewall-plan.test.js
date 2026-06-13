import test from "node:test";
import assert from "node:assert/strict";
import {
  createFirewallPlan,
  createFirewallPlanFromOutbounds,
  createOutboundPlan,
  validateFirewallPlan
} from "../src/index.js";

test("creates firewall plan with immutable allow rules", () => {
  const plan = createFirewallPlan({
    id: "fw-ams-1",
    nodeId: "ams-1",
    backend: "nftables",
    defaultInboundPolicy: "deny",
    defaultOutboundPolicy: "allow",
    rules: [
      {
        id: "allow-vless",
        ownerId: "ams-vless",
        action: "allow",
        direction: "ingress",
        protocol: "tcp",
        ports: [443],
        cidrs: ["0.0.0.0/0"]
      }
    ]
  });

  assert.equal(validateFirewallPlan(plan).ok, true);
  assert.equal(plan.rules[0].ports[0], 443);
  assert.equal(Object.isFrozen(plan.rules), true);
  assert.equal(Object.isFrozen(plan.rules[0]), true);
});

test("derives inbound firewall rules from outbound bind ports without secrets", () => {
  const outbound = createOutboundPlan({
    id: "ams-hysteria2",
    nodeId: "ams-1",
    protocol: "hysteria2",
    endpoint: { host: "ams-1.example.net", port: 443, transport: "udp" },
    bind: { address: "0.0.0.0", port: 8443, protocol: "udp" },
    credentialsRef: "vault://nodes/ams-1/hysteria2"
  });
  const plan = createFirewallPlanFromOutbounds([outbound], {
    id: "fw-ams-1",
    nodeId: "ams-1",
    backend: "iptables",
    cidrs: ["203.0.113.0/24"]
  });

  assert.equal(plan.rules.length, 1);
  assert.equal(plan.rules[0].id, "allow-ams-hysteria2");
  assert.equal(plan.rules[0].protocol, "udp");
  assert.equal(plan.rules[0].ports[0], 8443);
  assert.deepEqual(plan.rules[0].cidrs, ["203.0.113.0/24"]);
});

test("rejects invalid firewall ports and inline secret-like metadata", () => {
  assert.throws(
    () => createFirewallPlan({
      id: "fw-bad",
      nodeId: "ams-1",
      rules: [{ id: "bad-port", protocol: "tcp", ports: [70000] }]
    }),
    /ports\[0\]/
  );

  assert.throws(
    () => createFirewallPlan({
      id: "fw-secret",
      nodeId: "ams-1",
      rules: [],
      metadata: { password: "do-not-store" }
    }),
    /Inline secret-like fields/
  );
});

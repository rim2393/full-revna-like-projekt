import test from "node:test";
import assert from "node:assert/strict";
import {
  createProtocolRegistry,
  defaultProtocolRegistry,
  firstProtocolPlaceholders
} from "../src/index.js";

test("registers first protocol placeholders", () => {
  const protocols = defaultProtocolRegistry.list().map((adapter) => adapter.protocol);
  assert.deepEqual(protocols, firstProtocolPlaceholders.map((adapter) => adapter.protocol));
  assert.equal(defaultProtocolRegistry.require("vless").status, "placeholder");
});

test("placeholder adapter returns a non-live outbound plan", () => {
  const plan = defaultProtocolRegistry.require("wireguard").planOutbound({
    nodeId: "ams-1",
    outboundId: "wg-1",
    endpoint: { host: "ams-1.example.net", port: 51820 },
    credentialsRef: "vault://nodes/ams-1/wireguard"
  });

  assert.equal(plan.implementationStatus, "not-implemented");
  assert.match(plan.warnings[0], /placeholder/);
  assert.equal(plan.credentialsRef, "vault://nodes/ams-1/wireguard");
});

test("rejects duplicate protocol adapters", () => {
  assert.throws(
    () => createProtocolRegistry([defaultProtocolRegistry.require("vless"), defaultProtocolRegistry.require("vless")]),
    /Duplicate protocol adapter/
  );
});

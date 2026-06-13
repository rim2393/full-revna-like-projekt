import test from "node:test";
import assert from "node:assert/strict";
import {
  CONFLICT_TYPES,
  SYSTEM_CAPABILITIES,
  createSystemCapabilityReport,
  detectPortConflicts
} from "../src/index.js";

test("detects overlapping exclusive port reservations", () => {
  const conflicts = detectPortConflicts([
    { ownerId: "outbound-a", address: "0.0.0.0", port: 8443, protocol: "tcp" },
    { ownerId: "outbound-b", address: "127.0.0.1", port: 8443, protocol: "tcp" }
  ]);

  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].type, CONFLICT_TYPES.PORT_IN_USE);
});

test("models privileged port capability separately from port overlap", () => {
  const withoutCapability = detectPortConflicts([{ ownerId: "edge", port: 443, protocol: "tcp" }]);
  assert.equal(withoutCapability[0].type, CONFLICT_TYPES.PRIVILEGED_PORT);

  const report = createSystemCapabilityReport({
    nodeId: "ams-1",
    capabilities: { [SYSTEM_CAPABILITIES.BIND_PRIVILEGED_PORTS]: true }
  });
  const withCapability = detectPortConflicts([{ ownerId: "edge", port: 443, protocol: "tcp" }], report);
  assert.equal(withCapability.length, 0);
});

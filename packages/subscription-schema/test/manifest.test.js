import test from "node:test";
import assert from "node:assert/strict";
import {
  SUBSCRIPTION_MANIFEST_SCHEMA_VERSION,
  createSubscriptionManifest,
  validateSubscriptionManifest
} from "../src/index.js";

test("creates a valid subscription manifest without inline secrets", () => {
  const manifest = createSubscriptionManifest({
    generatedAt: "2026-05-26T00:00:00.000Z",
    provider: { id: "lumen", name: "Lumen VPN" },
    subscription: { id: "sub_123", audience: "android" },
    nodes: [
      {
        id: "ams-1",
        displayName: "Amsterdam 1",
        region: "nl-ams",
        protocols: [
          {
            type: "vless",
            endpoint: { host: "ams-1.example.net", port: 443, transport: "tcp" },
            credentialsRef: "vault://subscriptions/sub_123/vless"
          }
        ]
      }
    ]
  });

  assert.equal(manifest.schemaVersion, SUBSCRIPTION_MANIFEST_SCHEMA_VERSION);
  assert.equal(validateSubscriptionManifest(manifest).ok, true);
  assert.equal(manifest.nodes[0].protocols[0].adapter, "vless");
});

test("rejects unsupported protocols and inline secret-like fields", () => {
  const result = validateSubscriptionManifest({
    schemaVersion: SUBSCRIPTION_MANIFEST_SCHEMA_VERSION,
    generatedAt: "2026-05-26T00:00:00.000Z",
    provider: { id: "lumen", name: "Lumen VPN" },
    subscription: { id: "sub_123", audience: "android" },
    nodes: [
      {
        id: "ams-1",
        displayName: "Amsterdam 1",
        region: "nl-ams",
        priority: 100,
        protocols: [
          {
            type: "unknown",
            adapter: "unknown",
            endpoint: { host: "ams-1.example.net", port: 443 },
            credentialsRef: "vault://subscriptions/sub_123/unknown",
            password: "do-not-store"
          }
        ]
      }
    ]
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /not supported/);
  assert.match(result.errors.join("\n"), /inline secret-like fields/);
});

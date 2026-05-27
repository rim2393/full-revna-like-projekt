import test from "node:test";
import assert from "node:assert/strict";
import { createSubscriptionManifest } from "../../subscription-schema/src/index.js";
import {
  renderClientSubscription,
  renderClashMetaSkeleton,
  renderJsonManifest,
  renderSingBoxSkeleton
} from "../src/index.js";

function fixtureManifest() {
  return createSubscriptionManifest({
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
            endpoint: { host: "ams-1.example.net", port: 443 },
            credentialsRef: "vault://subscriptions/sub_123/vless"
          }
        ]
      }
    ]
  });
}

test("renders stable lumen json", () => {
  const output = renderJsonManifest(fixtureManifest());
  assert.match(output, /"schemaVersion": "lumen\.subscription-manifest\.v1"/);
  assert.match(output, /"credentialsRef": "vault:\/\/subscriptions\/sub_123\/vless"/);
});

test("renders sing-box and clash skeletons without inline credentials", () => {
  const manifest = fixtureManifest();
  const singBox = renderSingBoxSkeleton(manifest);
  const clash = renderClashMetaSkeleton(manifest);

  assert.equal(singBox.outbounds[0].implementation_status, "placeholder");
  assert.match(clash, /lumen_credentials_ref/);
  assert.doesNotMatch(JSON.stringify(singBox), /password|privateKey|accessToken/);
  assert.doesNotMatch(clash, /password|privateKey|accessToken/);
});

test("dispatches renderer formats and rejects unknown formats", () => {
  const manifest = fixtureManifest();
  assert.match(renderClientSubscription(manifest, "clash-meta-skeleton"), /proxies:/);
  assert.throws(() => renderClientSubscription(manifest, "raw-url"), /Unsupported/);
});

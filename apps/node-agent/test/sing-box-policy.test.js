import assert from "node:assert/strict";
import test from "node:test";
import { applySingBoxPolicy } from "../src/sing-box-policy.js";

const torrentPolicy = Object.freeze({
  modelVersion: "lumen.node-policy.v1",
  plugins: [
    {
      id: "torrent",
      kind: "torrent-blocker",
      name: "Torrent blocker",
      enabled: true,
      config: { mode: "block" }
    }
  ]
});

test("applySingBoxPolicy injects block outbound and Bittorrent route", () => {
  const config = {
    inbounds: [{ type: "hysteria2", tag: "hy2-in" }],
    outbounds: [{ type: "direct", tag: "direct" }]
  };

  const result = applySingBoxPolicy(config, torrentPolicy);

  assert.deepEqual(result.outbounds, [
    { type: "direct", tag: "direct" },
    { type: "block", tag: "blocked" }
  ]);
  assert.deepEqual(result.route.rules[0], {
    protocol: ["bittorrent"],
    outbound: "blocked"
  });
  assert.equal(result.route.final, "direct");
});

test("applySingBoxPolicy preserves existing route and avoids duplicate blocked outbound", () => {
  const config = {
    outbounds: [
      { type: "direct", tag: "direct" },
      { type: "block", tag: "blocked" }
    ],
    route: {
      rules: [{ domain: ["example.com"], outbound: "direct" }],
      final: "direct"
    }
  };

  const result = applySingBoxPolicy(config, torrentPolicy);

  assert.equal(result.outbounds.filter((outbound) => outbound.tag === "blocked").length, 1);
  assert.deepEqual(result.route.rules, [
    { protocol: ["bittorrent"], outbound: "blocked" },
    { domain: ["example.com"], outbound: "direct" }
  ]);
});

test("applySingBoxPolicy ignores report-only torrent plugin", () => {
  const config = { outbounds: [{ type: "direct", tag: "direct" }] };
  const result = applySingBoxPolicy(config, {
    modelVersion: "lumen.node-policy.v1",
    plugins: [
      {
        id: "torrent",
        kind: "torrent-blocker",
        name: "Torrent report",
        enabled: true,
        config: { mode: "report" }
      }
    ]
  });

  assert.equal(result, config);
});

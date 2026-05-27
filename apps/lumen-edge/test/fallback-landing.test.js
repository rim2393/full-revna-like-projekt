import test from "node:test";
import assert from "node:assert/strict";
import { createFallbackLandingModel, renderFallbackLandingHtml } from "../src/index.js";

test("creates fallback landing model with safe diagnostics", () => {
  const model = createFallbackLandingModel({
    host: "edge.example.net",
    requestId: "req_123",
    generatedAt: "2026-05-26T00:00:00.000Z"
  });

  assert.equal(model.status, "fallback");
  assert.equal(model.diagnostics.secretsIncluded, false);
  assert.equal(model.diagnostics.liveTrafficEnabled, false);
});

test("renders escaped fallback html", () => {
  const html = renderFallbackLandingHtml(createFallbackLandingModel({
    host: "<edge>",
    requestId: "req_123",
    generatedAt: "2026-05-26T00:00:00.000Z"
  }));

  assert.match(html, /&lt;edge&gt;/);
  assert.doesNotMatch(html, /privateKey|accessToken|password/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runNodeAgentOnce } from "../src/index.js";

function jsonResponse(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

test("run once exchanges install token, persists node token, and sends heartbeat", async () => {
  const stateDir = mkdtempSync(join(tmpdir(), "lumen-agent-state-"));
  const secretDir = mkdtempSync(join(tmpdir(), "lumen-agent-secrets-"));
  try {
    const installTokenFile = join(secretDir, "install-token");
    writeFileSync(installTokenFile, "install-secret\n", { mode: 0o600 });
    const calls = [];

    const result = await runNodeAgentOnce({
      env: {
        LUMEN_CONTROL_PLANE_URL: "https://panel.example",
        LUMEN_INSTALL_TOKEN_FILE: installTokenFile,
        LUMEN_NODE_NAME: "node-1",
        LUMEN_STATE_DIR: stateDir
      },
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        if (url.endsWith("/install-token/exchange")) {
          return jsonResponse({
            provisioning_job_id: "job-1",
            node_id: "node-1",
            node_token: "node-secret",
            node_token_prefix: "lumen_node_abc",
            heartbeat_path: "/api/v1/nodes/node-1/heartbeat"
          });
        }
        return jsonResponse({
          id: "node-1",
          name: "node-1",
          status: "active",
          last_seen_at: "2026-05-27T00:00:00Z",
          capabilities: {}
        });
      }
    });

    assert.equal(calls.length, 2);
    assert.equal(JSON.parse(calls[0].options.body).install_token, "install-secret");
    assert.equal(calls[1].options.headers["x-lumen-node-token"], "node-secret");
    assert.equal(result.exchange.nodeTokenPrefix, "lumen_node_abc");
    assert.equal(JSON.stringify(result).includes("node-secret"), false);
  } finally {
    rmSync(stateDir, { recursive: true, force: true });
    rmSync(secretDir, { recursive: true, force: true });
  }
});

test("run once reuses persisted node token without exchanging install token again", async () => {
  const stateDir = mkdtempSync(join(tmpdir(), "lumen-agent-state-"));
  try {
    writeFileSync(join(stateDir, "node-token"), "persisted-node-token\n", { mode: 0o600 });
    writeFileSync(join(stateDir, "heartbeat-path"), "/api/v1/nodes/node-2/heartbeat\n", { mode: 0o600 });
    const calls = [];

    const result = await runNodeAgentOnce({
      env: {
        LUMEN_CONTROL_PLANE_URL: "https://panel.example",
        LUMEN_NODE_NAME: "node-2",
        LUMEN_STATE_DIR: stateDir
      },
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return jsonResponse({
          id: "node-2",
          name: "node-2",
          status: "active",
          last_seen_at: "2026-05-27T00:00:00Z",
          capabilities: {}
        });
      }
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://panel.example/api/v1/nodes/node-2/heartbeat");
    assert.equal(calls[0].options.headers["x-lumen-node-token"], "persisted-node-token");
    assert.equal(result.reusedExistingToken, true);
  } finally {
    rmSync(stateDir, { recursive: true, force: true });
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { NODE_AGENT_HEALTHCHECK_VERSION, runNodeAgentHealthcheck } from "../src/index.js";

function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), "lumen-agent-health-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function baseEnv(dir) {
  return {
    LUMEN_NODE_NAME: "edge-1",
    LUMEN_PANEL_URL: "https://panel.example",
    LUMEN_STATE_DIR: dir
  };
}

test("healthcheck passes for mounted install token before enrollment", () => withTempDir((dir) => {
  const installTokenFile = join(dir, "install-token");
  writeFileSync(installTokenFile, "lumen_it_secret\n", { mode: 0o600 });

  const report = runNodeAgentHealthcheck({
    env: {
      ...baseEnv(dir),
      LUMEN_INSTALL_TOKEN_FILE: installTokenFile
    }
  });

  assert.equal(report.reportVersion, NODE_AGENT_HEALTHCHECK_VERSION);
  assert.equal(report.status, "ok");
  assert.equal(report.nodeId, "edge-1");
  assert.equal(report.enrolled, false);
  assert.equal(report.enrollable, true);
  assert.equal(JSON.stringify(report).includes("lumen_it_secret"), false);
}));

test("healthcheck passes for enrolled node state", () => withTempDir((dir) => {
  writeFileSync(join(dir, "node-token"), "lumen_node_secret\n", { mode: 0o600 });
  writeFileSync(join(dir, "heartbeat-path"), "/api/v1/nodes/node-1/heartbeat\n", { mode: 0o600 });

  const report = runNodeAgentHealthcheck({ env: baseEnv(dir) });

  assert.equal(report.status, "ok");
  assert.equal(report.enrolled, true);
  assert.equal(report.enrollable, false);
  assert.equal(JSON.stringify(report).includes("lumen_node_secret"), false);
}));

test("healthcheck fails when node is neither enrolled nor enrollable", () => withTempDir((dir) => {
  assert.throws(
    () => runNodeAgentHealthcheck({ env: baseEnv(dir) }),
    /neither enrolled nor enrollable/
  );
}));

test("CLI supports compose-compatible healthcheck command", () => withTempDir((dir) => {
  const installTokenFile = join(dir, "install-token");
  const cliPath = fileURLToPath(new URL("../src/cli.js", import.meta.url));
  writeFileSync(installTokenFile, "lumen_it_secret\n", { mode: 0o600 });

  const result = spawnSync(process.execPath, [cliPath, "healthcheck"], {
    encoding: "utf8",
    env: {
      ...process.env,
      ...baseEnv(dir),
      LUMEN_INSTALL_TOKEN_FILE: installTokenFile
    }
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.includes("lumen_it_secret"), false);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "ok");
  assert.equal(report.enrollable, true);
}));

import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { applyXrayConfig, createXrayApplyPlan } from "../src/xray-runtime.js";

test("xray process reload mode writes config and starts managed xray", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "lumen-xray-runtime-"));
  const configPath = join(tmp, "config.json");
  const logPath = join(tmp, "xray.log");
  const calls = [];
  const spawned = [];
  const config = {
    inbounds: [
      {
        tag: "vless",
        listen: "0.0.0.0",
        port: 18444,
        protocol: "vless",
        settings: { decryption: "none", clients: [{ id: "client-id" }] },
        streamSettings: { network: "tcp", security: "none" }
      }
    ]
  };

  const result = await applyXrayConfig(createXrayApplyPlan({ xrayConfig: config }), {
    env: {
      LUMEN_XRAY_BINARY: "xray-test-bin",
      LUMEN_XRAY_CONFIG_FILE: configPath,
      LUMEN_XRAY_LOG_FILE: logPath,
      LUMEN_XRAY_RELOAD_MODE: "process"
    },
    dryRun: false,
    execFileImpl: async (command, args) => {
      calls.push({ command, args });
      if (command === "pkill") {
        const error = new Error("no process");
        error.code = 1;
        throw error;
      }
      return { stdout: "", stderr: "" };
    },
    spawnImpl: (command, args, options) => {
      spawned.push({ command, args, options });
      return { pid: 12345, unref() {} };
    }
  });

  assert.equal(result.implementationStatus, "xray-managed-process-started");
  assert.equal(result.pid, 12345);
  assert.deepEqual(calls, [
    { command: "xray-test-bin", args: ["-test", "-config", configPath] },
    { command: "pkill", args: ["-TERM", "-x", "xray"] }
  ]);
  assert.equal(spawned[0].command, "xray-test-bin");
  assert.deepEqual(spawned[0].args, ["run", "-config", configPath]);
  assert.equal(JSON.parse(readFileSync(configPath, "utf8")).inbounds[0].port, 18444);

  rmSync(tmp, { recursive: true, force: true });
});

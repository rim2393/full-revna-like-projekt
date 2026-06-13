import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_NAIVE_RELOAD_ARGV,
  applyNaiveConfig,
  createNaiveApplyPlan,
  renderNaiveSingBoxConfig,
  stopNaiveRuntime
} from "../src/naive-runtime.js";

function validConfig() {
  return {
    listen: "[::]:443",
    users: [{ username: "lumen_sub_live", password: "lumen-managed-secret" }],
    tls: {
      cert: "/etc/naive/cert.pem",
      key: "/etc/naive/key.pem"
    }
  };
}

test("createNaiveApplyPlan accepts a complete server config", () => {
  const plan = createNaiveApplyPlan({ id: "naive-1", naiveConfig: validConfig() });
  assert.equal(plan.config.listen, "[::]:443");
  assert.equal(plan.modelVersion, "lumen.node-agent.naive-runtime.v1");
});

test("createNaiveApplyPlan rejects incomplete config", () => {
  assert.throws(
    () => createNaiveApplyPlan({ config: { listen: "[::]:443", users: [] } }),
    /users must contain at least one/
  );
  assert.throws(
    () => createNaiveApplyPlan({ config: { users: validConfig().users, tls: validConfig().tls } }),
    /listen must be a non-empty/
  );
  assert.throws(
    () => createNaiveApplyPlan({ config: { listen: "[::]:443", users: validConfig().users } }),
    /tls.cert\+tls.key or an acme block/
  );
});

test("createNaiveApplyPlan rejects unresolved refs", () => {
  const config = { ...validConfig(), clientsRef: "vault://x" };
  assert.throws(() => createNaiveApplyPlan({ config }), /unresolved refs/);
});

test("applyNaiveConfig dry-run summarizes the reload command without touching disk", async () => {
  const plan = createNaiveApplyPlan({ config: validConfig() });
  const result = await applyNaiveConfig(plan, { dryRun: true });
  assert.equal(result.implementationStatus, "naive-dry-run");
  assert.equal(result.reloadCommand, DEFAULT_NAIVE_RELOAD_ARGV.join(" "));
});

test("renderNaiveSingBoxConfig emits a runnable sing-box inbound", () => {
  const rendered = renderNaiveSingBoxConfig(validConfig());
  assert.equal(rendered.inbounds[0].type, "naive");
  assert.equal(rendered.inbounds[0].listen_port, 443);
  assert.equal(rendered.inbounds[0].users[0].username, "lumen_sub_live");
  assert.equal(rendered.inbounds[0].users[0].password, "lumen-managed-secret");
  assert.equal(rendered.inbounds[0].tls.certificate_path, "/etc/naive/cert.pem");
});

test("applyNaiveConfig process mode validates and starts managed sing-box", async () => {
  const dir = mkdtempSync(join(tmpdir(), "lumen-naive-process-"));
  const configPath = join(dir, "config.json");
  const logPath = join(dir, "sing-box.log");
  const pidFile = join(dir, "sing-box.pid");
  const calls = [];
  const spawned = [];
  const plan = createNaiveApplyPlan({ config: validConfig(), configPath });
  try {
    const result = await applyNaiveConfig(plan, {
      dryRun: false,
      env: {
        LUMEN_NAIVE_RELOAD_MODE: "process",
        LUMEN_NAIVE_LOG_FILE: logPath,
        LUMEN_NAIVE_PID_FILE: pidFile,
        LUMEN_NAIVE_BINARY: "sing-box-test"
      },
      execFileImpl: async (command, args) => {
        calls.push([command, args]);
      },
      spawnImpl: (command, args) => {
        spawned.push([command, args]);
        return { pid: 12347, unref() {} };
      }
    });
    assert.equal(result.implementationStatus, "naive-managed-process-started");
    assert.deepEqual(calls[0], ["sing-box-test", ["check", "-c", configPath]]);
    assert.deepEqual(spawned[0], ["sing-box-test", ["run", "-c", configPath]]);
    const written = JSON.parse(readFileSync(configPath, "utf-8"));
    assert.equal(written.inbounds[0].type, "naive");
    assert.equal(readFileSync(pidFile, "utf-8").trim(), "12347");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("stopNaiveRuntime removes managed process files", async () => {
  const dir = mkdtempSync(join(tmpdir(), "lumen-naive-stop-"));
  const configPath = join(dir, "config.json");
  const logPath = join(dir, "sing-box.log");
  const pidFile = join(dir, "sing-box.pid");
  try {
    writeFileSync(configPath, "{}\n");
    writeFileSync(logPath, "runtime log\n");
    writeFileSync(pidFile, "999999\n");

    const result = await stopNaiveRuntime({
      env: {
        LUMEN_NAIVE_CONFIG_FILE: configPath,
        LUMEN_NAIVE_LOG_FILE: logPath,
        LUMEN_NAIVE_PID_FILE: pidFile
      }
    });

    assert.equal(result.implementationStatus, "naive-stopped");
    assert.equal(result.stopped, false);
    assert.equal(existsSync(configPath), false);
    assert.equal(existsSync(logPath), false);
    assert.equal(existsSync(pidFile), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

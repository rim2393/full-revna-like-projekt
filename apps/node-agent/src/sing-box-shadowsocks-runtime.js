import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { promisify } from "node:util";
import { execFile as nodeExecFile, spawn } from "node:child_process";

export const SING_BOX_SHADOWSOCKS_RUNTIME_MODEL_VERSION =
  "lumen.node-agent.sing-box-shadowsocks-runtime.v1";
export const DEFAULT_SING_BOX_SHADOWSOCKS_CONFIG_PATH =
  "/var/lib/lumen-node/runtime/shadowsocks/config.json";
export const DEFAULT_SING_BOX_SHADOWSOCKS_LOG_FILE =
  "/var/lib/lumen-node/runtime/shadowsocks/sing-box.log";
export const DEFAULT_SING_BOX_SHADOWSOCKS_PID_FILE =
  "/var/lib/lumen-node/runtime/shadowsocks/sing-box.pid";
export const DEFAULT_SING_BOX_SHADOWSOCKS_BINARY = "sing-box";
export const SING_BOX_SHADOWSOCKS_RELOAD_MODE_PROCESS = "process";

const execFileAsync = promisify(nodeExecFile);
const FORBIDDEN_UNRESOLVED_FIELDS = new Set(["clientsRef", "credentialsRef"]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertNoUnresolvedRefs(value, path = "$", violations = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoUnresolvedRefs(item, `${path}[${index}]`, violations));
    return violations;
  }
  if (!isPlainObject(value)) {
    return violations;
  }
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_UNRESOLVED_FIELDS.has(key)) {
      violations.push(`${path}.${key}`);
    }
    assertNoUnresolvedRefs(child, `${path}.${key}`, violations);
  }
  return violations;
}

function validateShadowsocksConfig(config) {
  const errors = [];
  if (!isPlainObject(config)) {
    errors.push("singBoxShadowsocksConfig must be an object");
  }
  if (typeof config?.method !== "string" || config.method.length === 0) {
    errors.push("singBoxShadowsocksConfig.method must be a non-empty string");
  }
  if (typeof config?.password !== "string" || config.password.length === 0) {
    errors.push("singBoxShadowsocksConfig.password must be a non-empty string");
  }
  if (!Number.isInteger(config?.listen_port) || config.listen_port < 1 || config.listen_port > 65535) {
    errors.push("singBoxShadowsocksConfig.listen_port must be an integer port in 1..65535");
  }
  const unresolved = assertNoUnresolvedRefs(config);
  if (unresolved.length > 0) {
    errors.push(`singBoxShadowsocksConfig contains unresolved refs: ${unresolved.join(", ")}`);
  }
  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }
}

function renderSingBoxConfig(config) {
  validateShadowsocksConfig(config);
  return {
    log: { level: "info", timestamp: true },
    inbounds: [
      {
        type: "shadowsocks",
        tag: "shadowsocks-in",
        listen: String(config.listen || "::"),
        listen_port: config.listen_port,
        network: String(config.network || "tcp"),
        method: config.method,
        password: config.password
      }
    ],
    outbounds: [{ type: "direct", tag: "direct" }]
  };
}

export function createSingBoxShadowsocksApplyPlan(input = {}) {
  const config = input.singBoxShadowsocksConfig ?? input.config;
  validateShadowsocksConfig(config);
  return Object.freeze({
    modelVersion: SING_BOX_SHADOWSOCKS_RUNTIME_MODEL_VERSION,
    id: input.id,
    config,
    configPath: input.configPath
  });
}

async function runExecFile(execFileImpl, command, args) {
  if (execFileImpl) {
    return await execFileImpl(command, args);
  }
  return await execFileAsync(command, args);
}

function readPid(pidFile) {
  try {
    const raw = readFileSync(pidFile, "utf8").trim();
    const pid = Number.parseInt(raw, 10);
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function isPidRunning(pid) {
  if (!pid) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function stopPid(pidFile) {
  const pid = readPid(pidFile);
  if (!pid || !isPidRunning(pid)) {
    return false;
  }
  process.kill(pid, "SIGTERM");
  return true;
}

function startManagedProcess(binary, configPath, logPath, pidFile, spawnImpl = spawn) {
  mkdirSync(dirname(logPath), { recursive: true, mode: 0o700 });
  const stdout = openSync(logPath, "a", 0o600);
  const stderr = openSync(logPath, "a", 0o600);
  try {
    const child = spawnImpl(binary, ["run", "-c", configPath], {
      detached: true,
      stdio: ["ignore", stdout, stderr]
    });
    child.unref();
    writeFileSync(pidFile, `${child.pid}\n`, { mode: 0o600 });
    return child.pid;
  } finally {
    closeSync(stdout);
    closeSync(stderr);
  }
}

export async function ensureManagedSingBoxShadowsocksProcess(input = {}) {
  const env = input.env ?? {};
  if (env.LUMEN_SHADOWSOCKS_RELOAD_MODE !== SING_BOX_SHADOWSOCKS_RELOAD_MODE_PROCESS) {
    return null;
  }
  const configPath = env.LUMEN_SHADOWSOCKS_CONFIG_FILE ?? DEFAULT_SING_BOX_SHADOWSOCKS_CONFIG_PATH;
  if (!existsSync(configPath)) {
    return null;
  }
  const binary = env.LUMEN_SHADOWSOCKS_BINARY ?? DEFAULT_SING_BOX_SHADOWSOCKS_BINARY;
  const logPath = env.LUMEN_SHADOWSOCKS_LOG_FILE ?? DEFAULT_SING_BOX_SHADOWSOCKS_LOG_FILE;
  const pidFile = env.LUMEN_SHADOWSOCKS_PID_FILE ?? DEFAULT_SING_BOX_SHADOWSOCKS_PID_FILE;
  await runExecFile(input.execFileImpl, binary, ["check", "-c", configPath]);
  const pid = readPid(pidFile);
  if (isPidRunning(pid)) {
    return Object.freeze({
      implementationStatus: "shadowsocks-managed-process-running",
      configPath,
      logPath,
      pid
    });
  }
  const nextPid = startManagedProcess(binary, configPath, logPath, pidFile, input.spawnImpl);
  return Object.freeze({
    implementationStatus: "shadowsocks-managed-process-restored",
    configPath,
    logPath,
    pid: nextPid
  });
}

export async function applySingBoxShadowsocksConfig(plan, input = {}) {
  const env = input.env ?? {};
  const configPath =
    plan.configPath ?? env.LUMEN_SHADOWSOCKS_CONFIG_FILE ?? DEFAULT_SING_BOX_SHADOWSOCKS_CONFIG_PATH;
  const binary = env.LUMEN_SHADOWSOCKS_BINARY ?? DEFAULT_SING_BOX_SHADOWSOCKS_BINARY;
  const runtimeConfig = renderSingBoxConfig(plan.config);

  if (input.dryRun !== false) {
    return Object.freeze({
      implementationStatus: "shadowsocks-dry-run",
      configPath
    });
  }

  mkdirSync(dirname(configPath), { recursive: true, mode: 0o700 });
  writeFileSync(configPath, `${JSON.stringify(runtimeConfig, null, 2)}\n`, { mode: 0o600 });
  await runExecFile(input.execFileImpl, binary, ["check", "-c", configPath]);
  const logPath = env.LUMEN_SHADOWSOCKS_LOG_FILE ?? DEFAULT_SING_BOX_SHADOWSOCKS_LOG_FILE;
  const pidFile = env.LUMEN_SHADOWSOCKS_PID_FILE ?? DEFAULT_SING_BOX_SHADOWSOCKS_PID_FILE;
  stopPid(pidFile);
  const pid = startManagedProcess(binary, configPath, logPath, pidFile, input.spawnImpl);
  return Object.freeze({
    implementationStatus: "shadowsocks-managed-process-started",
    configPath,
    logPath,
    pid,
    testCommand: `${binary} check -c ${configPath}`
  });
}

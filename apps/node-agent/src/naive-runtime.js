import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { promisify } from "node:util";
import { execFile as nodeExecFile, spawn } from "node:child_process";
import { applySingBoxPolicy } from "./sing-box-policy.js";

export const NAIVE_RUNTIME_MODEL_VERSION = "lumen.node-agent.naive-runtime.v1";
export const DEFAULT_NAIVE_CONFIG_PATH = "/var/lib/lumen-node/runtime/naive/config.json";
export const DEFAULT_NAIVE_LOG_FILE = "/var/lib/lumen-node/runtime/naive/sing-box.log";
export const DEFAULT_NAIVE_PID_FILE = "/var/lib/lumen-node/runtime/naive/sing-box.pid";
export const DEFAULT_NAIVE_BINARY = "sing-box";
export const DEFAULT_NAIVE_RELOAD_ARGV = Object.freeze(["systemctl", "restart", "naive-server"]);
export const NAIVE_RELOAD_MODE_PROCESS = "process";

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

function parseArgv(value, fallback) {
  if (!value) {
    return [...fallback];
  }
  const parsed = JSON.parse(value);
  if (
    !Array.isArray(parsed) ||
    parsed.some((part) => typeof part !== "string" || part.length === 0)
  ) {
    throw new Error("naive reload argv must be a JSON array of non-empty strings");
  }
  return parsed;
}

function summarizeArgv(argv) {
  return argv.join(" ");
}

function parseListen(value) {
  const listen = typeof value === "string" && value.length > 0 ? value : ":443";
  const match = listen.match(/^(.*):(\d+)$/);
  if (!match) {
    throw new Error("naiveConfig.listen must include a numeric port");
  }
  const port = Number.parseInt(match[2], 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("naiveConfig.listen port must be in 1..65535");
  }
  const host = match[1] || "::";
  return { host, port };
}

function validateNaiveConfig(config) {
  const errors = [];
  if (!isPlainObject(config)) {
    errors.push("naiveConfig must be an object");
  }
  if (typeof config?.listen !== "string" || config.listen.length === 0) {
    errors.push("naiveConfig.listen must be a non-empty string (e.g. ':443')");
  }
  if (!Array.isArray(config?.users) || config.users.length === 0) {
    errors.push("naiveConfig.users must contain at least one username/password pair");
  }
  for (const [index, user] of Object.entries(config?.users ?? [])) {
    if (
      !isPlainObject(user) ||
      typeof user.username !== "string" ||
      user.username.length === 0 ||
      typeof user.password !== "string" ||
      user.password.length === 0
    ) {
      errors.push(`naiveConfig.users[${index}] must include username and password`);
    }
  }
  const hasInlineTls =
    isPlainObject(config?.tls) &&
    typeof config.tls.cert === "string" &&
    typeof config.tls.key === "string";
  const hasAcme = isPlainObject(config?.acme);
  if (!hasInlineTls && !hasAcme) {
    errors.push("naiveConfig requires tls.cert+tls.key or an acme block");
  }
  const unresolved = assertNoUnresolvedRefs(config);
  if (unresolved.length > 0) {
    errors.push(`naiveConfig contains unresolved refs: ${unresolved.join(", ")}`);
  }
  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }
}

function singBoxTlsFromNaive(config) {
  if (isPlainObject(config.tls)) {
    const tls = { enabled: true };
    if (typeof config.tls.cert === "string") {
      tls.certificate_path = config.tls.cert;
    }
    if (typeof config.tls.key === "string") {
      tls.key_path = config.tls.key;
    }
    if (typeof config.tls.alpn === "string") {
      tls.alpn = config.tls.alpn.split(",").map((item) => item.trim()).filter(Boolean);
    } else if (Array.isArray(config.tls.alpn)) {
      tls.alpn = config.tls.alpn;
    }
    return tls;
  }
  return { enabled: true, acme: config.acme };
}

export function renderNaiveSingBoxConfig(config) {
  validateNaiveConfig(config);
  const { host, port } = parseListen(config.listen);
  return {
    log: { level: "info", timestamp: true },
    inbounds: [
      {
        type: "naive",
        tag: "naive-in",
        listen: host,
        listen_port: port,
        users: config.users.map((user) => ({
          username: String(user.username),
          password: String(user.password)
        })),
        tls: singBoxTlsFromNaive(config)
      }
    ],
    outbounds: [{ type: "direct", tag: "direct" }]
  };
}

export function createNaiveApplyPlan(input = {}) {
  const config = input.naiveConfig ?? input.config;
  validateNaiveConfig(config);
  return Object.freeze({
    modelVersion: NAIVE_RUNTIME_MODEL_VERSION,
    id: input.id,
    config,
    configPath: input.configPath,
    reloadArgv: input.reloadArgv
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

export async function ensureManagedNaiveProcess(input = {}) {
  const env = input.env ?? {};
  if (env.LUMEN_NAIVE_RELOAD_MODE !== NAIVE_RELOAD_MODE_PROCESS) {
    return null;
  }
  const configPath = env.LUMEN_NAIVE_CONFIG_FILE ?? DEFAULT_NAIVE_CONFIG_PATH;
  if (!existsSync(configPath)) {
    return null;
  }
  const binary = env.LUMEN_NAIVE_BINARY ?? DEFAULT_NAIVE_BINARY;
  const logPath = env.LUMEN_NAIVE_LOG_FILE ?? DEFAULT_NAIVE_LOG_FILE;
  const pidFile = env.LUMEN_NAIVE_PID_FILE ?? DEFAULT_NAIVE_PID_FILE;
  await runExecFile(input.execFileImpl, binary, ["check", "-c", configPath]);
  const pid = readPid(pidFile);
  if (isPidRunning(pid)) {
    return Object.freeze({
      implementationStatus: "naive-managed-process-running",
      configPath,
      logPath,
      pid
    });
  }
  const nextPid = startManagedProcess(binary, configPath, logPath, pidFile, input.spawnImpl);
  return Object.freeze({
    implementationStatus: "naive-managed-process-restored",
    configPath,
    logPath,
    pid: nextPid
  });
}

export async function applyNaiveConfig(plan, input = {}) {
  const env = input.env ?? {};
  const configPath = plan.configPath ?? env.LUMEN_NAIVE_CONFIG_FILE ?? DEFAULT_NAIVE_CONFIG_PATH;
  const binary = env.LUMEN_NAIVE_BINARY ?? DEFAULT_NAIVE_BINARY;
  const reloadMode = env.LUMEN_NAIVE_RELOAD_MODE ?? "";
  const reloadArgv =
    plan.reloadArgv ?? parseArgv(env.LUMEN_NAIVE_RELOAD_ARGV, DEFAULT_NAIVE_RELOAD_ARGV);
  const reloadCommand = [reloadArgv[0], reloadArgv.slice(1)];
  const runtimeConfig = reloadMode === NAIVE_RELOAD_MODE_PROCESS
    ? applySingBoxPolicy(renderNaiveSingBoxConfig(plan.config), input.nodePolicy)
    : plan.config;

  validateNaiveConfig(plan.config);

  if (input.dryRun !== false) {
    return Object.freeze({
      implementationStatus: "naive-dry-run",
      configPath,
      reloadCommand: summarizeArgv(reloadArgv)
    });
  }

  mkdirSync(dirname(configPath), { recursive: true, mode: 0o700 });
  writeFileSync(configPath, `${JSON.stringify(runtimeConfig, null, 2)}\n`, { mode: 0o600 });
  if (reloadMode === NAIVE_RELOAD_MODE_PROCESS) {
    await runExecFile(input.execFileImpl, binary, ["check", "-c", configPath]);
    const logPath = env.LUMEN_NAIVE_LOG_FILE ?? DEFAULT_NAIVE_LOG_FILE;
    const pidFile = env.LUMEN_NAIVE_PID_FILE ?? DEFAULT_NAIVE_PID_FILE;
    stopPid(pidFile);
    const pid = startManagedProcess(binary, configPath, logPath, pidFile, input.spawnImpl);
    return Object.freeze({
      implementationStatus: "naive-managed-process-started",
      configPath,
      logPath,
      pid,
      testCommand: summarizeArgv([binary, "check", "-c", configPath])
    });
  }
  await runExecFile(input.execFileImpl, reloadCommand[0], reloadCommand[1]);

  return Object.freeze({
    implementationStatus: "naive-applied",
    configPath,
    reloadCommand: summarizeArgv(reloadArgv)
  });
}

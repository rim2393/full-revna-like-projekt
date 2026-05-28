import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { promisify } from "node:util";
import { execFile as nodeExecFile } from "node:child_process";

export const XRAY_RUNTIME_MODEL_VERSION = "lumen.node-agent.xray-runtime.v1";
export const DEFAULT_XRAY_CONFIG_PATH = "/etc/xray/config.json";
export const DEFAULT_XRAY_BINARY = "xray";
export const DEFAULT_XRAY_RELOAD_ARGV = Object.freeze(["systemctl", "reload", "xray"]);

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
  if (!Array.isArray(parsed) || parsed.some((part) => typeof part !== "string" || part.length === 0)) {
    throw new Error("xray reload argv must be a JSON array of non-empty strings");
  }
  return parsed;
}

function summarizeArgv(argv) {
  return argv.join(" ");
}

function validateXrayConfig(config) {
  const errors = [];
  if (!isPlainObject(config)) {
    errors.push("xrayConfig must be an object");
  }
  if (!Array.isArray(config?.inbounds) || config.inbounds.length === 0) {
    errors.push("xrayConfig.inbounds must contain at least one inbound");
  }
  if (Array.isArray(config?.inbounds)) {
    config.inbounds.forEach((inbound, index) => {
      if (!isPlainObject(inbound)) {
        errors.push(`xrayConfig.inbounds[${index}] must be an object`);
        return;
      }
      if (typeof inbound.protocol !== "string" || inbound.protocol.length === 0) {
        errors.push(`xrayConfig.inbounds[${index}].protocol must be a non-empty string`);
      }
      if (!Number.isInteger(inbound.port) || inbound.port < 1 || inbound.port > 65535) {
        errors.push(`xrayConfig.inbounds[${index}].port must be an integer port`);
      }
    });
  }
  const unresolved = assertNoUnresolvedRefs(config);
  if (unresolved.length > 0) {
    errors.push(`xrayConfig contains unresolved refs: ${unresolved.join(", ")}`);
  }
  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }
}

export function createXrayApplyPlan(input = {}) {
  const config = input.xrayConfig ?? input.config;
  validateXrayConfig(config);
  return Object.freeze({
    modelVersion: XRAY_RUNTIME_MODEL_VERSION,
    id: input.id,
    config,
    configPath: input.configPath,
    xrayBinary: input.xrayBinary,
    reloadArgv: input.reloadArgv
  });
}

async function runExecFile(execFileImpl, command, args) {
  if (execFileImpl) {
    return await execFileImpl(command, args);
  }
  return await execFileAsync(command, args);
}

export async function applyXrayConfig(plan, input = {}) {
  const env = input.env ?? {};
  const configPath = plan.configPath ?? env.LUMEN_XRAY_CONFIG_FILE ?? DEFAULT_XRAY_CONFIG_PATH;
  const xrayBinary = plan.xrayBinary ?? env.LUMEN_XRAY_BINARY ?? DEFAULT_XRAY_BINARY;
  const reloadArgv = plan.reloadArgv ?? parseArgv(env.LUMEN_XRAY_RELOAD_ARGV, DEFAULT_XRAY_RELOAD_ARGV);
  const testArgv = [xrayBinary, ["-test", "-config", configPath]];
  const reloadCommand = [reloadArgv[0], reloadArgv.slice(1)];

  validateXrayConfig(plan.config);

  if (input.dryRun !== false) {
    return Object.freeze({
      implementationStatus: "xray-dry-run",
      configPath,
      testCommand: summarizeArgv([testArgv[0], ...testArgv[1]]),
      reloadCommand: summarizeArgv(reloadArgv)
    });
  }

  mkdirSync(dirname(configPath), { recursive: true, mode: 0o700 });
  writeFileSync(configPath, `${JSON.stringify(plan.config, null, 2)}\n`, { mode: 0o600 });
  await runExecFile(input.execFileImpl, testArgv[0], testArgv[1]);
  await runExecFile(input.execFileImpl, reloadCommand[0], reloadCommand[1]);

  return Object.freeze({
    implementationStatus: "xray-applied",
    configPath,
    testCommand: summarizeArgv([testArgv[0], ...testArgv[1]]),
    reloadCommand: summarizeArgv(reloadArgv)
  });
}

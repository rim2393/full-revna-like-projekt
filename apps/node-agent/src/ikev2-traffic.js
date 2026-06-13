import { execFile as nodeExecFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { DEFAULT_IKEV2_CONFIG_DIR, DEFAULT_IKEV2_RUNTIME_DIR } from "./ikev2-runtime.js";

export const DEFAULT_IKEV2_TRAFFIC_STATE_FILE = join(
  DEFAULT_IKEV2_RUNTIME_DIR,
  "ikev2-traffic-state.json"
);

const execFileAsync = promisify(nodeExecFile);

function parseNonNegativeInteger(value, fieldName) {
  if (!/^\d+$/.test(String(value))) {
    throw new Error(`ikev2 traffic ${fieldName} must be an unsigned integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`ikev2 traffic ${fieldName} exceeds safe integer range`);
  }
  return parsed;
}

function sumMatches(stdout, patterns) {
  let total = 0;
  for (const pattern of patterns) {
    for (const match of String(stdout).matchAll(pattern)) {
      total += parseNonNegativeInteger(match[1], "bytes");
    }
  }
  return total;
}

export function parseSwanctlListSasTraffic(stdout = "") {
  const rxBytes = sumMatches(stdout, [
    /\bbytes[-_](?:in|i|inbound|received)\b\s*[:=]?\s*(\d+)/gi,
    /\b(?:in|inbound|received)[-_]bytes\b\s*[:=]?\s*(\d+)/gi
  ]);
  const txBytes = sumMatches(stdout, [
    /\bbytes[-_](?:out|o|outbound|sent)\b\s*[:=]?\s*(\d+)/gi,
    /\b(?:out|outbound|sent)[-_]bytes\b\s*[:=]?\s*(\d+)/gi
  ]);
  return Object.freeze({ rxBytes, txBytes });
}

export function parseIpXfrmStateTraffic(stdout = "") {
  const totalBytes = sumMatches(stdout, [
    /\b(\d+)\s*\(\s*bytes\s*\)/gi,
    /\bbytes\b\s*[:=]\s*(\d+)/gi
  ]);
  return Object.freeze({ totalBytes });
}

function loadState(stateFile) {
  try {
    return JSON.parse(readFileSync(stateFile, "utf8"));
  } catch {
    return {};
  }
}

function writeState(stateFile, state) {
  mkdirSync(dirname(stateFile), { recursive: true, mode: 0o700 });
  writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}

function shouldCollectTraffic(env, configDir, existsSyncImpl) {
  if (env.LUMEN_IKEV2_TRAFFIC_ENABLED === "false") {
    return false;
  }
  if (env.LUMEN_IKEV2_TRAFFIC_ENABLED === "true") {
    return true;
  }
  return existsSyncImpl(join(configDir, "swanctl.conf"));
}

async function runExecFile(execFileImpl, command, args) {
  if (execFileImpl) {
    return await execFileImpl(command, args);
  }
  return await execFileAsync(command, args);
}

async function readSwanctlTraffic(execFileImpl) {
  const result = await runExecFile(execFileImpl, "swanctl", ["--list-sas", "--raw"]);
  return parseSwanctlListSasTraffic(result?.stdout ?? "");
}

async function readXfrmTraffic(execFileImpl) {
  const result = await runExecFile(execFileImpl, "ip", ["-s", "xfrm", "state"]);
  return parseIpXfrmStateTraffic(result?.stdout ?? "");
}

function delta(current, previous) {
  if (!Number.isFinite(previous)) {
    return 0;
  }
  return current >= previous ? current - previous : 0;
}

export async function collectIkev2TrafficMetrics(input = {}) {
  const env = input.env ?? {};
  const existsSyncImpl = input.existsSyncImpl ?? existsSync;
  const configDir = env.LUMEN_IKEV2_CONFIG_DIR ?? DEFAULT_IKEV2_CONFIG_DIR;
  if (!shouldCollectTraffic(env, configDir, existsSyncImpl)) {
    return Object.freeze({ values: Object.freeze({}), collected: false });
  }

  const stateFile = env.LUMEN_IKEV2_TRAFFIC_STATE_FILE ?? DEFAULT_IKEV2_TRAFFIC_STATE_FILE;
  const previous = loadState(stateFile);
  const errors = [];

  try {
    const current = await readSwanctlTraffic(input.execFileImpl);
    const rxDelta = delta(current.rxBytes, previous.rxBytes);
    const txDelta = delta(current.txBytes, previous.txBytes);
    writeState(stateFile, {
      source: "swanctl",
      rxBytes: current.rxBytes,
      txBytes: current.txBytes,
      totalBytes: current.rxBytes + current.txBytes,
      observedAt: new Date().toISOString()
    });
    return Object.freeze({
      values: Object.freeze({
        rx_bytes: rxDelta,
        tx_bytes: txDelta,
        ikev2_rx_bytes: rxDelta,
        ikev2_tx_bytes: txDelta,
        ikev2_cumulative_rx_bytes: current.rxBytes,
        ikev2_cumulative_tx_bytes: current.txBytes
      }),
      collected: true,
      source: "swanctl"
    });
  } catch (error) {
    errors.push(`swanctl: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const current = await readXfrmTraffic(input.execFileImpl);
    const totalDelta = delta(current.totalBytes, previous.totalBytes);
    writeState(stateFile, {
      source: "xfrm",
      rxBytes: current.totalBytes,
      txBytes: 0,
      totalBytes: current.totalBytes,
      observedAt: new Date().toISOString()
    });
    return Object.freeze({
      values: Object.freeze({
        rx_bytes: totalDelta,
        tx_bytes: 0,
        ikev2_rx_bytes: totalDelta,
        ikev2_tx_bytes: 0,
        ikev2_cumulative_rx_bytes: current.totalBytes,
        ikev2_cumulative_tx_bytes: 0,
        ikev2_traffic_direction_unknown: 1
      }),
      collected: true,
      source: "xfrm"
    });
  } catch (error) {
    errors.push(`xfrm: ${error instanceof Error ? error.message : String(error)}`);
  }

  return Object.freeze({
    values: Object.freeze({ ikev2_traffic_unavailable: 1 }),
    collected: false,
    errors
  });
}

export function resetIkev2TrafficState(input = {}) {
  const env = input.env ?? {};
  const stateFile = env.LUMEN_IKEV2_TRAFFIC_STATE_FILE ?? DEFAULT_IKEV2_TRAFFIC_STATE_FILE;
  writeState(stateFile, {
    rxBytes: 0,
    txBytes: 0,
    totalBytes: 0,
    resetAt: new Date().toISOString()
  });
  return stateFile;
}

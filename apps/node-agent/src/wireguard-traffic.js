import { execFile as nodeExecFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import { promisify } from "node:util";
import { DEFAULT_WIREGUARD_CONFIG_PATH } from "./wireguard-runtime.js";

export const DEFAULT_WIREGUARD_TRAFFIC_STATE_FILE =
  "/var/lib/lumen-node/runtime/wireguard-traffic-state.json";

const execFileAsync = promisify(nodeExecFile);

function parseNonNegativeInteger(value, fieldName) {
  if (!/^\d+$/.test(value)) {
    throw new Error(`wireguard transfer ${fieldName} must be an unsigned integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`wireguard transfer ${fieldName} exceeds safe integer range`);
  }
  return parsed;
}

function peerKeyHash(publicKey) {
  return createHash("sha256").update(publicKey).digest("hex").slice(0, 32);
}

export function parseWireguardTransferOutput(stdout = "") {
  const peers = [];
  for (const rawLine of String(stdout).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    const parts = line.split(/\s+/);
    if (parts.length !== 3) {
      throw new Error("wireguard transfer output must contain public key, rx bytes, and tx bytes");
    }
    const [publicKey, rxRaw, txRaw] = parts;
    if (!publicKey) {
      throw new Error("wireguard transfer public key is empty");
    }
    peers.push(Object.freeze({
      peerHash: peerKeyHash(publicKey),
      rxBytes: parseNonNegativeInteger(rxRaw, "rx_bytes"),
      txBytes: parseNonNegativeInteger(txRaw, "tx_bytes")
    }));
  }
  return Object.freeze(peers);
}

function interfaceNameFromConfigPath(configPath) {
  return basename(configPath).replace(/\.conf$/i, "");
}

function loadState(stateFile) {
  try {
    return JSON.parse(readFileSync(stateFile, "utf8"));
  } catch {
    return { peers: {} };
  }
}

function writeState(stateFile, state) {
  mkdirSync(dirname(stateFile), { recursive: true, mode: 0o700 });
  writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}

function shouldCollectTraffic(env, configPath, existsSyncImpl) {
  if (env.LUMEN_WIREGUARD_TRAFFIC_ENABLED === "false") {
    return false;
  }
  if (env.LUMEN_WIREGUARD_TRAFFIC_INTERFACE || env.LUMEN_WIREGUARD_INTERFACE) {
    return true;
  }
  return existsSyncImpl(configPath);
}

async function runExecFile(execFileImpl, command, args) {
  if (execFileImpl) {
    return await execFileImpl(command, args);
  }
  return await execFileAsync(command, args);
}

async function readTransferCounters({ execFileImpl, interfaceName, tools }) {
  const errors = [];
  for (const tool of tools) {
    try {
      const result = await runExecFile(execFileImpl, tool, ["show", interfaceName, "transfer"]);
      return Object.freeze({
        tool,
        peers: parseWireguardTransferOutput(result?.stdout ?? "")
      });
    } catch (error) {
      errors.push(`${tool}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return Object.freeze({ tool: null, peers: [], errors });
}

function computeDeltas(peers, previousPeers) {
  let rxDelta = 0;
  let txDelta = 0;
  let rxTotal = 0;
  let txTotal = 0;
  const nextPeers = {};

  for (const peer of peers) {
    rxTotal += peer.rxBytes;
    txTotal += peer.txBytes;
    const previous = previousPeers?.[peer.peerHash];
    if (previous && peer.rxBytes >= previous.rxBytes) {
      rxDelta += peer.rxBytes - previous.rxBytes;
    }
    if (previous && peer.txBytes >= previous.txBytes) {
      txDelta += peer.txBytes - previous.txBytes;
    }
    nextPeers[peer.peerHash] = { rxBytes: peer.rxBytes, txBytes: peer.txBytes };
  }

  return Object.freeze({ rxDelta, txDelta, rxTotal, txTotal, nextPeers });
}

export async function collectWireguardTrafficMetrics(input = {}) {
  const env = input.env ?? {};
  const existsSyncImpl = input.existsSyncImpl ?? existsSync;
  const configPath = env.LUMEN_WIREGUARD_CONFIG_FILE ?? DEFAULT_WIREGUARD_CONFIG_PATH;
  if (!shouldCollectTraffic(env, configPath, existsSyncImpl)) {
    return Object.freeze({ values: Object.freeze({}), collected: false });
  }

  const interfaceName =
    env.LUMEN_WIREGUARD_TRAFFIC_INTERFACE ??
    env.LUMEN_WIREGUARD_INTERFACE ??
    interfaceNameFromConfigPath(configPath);
  const stateFile =
    env.LUMEN_WIREGUARD_TRAFFIC_STATE_FILE ?? DEFAULT_WIREGUARD_TRAFFIC_STATE_FILE;
  const tools =
    env.LUMEN_WIREGUARD_TRAFFIC_TOOLS?.split(",").map((tool) => tool.trim()).filter(Boolean) ??
    ["wg", "awg"];

  const transfer = await readTransferCounters({
    execFileImpl: input.execFileImpl,
    interfaceName,
    tools
  });
  if (!transfer.tool) {
    return Object.freeze({
      values: Object.freeze({ wireguard_traffic_unavailable: 1 }),
      collected: false,
      interfaceName,
      errors: transfer.errors
    });
  }

  const state = loadState(stateFile);
  const deltas = computeDeltas(transfer.peers, state.peers ?? {});
  writeState(stateFile, {
    interfaceName,
    tool: transfer.tool,
    peers: deltas.nextPeers,
    observedAt: new Date().toISOString()
  });

  return Object.freeze({
    values: Object.freeze({
      rx_bytes: deltas.rxDelta,
      tx_bytes: deltas.txDelta,
      wireguard_peers: transfer.peers.length,
      wireguard_rx_bytes: deltas.rxDelta,
      wireguard_tx_bytes: deltas.txDelta,
      wireguard_cumulative_rx_bytes: deltas.rxTotal,
      wireguard_cumulative_tx_bytes: deltas.txTotal
    }),
    collected: true,
    interfaceName,
    tool: transfer.tool
  });
}

export function resetWireguardTrafficState(input = {}) {
  const env = input.env ?? {};
  const stateFile =
    env.LUMEN_WIREGUARD_TRAFFIC_STATE_FILE ?? DEFAULT_WIREGUARD_TRAFFIC_STATE_FILE;
  writeState(stateFile, {
    peers: {},
    resetAt: new Date().toISOString()
  });
  return stateFile;
}

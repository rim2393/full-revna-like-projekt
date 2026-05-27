import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  exchangeInstallToken,
  redactInstallTokenExchangeResponse,
  redactNodeResponse,
  sendHeartbeat
} from "./control-plane-client.js";
import { loadNodeAgentConfigFromEnv } from "./runtime-loop.js";
import { readSecretFromEnv } from "./secret-input.js";

const DEFAULT_STATE_DIR = "/var/lib/lumen-node";
const NODE_TOKEN_FILE = "node-token";
const HEARTBEAT_PATH_FILE = "heartbeat-path";

function readOptionalTrimmed(path) {
  try {
    const value = readFileSync(path, "utf8").trim();
    return value.length > 0 ? value : null;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function writeSecret(path, value) {
  writeFileSync(path, `${value}\n`, { mode: 0o600 });
}

function statePaths(env = {}) {
  const stateDir = env.LUMEN_STATE_DIR ?? DEFAULT_STATE_DIR;
  return Object.freeze({
    stateDir,
    nodeTokenFile: env.LUMEN_NODE_TOKEN_FILE ?? join(stateDir, NODE_TOKEN_FILE),
    heartbeatPathFile: env.LUMEN_HEARTBEAT_PATH_FILE ?? join(stateDir, HEARTBEAT_PATH_FILE)
  });
}

export async function enrollNodeAgent(input = {}) {
  const env = input.env ?? {};
  const config = input.config ?? loadNodeAgentConfigFromEnv(env);
  const paths = statePaths(env);
  mkdirSync(paths.stateDir, { recursive: true, mode: 0o700 });

  const existingNodeToken = readOptionalTrimmed(paths.nodeTokenFile);
  const existingHeartbeatPath = readOptionalTrimmed(paths.heartbeatPathFile);
  if (existingNodeToken) {
    return Object.freeze({
      config,
      heartbeatPath: existingHeartbeatPath,
      nodeToken: existingNodeToken,
      redactedExchange: null,
      reusedExistingToken: true
    });
  }

  const response = await exchangeInstallToken({
    controlPlaneBaseUrl: config.controlPlaneBaseUrl,
    fetchImpl: input.fetchImpl,
    installToken: readSecretFromEnv(env, "LUMEN_INSTALL_TOKEN")
  });

  writeSecret(paths.nodeTokenFile, response.node_token);
  writeFileSync(paths.heartbeatPathFile, `${response.heartbeat_path}\n`, { mode: 0o600 });

  return Object.freeze({
    config,
    heartbeatPath: response.heartbeat_path,
    nodeToken: response.node_token,
    redactedExchange: redactInstallTokenExchangeResponse(response),
    reusedExistingToken: false
  });
}

export async function runNodeAgentOnce(input = {}) {
  const enrollment = await enrollNodeAgent(input);
  const response = await sendHeartbeat({
    config: enrollment.config,
    fetchImpl: input.fetchImpl,
    heartbeatPath: enrollment.heartbeatPath ?? undefined,
    nodeToken: enrollment.nodeToken
  });

  return Object.freeze({
    exchange: enrollment.redactedExchange,
    heartbeat: redactNodeResponse(response),
    reusedExistingToken: enrollment.reusedExistingToken
  });
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function runNodeAgentLoop(input = {}) {
  const env = input.env ?? {};
  const config = input.config ?? loadNodeAgentConfigFromEnv(env);
  const once = input.once ?? false;
  let latest = null;

  do {
    latest = await runNodeAgentOnce({ ...input, config, env });
    if (once) {
      return latest;
    }
    await wait(config.heartbeatIntervalMs);
  } while (true);
}

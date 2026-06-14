import { accessSync, constants, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadNodeAgentConfigFromEnv } from "./runtime-loop.js";

export const NODE_AGENT_HEALTHCHECK_VERSION = "lumen.node-agent.healthcheck.v1";

const DEFAULT_STATE_DIR = "/var/lib/lumen-node";

function readTrimmedIfReadable(path) {
  try {
    const value = readFileSync(path, "utf8").trim();
    return value.length > 0 ? value : null;
  } catch (error) {
    if (["ENOENT", "EACCES"].includes(error?.code)) {
      return null;
    }
    throw error;
  }
}

function hasSecretValue(env, name) {
  if (typeof env[name] === "string" && env[name].trim().length > 0) {
    return true;
  }

  const filePath = env[`${name}_FILE`];
  return typeof filePath === "string"
    && filePath.trim().length > 0
    && readTrimmedIfReadable(filePath) !== null;
}

function assertReadableDirectory(path) {
  const stat = statSync(path);
  if (!stat.isDirectory()) {
    throw new Error(`state directory is not a directory: ${path}`);
  }
  accessSync(path, constants.R_OK);
}

export function runNodeAgentHealthcheck(input = {}) {
  const env = input.env ?? {};
  const config = input.config ?? loadNodeAgentConfigFromEnv(env);
  const stateDir = env.LUMEN_STATE_DIR ?? DEFAULT_STATE_DIR;

  assertReadableDirectory(stateDir);

  const nodeTokenFile = env.LUMEN_NODE_TOKEN_FILE ?? join(stateDir, "node-token");
  const heartbeatPathFile = env.LUMEN_HEARTBEAT_PATH_FILE ?? join(stateDir, "heartbeat-path");
  const hasNodeToken = hasSecretValue({
    ...env,
    LUMEN_NODE_TOKEN_FILE: nodeTokenFile
  }, "LUMEN_NODE_TOKEN");
  const hasHeartbeatPath = hasSecretValue({
    ...env,
    LUMEN_HEARTBEAT_PATH_FILE: heartbeatPathFile
  }, "LUMEN_HEARTBEAT_PATH");
  const enrolled = hasNodeToken && hasHeartbeatPath;
  const enrollable = hasSecretValue(env, "LUMEN_INSTALL_TOKEN");

  if (!enrolled && !enrollable) {
    throw new Error("node-agent is neither enrolled nor enrollable: missing node token/heartbeat path and install token");
  }

  return Object.freeze({
    reportVersion: NODE_AGENT_HEALTHCHECK_VERSION,
    status: "ok",
    nodeId: config.nodeId,
    stateDir,
    enrolled,
    enrollable
  });
}

import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import {
  collectWireguardTrafficMetrics,
  parseWireguardTransferOutput,
  resetWireguardTrafficState
} from "../src/wireguard-traffic.js";

const PEER_ONE = "nT6DbELaTQKwz43DUKvMT4T4/ePh6iR0LwW5bTZ0tSQ=";
const PEER_TWO = "3A0df0i9OmYAbmcDW0vJi5nm9XVM3GY31N+P6pkklU4=";

test("parses wireguard transfer output without exposing peer public keys", () => {
  const peers = parseWireguardTransferOutput(`${PEER_ONE}\t1024\t2048\n${PEER_TWO} 7 9\n`);

  assert.equal(peers.length, 2);
  assert.equal(peers[0].rxBytes, 1024);
  assert.equal(peers[0].txBytes, 2048);
  assert.notEqual(peers[0].peerHash, PEER_ONE);
  assert.equal(peers[0].peerHash.length, 32);
});

test("collects wireguard traffic as deltas and keeps cumulative counters separately", async () => {
  const dir = mkdtempSync(join(tmpdir(), "lumen-wg-traffic-"));
  const stateFile = join(dir, "wireguard-traffic-state.json");
  const calls = [];
  let stdout = `${PEER_ONE}\t1000\t2000\n${PEER_TWO}\t50\t75\n`;
  const execFileImpl = async (command, args) => {
    calls.push([command, ...args]);
    return { stdout };
  };

  const env = {
    LUMEN_WIREGUARD_TRAFFIC_INTERFACE: "lumen-wg",
    LUMEN_WIREGUARD_TRAFFIC_STATE_FILE: stateFile
  };

  const first = await collectWireguardTrafficMetrics({ env, execFileImpl });
  assert.equal(first.collected, true);
  assert.deepEqual(calls[0], ["wg", "show", "lumen-wg", "transfer"]);
  assert.equal(first.values.rx_bytes, 0);
  assert.equal(first.values.tx_bytes, 0);
  assert.equal(first.values.wireguard_cumulative_rx_bytes, 1050);
  assert.equal(first.values.wireguard_cumulative_tx_bytes, 2075);

  stdout = `${PEER_ONE}\t1600\t2600\n${PEER_TWO}\t70\t175\n`;
  const second = await collectWireguardTrafficMetrics({ env, execFileImpl });
  assert.equal(second.values.rx_bytes, 620);
  assert.equal(second.values.tx_bytes, 700);
  assert.equal(second.values.wireguard_rx_bytes, 620);
  assert.equal(second.values.wireguard_tx_bytes, 700);
  assert.match(readFileSync(stateFile, "utf8"), /"interfaceName": "lumen-wg"/);
});

test("falls back from wg to awg for AmneziaWG transfer counters", async () => {
  const dir = mkdtempSync(join(tmpdir(), "lumen-awg-traffic-"));
  const calls = [];
  const execFileImpl = async (command, args) => {
    calls.push([command, ...args]);
    if (command === "wg") {
      throw new Error("Operation not supported");
    }
    return { stdout: `${PEER_ONE}\t5\t11\n` };
  };

  const result = await collectWireguardTrafficMetrics({
    env: {
      LUMEN_WIREGUARD_TRAFFIC_INTERFACE: "lumen-wg",
      LUMEN_WIREGUARD_TRAFFIC_STATE_FILE: join(dir, "state.json")
    },
    execFileImpl
  });

  assert.equal(result.collected, true);
  assert.equal(result.tool, "awg");
  assert.deepEqual(calls, [
    ["wg", "show", "lumen-wg", "transfer"],
    ["awg", "show", "lumen-wg", "transfer"]
  ]);
});

test("does not probe wireguard tools when runtime config is absent", async () => {
  let execCalls = 0;
  const result = await collectWireguardTrafficMetrics({
    env: {
      LUMEN_WIREGUARD_CONFIG_FILE: "/not-installed/lumen-wg.conf"
    },
    existsSyncImpl: () => false,
    execFileImpl: async () => {
      execCalls += 1;
      return { stdout: "" };
    }
  });

  assert.equal(result.collected, false);
  assert.equal(execCalls, 0);
  assert.deepEqual(result.values, {});
});

test("reset clears wireguard traffic baseline state", () => {
  const dir = mkdtempSync(join(tmpdir(), "lumen-wg-reset-"));
  const stateFile = join(dir, "state.json");

  const result = resetWireguardTrafficState({
    env: {
      LUMEN_WIREGUARD_TRAFFIC_STATE_FILE: stateFile
    }
  });

  assert.equal(result, stateFile);
  assert.match(readFileSync(stateFile, "utf8"), /"peers": \{\}/);
});

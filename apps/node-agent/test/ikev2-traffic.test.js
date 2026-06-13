import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import {
  collectIkev2TrafficMetrics,
  parseIpXfrmStateTraffic,
  parseSwanctlListSasTraffic,
  resetIkev2TrafficState
} from "../src/ikev2-traffic.js";

test("parses swanctl IKEv2 byte counters across common raw formats", () => {
  const parsed = parseSwanctlListSasTraffic(`
lumen-ikev2: #1, ESTABLISHED
  child-sas {
    lumen-ikev2 {
      bytes-in = 1024
      bytes-out = 2048
    }
    second {
      inbound-bytes: 7
      outbound_bytes: 9
    }
  }
`);

  assert.equal(parsed.rxBytes, 1031);
  assert.equal(parsed.txBytes, 2057);
});

test("parses xfrm state byte counters as direction-unknown total", () => {
  const parsed = parseIpXfrmStateTraffic(`
src 85.192.60.8 dst 10.92.0.2
  lifetime current:
    12345(bytes), 12(packets)
src 10.92.0.2 dst 85.192.60.8
  lifetime current:
    55(bytes), 2(packets)
`);

  assert.equal(parsed.totalBytes, 12400);
});

test("collects IKEv2 swanctl counters as deltas and shared traffic bytes", async () => {
  const dir = mkdtempSync(join(tmpdir(), "lumen-ikev2-traffic-"));
  const stateFile = join(dir, "ikev2-traffic-state.json");
  let stdout = "bytes-in = 1000\nbytes-out = 2000\n";
  const calls = [];
  const execFileImpl = async (command, args) => {
    calls.push([command, ...args]);
    return { stdout };
  };
  const env = {
    LUMEN_IKEV2_TRAFFIC_ENABLED: "true",
    LUMEN_IKEV2_TRAFFIC_STATE_FILE: stateFile
  };

  const first = await collectIkev2TrafficMetrics({ env, execFileImpl });
  assert.equal(first.collected, true);
  assert.equal(first.source, "swanctl");
  assert.deepEqual(calls[0], ["swanctl", "--list-sas", "--raw"]);
  assert.equal(first.values.rx_bytes, 0);
  assert.equal(first.values.tx_bytes, 0);
  assert.equal(first.values.ikev2_cumulative_rx_bytes, 1000);
  assert.equal(first.values.ikev2_cumulative_tx_bytes, 2000);

  stdout = "bytes-in = 1750\nbytes-out = 2250\n";
  const second = await collectIkev2TrafficMetrics({ env, execFileImpl });
  assert.equal(second.values.rx_bytes, 750);
  assert.equal(second.values.tx_bytes, 250);
  assert.equal(second.values.ikev2_cumulative_rx_bytes, 1750);
  assert.equal(second.values.ikev2_cumulative_tx_bytes, 2250);
  assert.match(readFileSync(stateFile, "utf8"), /"source": "swanctl"/);
});

test("falls back to xfrm counters when swanctl counters are unavailable", async () => {
  const dir = mkdtempSync(join(tmpdir(), "lumen-ikev2-xfrm-"));
  const calls = [];
  const execFileImpl = async (command, args) => {
    calls.push([command, ...args]);
    if (command === "swanctl") {
      throw new Error("charon.vici unavailable");
    }
    return { stdout: "lifetime current:\n  4096(bytes), 4(packets)\n" };
  };

  const result = await collectIkev2TrafficMetrics({
    env: {
      LUMEN_IKEV2_TRAFFIC_ENABLED: "true",
      LUMEN_IKEV2_TRAFFIC_STATE_FILE: join(dir, "state.json")
    },
    execFileImpl
  });

  assert.equal(result.collected, true);
  assert.equal(result.source, "xfrm");
  assert.equal(result.values.rx_bytes, 0);
  assert.equal(result.values.tx_bytes, 0);
  assert.equal(result.values.ikev2_cumulative_rx_bytes, 4096);
  assert.equal(result.values.ikev2_traffic_direction_unknown, 1);
  assert.deepEqual(calls, [
    ["swanctl", "--list-sas", "--raw"],
    ["ip", "-s", "xfrm", "state"]
  ]);
});

test("does not collect IKEv2 traffic when runtime config is absent", async () => {
  let execCalls = 0;
  const result = await collectIkev2TrafficMetrics({
    env: {
      LUMEN_IKEV2_CONFIG_DIR: "/not-installed/swanctl"
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

test("reset clears IKEv2 traffic baseline state", () => {
  const dir = mkdtempSync(join(tmpdir(), "lumen-ikev2-reset-"));
  const stateFile = join(dir, "state.json");

  const result = resetIkev2TrafficState({
    env: {
      LUMEN_IKEV2_TRAFFIC_STATE_FILE: stateFile
    }
  });

  assert.equal(result, stateFile);
  assert.match(readFileSync(stateFile, "utf8"), /"totalBytes": 0/);
});

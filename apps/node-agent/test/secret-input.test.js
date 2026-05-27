import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readSecretFromEnv } from "../src/index.js";

test("reads direct secret env value and trims whitespace", () => {
  assert.equal(readSecretFromEnv({ LUMEN_INSTALL_TOKEN: " token-value \n" }, "LUMEN_INSTALL_TOKEN"), "token-value");
});

test("reads secret env value from file without exposing file path in return", () => {
  const dir = mkdtempSync(join(tmpdir(), "lumen-agent-secret-"));
  try {
    const file = join(dir, "install-token");
    writeFileSync(file, "file-token\n", { mode: 0o600 });

    assert.equal(readSecretFromEnv({ LUMEN_INSTALL_TOKEN_FILE: file }, "LUMEN_INSTALL_TOKEN"), "file-token");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

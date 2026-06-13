import { readFileSync } from "node:fs";

export function readSecretFromEnv(env = {}, name) {
  const directValue = env[name];
  if (typeof directValue === "string" && directValue.trim().length > 0) {
    return directValue.trim();
  }

  const filePath = env[`${name}_FILE`];
  if (typeof filePath === "string" && filePath.trim().length > 0) {
    return readFileSync(filePath, "utf8").trim();
  }

  throw new Error(`${name} or ${name}_FILE is required`);
}

#!/usr/bin/env node

import { buildNodeAgentDryRun } from "./runtime-loop.js";

function printHelp() {
  console.log([
    "Usage: lumen-node-agent --dry-run",
    "",
    "Prints the node-agent config and heartbeat payload without making network calls."
  ].join("\n"));
}

function main(argv, env) {
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    return 0;
  }

  const report = buildNodeAgentDryRun({ env });
  console.log(JSON.stringify(report, null, 2));
  return 0;
}

try {
  process.exitCode = main(process.argv.slice(2), process.env);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

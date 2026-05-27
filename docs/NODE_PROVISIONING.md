# Lumen Node Provisioning Scaffold

This document defines the first local contract surface for `apps/node-agent`.

## Scope

The node agent scaffold owns local provisioning models only:

- outbound plan records
- provisioning job and result envelopes
- system capability reports
- port and local system conflict detection

It does not contain live protocol implementation, runtime secrets, generated client configs, install scripts, or backend control-plane code.

## Outbound Plan Model

Source: `apps/node-agent/src/outbound-model.js`

Version: `lumen.node-agent.outbound.v1`

Required fields:

- `id`
- `nodeId`
- `protocol`
- `adapter`
- `endpoint.host`
- `endpoint.port`
- `credentialsRef`

`credentialsRef` is the only supported credential carrier in this scaffold. Inline `password`, `token`, `privateKey`, subscription URL, generated runtime config, and similar secret-like fields are rejected.

## Provisioning Jobs

Source: `apps/node-agent/src/provisioning-contracts.js`

Version: `lumen.node-agent.provisioning-job.v1`

Initial job kinds:

- `node.provision`
- `node.deprovision`
- `outbound.apply`
- `outbound.remove`
- `capabilities.report`
- `conflict.scan`

Jobs must be idempotent by `idempotencyKey`. Results preserve `jobId`, `nodeId`, terminal status, outputs, conflicts, and error state. Outputs are checked for secret-like inline fields.

## System Capabilities

Source: `apps/node-agent/src/system-capabilities.js`

The first registry includes service manager, firewall, TUN, IPv6, QUIC/UDP, privileged bind, WireGuard kernel, sing-box, Xray-core, and Docker capabilities. Unknown capability keys are preserved as booleans so later probes can add non-breaking checks.

## Conflict Model

Source: `apps/node-agent/src/conflict-model.js`

Version: `lumen.node-agent.conflict.v1`

The scaffold detects:

- overlapping exclusive address/port/protocol reservations
- privileged port usage without `bind.privileged_ports`

## TODO

- Wire capability reports to real OS probes per platform.
- Add durable provisioning queue storage and retry policy.
- Add signed job source verification before accepting control-plane commands.
- Add service manager and firewall apply backends.
- Extend conflict detection to reserved paths, process ownership, and exclusive protocol runtimes.

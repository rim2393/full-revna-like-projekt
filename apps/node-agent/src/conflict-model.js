import { SYSTEM_CAPABILITIES, hasCapability } from "./system-capabilities.js";

export const CONFLICT_MODEL_VERSION = "lumen.node-agent.conflict.v1";

export const CONFLICT_TYPES = Object.freeze({
  PORT_IN_USE: "port_in_use",
  PRIVILEGED_PORT: "privileged_port",
  MISSING_CAPABILITY: "missing_capability",
  EXCLUSIVE_BIND: "exclusive_bind",
  RESERVED_SYSTEM_PATH: "reserved_system_path"
});

function assertPort(port) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("port must be an integer between 1 and 65535");
  }
}

function normalizeAddress(address) {
  return address ?? "0.0.0.0";
}

function normalizeProtocol(protocol) {
  return (protocol ?? "tcp").toLowerCase();
}

function addressesOverlap(left, right) {
  return left === right || left === "0.0.0.0" || right === "0.0.0.0" || left === "::" || right === "::" || left === "*" || right === "*";
}

function reservationsOverlap(left, right) {
  return left.port === right.port &&
    left.protocol === right.protocol &&
    addressesOverlap(left.address, right.address);
}

export function createPortReservation(input = {}) {
  assertPort(input.port);

  return Object.freeze({
    modelVersion: CONFLICT_MODEL_VERSION,
    ownerId: input.ownerId,
    address: normalizeAddress(input.address),
    port: input.port,
    protocol: normalizeProtocol(input.protocol),
    purpose: input.purpose ?? "outbound-listener",
    exclusive: input.exclusive ?? true
  });
}

export function detectPortConflicts(reservations = [], capabilityReport = null) {
  const normalized = reservations.map(createPortReservation);
  const conflicts = [];

  for (let index = 0; index < normalized.length; index += 1) {
    const reservation = normalized[index];

    if (reservation.port < 1024 && !hasCapability(capabilityReport, SYSTEM_CAPABILITIES.BIND_PRIVILEGED_PORTS)) {
      conflicts.push(Object.freeze({
        modelVersion: CONFLICT_MODEL_VERSION,
        type: CONFLICT_TYPES.PRIVILEGED_PORT,
        severity: "blocking",
        port: reservation.port,
        protocol: reservation.protocol,
        ownerIds: Object.freeze([reservation.ownerId]),
        message: "Binding ports below 1024 requires bind.privileged_ports capability."
      }));
    }

    for (let nextIndex = index + 1; nextIndex < normalized.length; nextIndex += 1) {
      const other = normalized[nextIndex];
      if (reservationsOverlap(reservation, other) && (reservation.exclusive || other.exclusive)) {
        conflicts.push(Object.freeze({
          modelVersion: CONFLICT_MODEL_VERSION,
          type: CONFLICT_TYPES.PORT_IN_USE,
          severity: "blocking",
          port: reservation.port,
          protocol: reservation.protocol,
          ownerIds: Object.freeze([reservation.ownerId, other.ownerId]),
          message: "Two reservations overlap on the same address, port, and protocol."
        }));
      }
    }
  }

  return Object.freeze(conflicts);
}

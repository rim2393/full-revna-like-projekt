export const SYSTEM_CAPABILITY_REPORT_VERSION = "lumen.node-agent.system-capabilities.v1";

export const SYSTEM_CAPABILITIES = Object.freeze({
  SERVICE_SYSTEMD: "service.systemd",
  SERVICE_LAUNCHD: "service.launchd",
  SERVICE_WINDOWS_SERVICE: "service.windows",
  FIREWALL_NFTABLES: "firewall.nftables",
  FIREWALL_IPTABLES: "firewall.iptables",
  FIREWALL_WINDOWS: "firewall.windows",
  TUN_DEVICE: "network.tun",
  IPV6: "network.ipv6",
  UDP_QUIC: "network.udp_quic",
  BIND_PRIVILEGED_PORTS: "bind.privileged_ports",
  WIREGUARD_KERNEL: "protocol.wireguard_kernel",
  IPSEC_KERNEL: "protocol.ipsec_kernel",
  SING_BOX: "runtime.sing_box",
  XRAY_CORE: "runtime.xray_core",
  STRONGSWAN: "runtime.strongswan",
  DOCKER: "runtime.docker"
});

function normalizeCapabilities(capabilities = {}) {
  const normalized = {};
  for (const key of Object.values(SYSTEM_CAPABILITIES)) {
    normalized[key] = Boolean(capabilities[key]);
  }

  for (const [key, value] of Object.entries(capabilities)) {
    if (!(key in normalized)) {
      normalized[key] = Boolean(value);
    }
  }

  return Object.freeze(normalized);
}

export function createSystemCapabilityReport(input = {}) {
  if (typeof input.nodeId !== "string" || input.nodeId.length === 0) {
    throw new Error("nodeId is required for a system capability report");
  }

  return Object.freeze({
    reportVersion: SYSTEM_CAPABILITY_REPORT_VERSION,
    nodeId: input.nodeId,
    observedAt: input.observedAt ?? new Date().toISOString(),
    capabilities: normalizeCapabilities(input.capabilities),
    facts: Object.freeze({ ...(input.facts ?? {}) })
  });
}

export function hasCapability(report, capability) {
  return Boolean(report?.capabilities?.[capability]);
}

export function missingCapabilities(report, requiredCapabilities = []) {
  return Object.freeze(requiredCapabilities.filter((capability) => !hasCapability(report, capability)));
}

export const SING_BOX_POLICY_MODEL_VERSION = "lumen.node-agent.sing-box-policy.v1";

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringList(value) {
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return [];
}

function policyPlugins(policy) {
  if (!isPlainObject(policy) || !Array.isArray(policy.plugins)) {
    return [];
  }
  return policy.plugins.filter((plugin) => isPlainObject(plugin) && plugin.enabled !== false);
}

function blockingRulesFromPolicy(policy) {
  const rules = [];
  for (const plugin of policyPlugins(policy)) {
    const config = isPlainObject(plugin.config) ? plugin.config : {};
    const action = String(config.action ?? config.mode ?? "block");
    if (!["block", "drop", "blackhole"].includes(action)) {
      continue;
    }
    if (plugin.kind === "torrent-blocker") {
      rules.push({ protocol: ["bittorrent"], outbound: "blocked" });
    }
    if (plugin.kind === "domain-filter") {
      const domains = stringList(config.domains);
      if (domains.length > 0) {
        rules.push({ domain: domains, outbound: "blocked" });
      }
    }
    if (plugin.kind === "geoip-filter") {
      const countries = stringList(config.countries ?? config.geoip);
      if (countries.length > 0) {
        rules.push({ geoip: countries.map((country) => country.toLowerCase()), outbound: "blocked" });
      }
    }
  }
  return rules;
}

export function applySingBoxPolicy(config, policy) {
  if (!isPlainObject(config)) {
    throw new Error("sing-box config must be an object");
  }
  const rules = blockingRulesFromPolicy(policy);
  if (rules.length === 0) {
    return config;
  }
  const nextConfig = {
    ...config,
    outbounds: Array.isArray(config.outbounds) ? [...config.outbounds] : [],
    route: isPlainObject(config.route) ? { ...config.route } : {}
  };
  if (!nextConfig.outbounds.some((outbound) => isPlainObject(outbound) && outbound.tag === "blocked")) {
    nextConfig.outbounds.push({ type: "block", tag: "blocked" });
  }
  const existingRules = Array.isArray(nextConfig.route.rules) ? nextConfig.route.rules : [];
  nextConfig.route.rules = [...rules, ...existingRules];
  nextConfig.route.final = String(nextConfig.route.final ?? "direct");
  return nextConfig;
}

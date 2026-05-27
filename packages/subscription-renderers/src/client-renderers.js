import { assertValidSubscriptionManifest } from "../../subscription-schema/src/index.js";
import { renderJsonManifest } from "./json-renderer.js";

export const SUPPORTED_RENDER_FORMATS = Object.freeze([
  "lumen-json",
  "sing-box-skeleton",
  "clash-meta-skeleton"
]);

function flattenProtocolEntries(manifest) {
  return manifest.nodes.flatMap((node) =>
    node.protocols.map((protocol) => ({
      tag: `${node.id}-${protocol.type}`,
      node,
      protocol
    }))
  );
}

function mapSingBoxType(type) {
  if (type === "hysteria2") {
    return "hysteria2";
  }
  if (type === "shadowsocks") {
    return "shadowsocks";
  }
  return type;
}

export function renderSingBoxSkeleton(manifest) {
  assertValidSubscriptionManifest(manifest);

  const entries = flattenProtocolEntries(manifest);
  return Object.freeze({
    schemaVersion: "lumen.sing-box-skeleton.v1",
    note: "Skeleton only. Resolve credentialsRef out of band before producing a runnable client config.",
    outbounds: Object.freeze(
      entries.map(({ tag, node, protocol }) =>
        Object.freeze({
          tag,
          type: mapSingBoxType(protocol.type),
          server: protocol.endpoint.host,
          server_port: protocol.endpoint.port,
          transport: protocol.endpoint.transport,
          region: node.region,
          credentials_ref: protocol.credentialsRef,
          implementation_status: "placeholder"
        })
      )
    )
  });
}

function yamlScalar(value) {
  return JSON.stringify(String(value));
}

export function renderClashMetaSkeleton(manifest) {
  assertValidSubscriptionManifest(manifest);

  const lines = [
    "# Lumen Clash Meta skeleton. Credentials are resolved out of band.",
    "proxies:"
  ];

  for (const { tag, node, protocol } of flattenProtocolEntries(manifest)) {
    lines.push(`  - name: ${yamlScalar(tag)}`);
    lines.push(`    type: ${yamlScalar(protocol.type)}`);
    lines.push(`    server: ${yamlScalar(protocol.endpoint.host)}`);
    lines.push(`    port: ${protocol.endpoint.port}`);
    lines.push(`    region: ${yamlScalar(node.region)}`);
    lines.push(`    lumen_credentials_ref: ${yamlScalar(protocol.credentialsRef)}`);
    lines.push("    lumen_implementation_status: placeholder");
  }

  return `${lines.join("\n")}\n`;
}

export function renderClientSubscription(manifest, format, options = {}) {
  if (!SUPPORTED_RENDER_FORMATS.includes(format)) {
    throw new Error(`Unsupported subscription render format: ${format}`);
  }

  if (format === "lumen-json") {
    return renderJsonManifest(manifest, options);
  }

  if (format === "sing-box-skeleton") {
    const skeleton = renderSingBoxSkeleton(manifest);
    return `${JSON.stringify(skeleton, null, options.space ?? 2)}\n`;
  }

  return renderClashMetaSkeleton(manifest);
}

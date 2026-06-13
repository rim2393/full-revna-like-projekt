import { assertValidSubscriptionManifest } from "../../subscription-schema/src/index.js";

export function renderJsonManifest(manifest, options = {}) {
  const space = options.space ?? 2;
  assertValidSubscriptionManifest(manifest);
  return `${JSON.stringify(manifest, null, space)}\n`;
}

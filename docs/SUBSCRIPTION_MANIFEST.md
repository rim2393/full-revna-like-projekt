# Lumen Subscription Manifest Scaffold

Source packages:

- `packages/subscription-schema`
- `packages/subscription-renderers`

## Manifest Version

Version: `lumen.subscription-manifest.v1`

The manifest is a neutral subscription description. It carries provider metadata, subscription metadata, node entries, protocol endpoint metadata, renderer hints, and credential references.

## Required Shape

Top-level fields:

- `schemaVersion`
- `generatedAt`
- `provider.id`
- `provider.name`
- `subscription.id`
- `subscription.audience`
- `nodes`
- `renderHints`

Each node must include at least one protocol entry. Each protocol entry requires:

- `type`
- `adapter`
- `endpoint.host`
- `endpoint.port`
- `credentialsRef`

Supported scaffold protocols:

- `vless`
- `trojan`
- `shadowsocks`
- `wireguard`
- `hysteria2`

## Secret Handling

The schema rejects secret-like inline keys such as `password`, `token`, `privateKey`, `subscriptionUrl`, and generated runtime config fields. The manifest stores references only.

## Renderers

Initial scaffold renderers:

- `lumen-json`
- `sing-box-skeleton`
- `clash-meta-skeleton`

The skeleton renderers are intentionally not runnable client configs. They preserve endpoint and credential reference metadata so later secure render stages can resolve credentials out of band.

## TODO

- Add JSON Schema export once the final manifest version is stable.
- Add manifest signing and freshness fields.
- Add client capability targeting and per-client renderer feature flags.
- Add migration tests between manifest versions.
- Add secure handoff from credential resolver to final client config renderer.

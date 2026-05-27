# Lumen Protocol Registry Scaffold

Source package: `packages/protocol-registry`

## Adapter Contract

Version: `lumen.protocol-adapter.v1`

An adapter descriptor contains:

- `protocol`
- `displayName`
- `status`
- `capabilities`
- `requiredCredentialRefs`
- `rendererHints`
- `planOutbound(request)`

`requiredCredentialRefs` names reference slots, not credential values. Adapter implementations must consume secret material only through a runtime resolver outside this package.

## Initial Placeholders

The scaffold registers placeholder adapters for:

- VLESS
- Trojan
- Shadowsocks
- WireGuard
- Hysteria2

All are marked `placeholder`. Their `planOutbound` method returns `implementationStatus: "not-implemented"` and must not be used for live traffic.

## Renderer Hints

Renderer hints provide stable protocol naming for future client formats such as sing-box and Clash Meta. They are not executable configs.

## TODO

- Add adapter compliance tests before marking any protocol `experimental`.
- Define runtime credential resolver interface.
- Add per-protocol capability requirements and transport validation.
- Add protocol-specific renderer contracts once client targets are finalized.
- Keep live protocol binaries and generated configs outside this registry package.

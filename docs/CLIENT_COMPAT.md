# Lumen Client Compatibility Scaffold

This document tracks intended client compatibility for subscription renderers.

## Current Status

No renderer in this scaffold produces a live production subscription. The current outputs are:

- `lumen-json`: canonical internal manifest JSON
- `sing-box-skeleton`: non-runnable sing-box-like shape
- `clash-meta-skeleton`: non-runnable Clash Meta-like shape

All outputs carry `credentialsRef` or `lumen_credentials_ref` values instead of secrets.

## Compatibility Matrix

| Format | Target | Status | Notes |
| --- | --- | --- | --- |
| `lumen-json` | Lumen clients | Scaffold | Stable internal shape, no inline secrets |
| `sing-box-skeleton` | sing-box family | Placeholder | Needs secure credential resolution and protocol-specific fields |
| `clash-meta-skeleton` | Clash Meta family | Placeholder | Needs YAML serializer and protocol-specific fields |

## Fallback Landing

`apps/lumen-edge/src/fallback-landing.js` defines `lumen.edge.fallback-landing.v1` for edge fallback responses. The model reports fallback status, reason, host, request ID, safe diagnostics, and non-secret action links.

## TODO

- Define minimum supported versions for each target client.
- Add protocol-by-client feature matrix.
- Add renderer fixture tests from real client parsers once formats are executable.
- Add negative tests that fail on inline secrets or subscription URLs.
- Add localized fallback landing copy after product text is approved.

# Decisions

## Public repo scope

This repo is the public open-source monorepo for Lumen VPN. Backend, node-agent,
web UI, deployment templates, release metadata, and operator docs are intended
to live here.

## Secrets

Runtime secrets are generated on the target host. Public templates use
placeholders and file paths only.

## Images

All production images are configured through environment variables and must be
pinned by digest from a release manifest.

## Product access

Lumen VPN is distributed as an open-source self-hosted project. Access control
is handled by normal admin/user permissions and server operation policy.

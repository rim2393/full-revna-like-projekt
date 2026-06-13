# Remaining work

- Public release images must provide the CLI entrypoints used by the installer:
  `lumen-api migrate`, `lumen-api bootstrap-admin`, `lumen-api healthcheck`,
  and node-agent registration commands.
- Release manifests must be generated, signed, and published by the open-source
  release pipeline.
- End-to-end install validation on fresh Debian/Ubuntu VPS images is still
  required.
- The typed `lumenctl` command is not included in this public Bash scaffold.
- Panel-initiated SSH push node provisioning is not supported in the current
  public release path. The supported node path is token-based bootstrap with
  `scripts/install-node.sh`.

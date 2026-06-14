# Remaining work

- Public release images still need to be built, signed, and published from the
  current source. The source image definitions now provide the installer
  entrypoints: `lumen-api migrate`, `lumen-api bootstrap-admin`,
  `lumen-api healthcheck`, and `lumen-node-agent healthcheck`.
- Release manifests must be generated, signed, and published by the open-source
  release pipeline.
- End-to-end install validation on fresh Debian/Ubuntu VPS images is still
  required.
- The typed `lumenctl` command is not included in this public Bash scaffold.
- Panel-initiated SSH push node provisioning is not supported in the current
  public release path. The supported node path is token-based bootstrap with
  `scripts/install-node.sh`.

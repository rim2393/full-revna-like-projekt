# Remaining work

- Public release images and a signed release manifest are produced by the
  GitHub release pipeline. The current production server was upgraded from a
  pinned manifest, and CI also validates the installer dry-run path.
- End-to-end install validation on fresh Debian/Ubuntu VPS images is still
  required before claiming fresh-host install completion.
- The typed `lumenctl` command is not included in this public Bash scaffold.
- Panel-initiated SSH push node provisioning is not supported in the current
  public release path. The supported node path is token-based bootstrap with
  `scripts/install-node.sh`.

# Release Checklist

## v0.1.0-prototype Gate

- [ ] Public installer repo contains no private source code.
- [ ] Private Docker images build and are version-pinned.
- [ ] Clean VPS panel install completes.
- [ ] Nginx and acme.sh TLS works.
- [ ] First admin login works.
- [ ] RBAC checks enforce backend permissions.
- [ ] API keys are scoped, hash-stored, and shown once.
- [ ] Free three-node license mode works.
- [ ] Paid node pause/resume works.
- [ ] Push node provisioning from panel works.
- [ ] Fallback pull node install exists.
- [ ] Node-agent connects outbound.
- [ ] Protocol framework exists.
- [ ] Protocol adapters pass install/remove/health/export/conflict tests one by
      one.
- [ ] `lumen.subscription.v1` validates.
- [ ] Sing-box and Mihomo renderers validate.
- [ ] Client fixtures parse.
- [ ] Backup works.
- [ ] Restore path is tested or documented as incomplete in `REMAINING.md`.
- [ ] Support bundle redacts secrets.
- [ ] CI checks are green or failures are documented in `REMAINING.md`.

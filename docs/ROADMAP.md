# Roadmap

## v0.1.0-prototype

1. Repository scaffolds and control documents.
2. Public installer repository with Nginx, acme.sh, compose templates, and
   safe scripts.
3. Private control-plane scaffold: API, web, node-agent, edge, subscription
   packages.
4. License server scaffold with offline signed license model and mock billing
   adapter.
5. Security core: admin auth, sessions, API keys, RBAC, audit, emergency mode.
6. Node provisioning: push by SSH from panel, fallback pull install, outbound
   agent channel.
7. Protocol framework: adapter contract, capability registry, system conflict
   detection, desired/actual config drift.
8. Protocols one by one: add, test, then continue.
9. Subscription manifest v1 and renderers.
10. Lumen Guard and admin UI screens.
11. Backup, restore, upgrade, doctor, support bundle.
12. Client compatibility fixtures and Android parser pass.

## v1.0-commercial

- Complete final protocol scope.
- Production-ready license/customer portal.
- Legal docs: EULA, privacy policy, acceptable use policy.
- Payment provider integration.
- Security review, SBOM, vulnerability policy, and upgrade guarantees.

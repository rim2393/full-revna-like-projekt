# Lumen VPN Backend and Panel Next Plan

Date: 2026-06-13

## Requirements Summary

Scope is backend API, admin web panel, deploy/operations, and the backend-to-node control path. Android, Windows, macOS, and iOS clients are downstream consumers and are only mentioned where backend/panel changes must support them.

Current facts:

- FastAPI app mounts public subscriptions, compatibility routes, and API v1 from `apps/api/app/main.py:33`, `apps/api/app/main.py:58`, `apps/api/app/main.py:59`, and `apps/api/app/main.py:60`.
- API v1 already exposes auth, users, API keys, nodes, subscriptions, settings, templates, response rules, audit, tools, metrics, IP control, node plugins, protocols, profiles, hosts, and squads from `apps/api/app/api/v1/router.py:22` through `apps/api/app/api/v1/router.py:48`.
- Node provisioning API exists: create/read jobs, preflight, install-token, install-token exchange, heartbeat, commands, metrics, overview, protocol selection, pause/resume/quarantine, restart, reset traffic in `apps/api/app/domains/nodes/router.py:155` through `apps/api/app/domains/nodes/router.py:550`.
- Node provisioning service validates secret-free provisioning input and manages tokens/heartbeat/commands in `apps/api/app/domains/nodes/service.py:142`, `apps/api/app/domains/nodes/service.py:255`, `apps/api/app/domains/nodes/service.py:666`, `apps/api/app/domains/nodes/service.py:697`, `apps/api/app/domains/nodes/service.py:741`, `apps/api/app/domains/nodes/service.py:791`, and `apps/api/app/domains/nodes/service.py:971`.
- Protocol/backend config surface is broad: profile/host/squad CRUD, port conflict checks, runtime apply state, computed configs, node outbound payloads, runtime policy, and protocol-specific config builders are in `apps/api/app/domains/protocols/service.py:961`, `apps/api/app/domains/protocols/service.py:1529`, `apps/api/app/domains/protocols/service.py:1641`, `apps/api/app/domains/protocols/service.py:2101`, `apps/api/app/domains/protocols/service.py:3093`, and `apps/api/app/domains/protocols/service.py:3371`.
- Public subscriptions render via API/page/short routes in `apps/api/app/domains/subscriptions/router.py:224`, `apps/api/app/domains/subscriptions/router.py:252`, `apps/api/app/domains/subscriptions/router.py:296`, and browser page generation in `apps/api/app/domains/subscriptions/router.py:630`.
- Subscription renderer supports raw URI, OpenVPN, WireGuard, IKEv2, Mihomo, sing-box, Xray JSON, credentials derivation, and protocol normalization in `apps/api/app/domains/subscriptions/renderers.py:109`, `apps/api/app/domains/subscriptions/renderers.py:315`, `apps/api/app/domains/subscriptions/renderers.py:487`, `apps/api/app/domains/subscriptions/renderers.py:540`, `apps/api/app/domains/subscriptions/renderers.py:597`, `apps/api/app/domains/subscriptions/renderers.py:678`, `apps/api/app/domains/subscriptions/renderers.py:883`, and `apps/api/app/domains/subscriptions/renderers.py:1057`.
- Web panel routes exist for dashboard, users, nodes, plugins, hosts, profiles, squads, subscriptions, templates, response rules, subscription page, settings, api keys, and tools in `apps/web/src/app/routes.tsx:25` through `apps/web/src/app/routes.tsx:65`.
- Web HTTP client calls real API endpoints for nodes, profiles, subscriptions, tools, settings, node plugins, auth, and public identity in `apps/web/src/shared/api/httpClient.ts:185` through `apps/web/src/shared/api/httpClient.ts:536`.
- Deploy stack uses API, worker, scheduler, web, subscription service, Postgres, Redis, secrets, and local-only exposed ports in `deploy/compose/lumen.yml:91`, `deploy/compose/lumen.yml:116`, `deploy/compose/lumen.yml:131`, `deploy/compose/lumen.yml:145`, and `deploy/compose/lumen.yml:166`.
- Node fallback installer exists but needs pinned non-placeholder image references and valid install token flow from `scripts/install-node.sh:14`, `scripts/install-node.sh:53`, `scripts/install-node.sh:84`, and `scripts/install-node.sh:114`.
- Public docs still mark release/install gaps: private image entrypoints, signed manifests, E2E VPS install validation, typed CLI, and push provisioning fallback gap in `docs/REMAINING.md:3` through `docs/REMAINING.md:11`; tasks still list image digest and E2E install work in `docs/TASKS.md:8` through `docs/TASKS.md:11`.

## Acceptance Criteria

1. `panel.lumentech.tel` and `sub.lumentech.tel` health checks return 2xx from outside the server.
2. A node can be provisioned on the same VPS as the panel without exposing inline secrets or conflicting with panel ports.
3. A profile can be created in the panel, applied to the node, and marked applied from node-agent command results.
4. A real subscription issued from that profile renders Happ/Hiddify/sing-box/Amnezia-compatible targets without HTML being imported as config.
5. The iPhone Happ case is validated against the live subscription page and raw URL.
6. Backend and web tests pass for touched areas; CI remains green.
7. Release/deploy docs match the real command path and do not promise private or unimplemented push provisioning.

## Implementation Steps

### Phase 0 - Protect the Current Worktree

1. Keep existing unrelated dirty files out of commits: `apps/api/app/domains/auth/schemas.py`, `apps/api/app/domains/protocols/service.py`, `apps/web/package-lock.json`, and `apps/web/src/pages/ProfilesPage.test.tsx`.
2. Before each commit, stage explicit paths only and run `git diff --cached`.

Verification:

- `git status --short`
- `git diff --cached --name-only`

### Phase 1 - Restore Production Origin Access

1. Fix server reachability first. Current observed state: SSH to remembered panel IP timed out and Cloudflare returned 522 for `https://panel.lumentech.tel/healthz`.
2. Confirm actual origin IP, SSH port, firewall/security group, Docker status, Nginx status, and whether Cloudflare DNS should be proxied or DNS-only.
3. Once access works, run non-secret status checks only: `docker ps`, `docker compose ps`, Nginx config test, API/web/subscription health checks.

Verification:

- `curl -fsS https://panel.lumentech.tel/api/healthz`
- `curl -fsS https://sub.lumentech.tel/healthz`
- SSH succeeds without printing passwords or tokens.

Stop rule:

- Do not attempt node deployment while SSH or origin health is failing.

### Phase 2 - Same-Server Node Deployment Contract

1. Audit existing panel server ports before installing node runtime. The node must not collide with Nginx 80/443 or panel internal ports.
2. Decide the first live protocol port for same-host use. Prefer a non-80/443 Reality/TLS-compatible port unless SNI/stream multiplexing is explicitly configured.
3. Use the existing backend provisioning flow: create provisioning job, pass preflight, issue one-time install token, run `scripts/install-node.sh` with pinned node-agent image.
4. If the installer needs server-side repo files, copy only required deploy/compose/installer artifacts temporarily or use the existing server checkout; remove temporary files after use.
5. Verify node-agent exchanges token, receives node credentials, sends heartbeat, and appears healthy in the panel.

Relevant files:

- `apps/api/app/domains/nodes/router.py:155`
- `apps/api/app/domains/nodes/router.py:194`
- `apps/api/app/domains/nodes/router.py:214`
- `scripts/install-node.sh:14`
- `deploy/compose/lumen-node.yml:40`

Verification:

- Node row status transitions from provisioning/installing to active.
- `GET /api/v1/nodes/{node_id}/overview` returns heartbeat and recent metrics.
- No install token is stored or printed outside root-only server secret path.

### Phase 3 - Backend Runtime Apply Path

1. For the first live node, create a minimal profile from the panel and apply it to node.
2. Trace the flow: profile apply endpoint -> node command queue -> node-agent command claim -> runtime apply -> command result -> profile runtime sync status.
3. Fix any mismatch between backend payload schema and node-agent runtime schema for Xray/Reality first, then broader protocols.
4. Make command results actionable in the panel: applied/failed, error summary, last command id, retry button, node log hint.

Relevant files:

- `apps/api/app/domains/protocols/service.py:1641`
- `apps/api/app/domains/protocols/service.py:3093`
- `apps/api/app/domains/protocols/service.py:3371`
- `apps/api/app/domains/nodes/service.py:971`
- `apps/api/app/domains/nodes/service.py:1020`
- `apps/web/src/pages/ProfilesPage.tsx:666`
- `apps/web/src/pages/NodesPage.tsx:365`

Verification:

- Profile apply command completes with success.
- Backend marks runtime state applied, not just queued.
- Re-applying same profile is idempotent or clearly rejected with a useful message.

### Phase 4 - Subscription Delivery and iPhone Happ Validation

1. Validate live public subscription links for:
   - base browser page `/sub/{public_id}`
   - Happ raw `/sub/{public_id}/happ?raw=1`
   - Hiddify raw
   - sing-box raw
   - Amnezia/OpenVPN/WireGuard where applicable
2. Confirm QR and copy/deep links use raw payload for Happ, already covered locally by `apps/api/tests/test_subscription_browser_page.py`.
3. Test the exact iPhone Happ import flow: scan QR, open button, copy Raw fallback.
4. If iOS Happ still rejects `happ://add`, keep `happ://import` as the visible primary for iOS or dynamically show client-specific guidance.

Relevant files:

- `apps/api/app/domains/subscriptions/router.py:630`
- `apps/api/app/domains/subscriptions/renderers.py:109`
- `apps/web/src/pages/UserDetailPage.tsx:790`
- `apps/web/src/pages/SubscriptionPublicPage.tsx:249`

Verification:

- iPhone Happ imports the live profile.
- Desktop Happ still imports the same profile.
- Raw URL returns config content type and not HTML.

### Phase 5 - Protocol Coverage Backlog

Execute by priority, not all at once:

1. VLESS Reality / Xray: finish production live path first.
2. Shadowsocks / Trojan / VMess where backend renderer and node runtime are already Xray-compatible.
3. Hysteria2 / TUIC / Naive: validate node-agent runtime binaries, ports, TLS settings, and client render support.
4. WireGuard / AmneziaWG: verify key derivation, peer generation, server routing, traffic accounting, and mobile import.
5. OpenVPN / OpenVPN-over-Shadowsocks / IKEv2: validate PKI generation, service reload, client payloads, and platform-specific import limitations.

Relevant files:

- `apps/api/app/domains/protocols/service.py:2816`
- `apps/api/app/domains/protocols/service.py:2842`
- `apps/api/app/domains/protocols/service.py:2861`
- `apps/api/app/domains/protocols/service.py:2918`
- `apps/api/app/domains/protocols/service.py:2986`
- `apps/api/app/domains/protocols/service.py:3067`
- `apps/node-agent/src/xray-runtime.js:153`
- `apps/node-agent/src/hysteria2-runtime.js`
- `apps/node-agent/src/tuic-runtime.js`
- `apps/node-agent/src/naive-runtime.js`
- `apps/node-agent/src/wireguard-runtime.js:170`

Verification:

- Each protocol gets one backend unit test, one node-agent runtime test, and one live smoke checklist entry.
- Unsupported client/protocol combinations fail explicitly, not as fake converted configs.

### Phase 6 - Panel UX for Real Operations

1. Nodes page: make provisioning instructions operator-grade: current job, preflight result, install token issuance state, copy-safe install command without revealing token, heartbeat, last command, last error.
2. Profiles page: show runtime readiness, port conflicts, computed config preview, apply/retry result, and stale cleanup only after real-client safety checks.
3. Subscriptions page: expose renderability per target, device/HWID bindings, active/revoked status, QR/raw/deep link actions.
4. Tools page: keep diagnostics useful but remove or demote anything that looks like demo behavior.
5. Settings page: keep auth/provider/security settings, remove any remaining commercial/SaaS language if found.

Relevant files:

- `apps/web/src/pages/NodesPage.tsx:676`
- `apps/web/src/pages/NodesPage.tsx:1282`
- `apps/web/src/pages/ProfilesPage.tsx:125`
- `apps/web/src/pages/SubscriptionPage.tsx:79`
- `apps/web/src/pages/SubscriptionPublicPage.tsx:34`
- `apps/web/src/pages/SettingsPage.tsx:42`
- `apps/web/src/shared/i18n/I18nProvider.tsx:184`

Verification:

- Web tests cover provisioning, apply-to-node, subscription issue/render links, and auth settings.
- No production page imports fixture data except tests/dev mode.

### Phase 7 - Security and Open-Source Cleanup

1. Re-run SaaS/license/billing grep across backend, web, node-agent, docs.
2. Replace non-product test text like `license expired` in node-agent tests with neutral control-plane reasons if it is not part of the product.
3. Verify auth: sessions, refresh cookies, MFA, passkeys, Telegram login, OAuth provider toggles.
4. Verify node command payloads reject inline secrets and audit all sensitive mutations.
5. Confirm public docs do not include raw subscription URLs, node credentials, server credentials, or private tokens.

Relevant files:

- `apps/api/app/domains/auth/router.py:43`
- `apps/api/app/domains/auth/social_router.py:61`
- `apps/api/app/domains/settings/router.py:50`
- `apps/api/app/domains/nodes/service.py:142`
- `scripts/secret-scan.sh:41`

Verification:

- `scripts/secret-scan.sh .`
- backend auth/security route tests
- targeted grep returns no product-facing SaaS/license/billing claims.

### Phase 8 - Release and Installer Readiness

1. Replace placeholder image digests with real signed release image references.
2. Ensure API image provides `lumen-api migrate`, `lumen-api bootstrap-admin`, `lumen-api healthcheck`, `worker`, and `scheduler` entrypoints used by compose/install scripts.
3. Ensure node-agent image provides `lumen-node-agent healthcheck` and registration/runtime loop commands.
4. Validate compose rendering for panel and node.
5. Run clean Debian/Ubuntu install smoke when a disposable VPS is available.

Relevant files:

- `docs/REMAINING.md:3`
- `docs/TASKS.md:8`
- `deploy/compose/lumen.yml:91`
- `deploy/compose/lumen-node.yml:62`
- `scripts/install.sh:175`
- `scripts/upgrade.sh:144`

Verification:

- GitHub CI green.
- `docker compose config` passes for panel and node.
- Fresh VPS install reaches healthy panel, subscription service, and node heartbeat.

## Risks and Mitigations

- Origin server is currently unreachable. Mitigation: restore SSH/Cloudflare origin before any deployment work.
- Same-host node may collide with panel TLS/ports. Mitigation: explicit port audit and first protocol on non-conflicting port.
- Broad protocol support can spread effort too thin. Mitigation: prove VLESS Reality live first, then add protocol families one by one.
- Subscription can render but not run. Mitigation: every “done” protocol requires live apply plus client import proof.
- Secrets can leak through logs/docs. Mitigation: no raw tokens/subscription URLs in wiki, shell output, commits, or docs.

## Verification Commands

Backend:

```powershell
cd D:\android-app-new\apps\api
python -m pytest
python -m ruff check .
```

Web:

```powershell
cd D:\android-app-new\apps\web
npm test
npm run build
```

Node-agent/packages:

```powershell
cd D:\android-app-new
npm --prefix apps/node-agent test
npm --prefix packages/protocol-registry test
npm --prefix packages/subscription-renderers test
npm --prefix packages/subscription-schema test
```

Deploy/security:

```powershell
cd D:\android-app-new
scripts\secret-scan.sh .
docker compose --env-file .env.example -f deploy/compose/lumen.yml config
```

Production smoke:

```bash
curl -fsS https://panel.lumentech.tel/api/healthz
curl -fsS https://sub.lumentech.tel/healthz
```

## Immediate Next Action

Start with Phase 1. Do not spend time polishing UI until origin health is back and the same-server node can be installed. After server access is restored, do Phase 2 and Phase 3 in one focused pass: provision node, apply one VLESS Reality profile, issue one subscription, and validate Happ desktop plus iPhone.

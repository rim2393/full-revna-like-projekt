# Status

## Current Phase

Phase 3 backend node provisioning API.

## Completed

- Four GitHub repositories verified and cloned into `D:\lumen-work`.
- `D:\lumen-secrets` created and ACL restricted to the current user,
  Administrators, and SYSTEM.
- Native subagents started for installer, backend, frontend, node/protocol,
  license server, and client compatibility scaffolds.
- Client compatibility repo scaffold completed with subscription import docs,
  protocol support docs, Android/Windows status docs, compatibility matrix, and
  `lumen.subscription.v1` JSON fixtures.
- Node/protocol/subscription scaffold completed with node-agent contracts,
  protocol registry, subscription schema/renderers, Lumen Edge fallback landing,
  and passing Node test suites.
- Frontend scaffold completed with Lumen Guard, admin shell, route smoke tests,
  passing build, and passing Vitest suite. Temporary dev server was stopped.
- Backend scaffold completed with FastAPI app, security/RBAC/API docs,
  SQLAlchemy/Alembic layout, domain skeletons, and passing pytest suite.
- Public installer repo scaffold completed and locally committed by the DevOps
  agent; main integration patched `secret-scan.sh` to handle patterns that
  start with dashes.
- License server scaffold completed with FastAPI API, React cabinet placeholder,
  signed offline license model, TOTP/recovery skeleton, Docker/Compose, docs,
  and passing backend/frontend tests.
- Backend Phase 2 security slice completed with API key one-time generation,
  HMAC-at-rest verification, scope checks, and a free 3-node license policy.
- Backend Phase 3 node provisioning slice completed with idempotent provisioning
  jobs, SSH credential references only, preflight states, one-time install token
  exchange, node heartbeat token hashing, and route/service tests.

## In Progress

- Private source repository control documentation.
- First commits/pushes.

## Verification

- Private control-plane repo: backend pytest/ruff, web build/Vitest,
  node-agent tests, lumen-edge tests, protocol-registry tests,
  subscription-schema tests, and subscription-renderers tests pass.
- Public installer repo: bash syntax, Docker Compose config with
  `.env.example`, release manifest JSON validation, and secret scan pass.
- License server repo: backend pytest/ruff, frontend build/Vitest, and Docker
  Compose config pass.
- Client compatibility repo: JSON fixtures parse and `git diff --check` passes.
- Plaintext VPS passwords were not found in `D:\lumen-work`.
- Backend API Phase 2 security slice: `.venv\Scripts\python.exe -m pytest`
  and `.venv\Scripts\python.exe -m ruff check .` pass in `apps\api`.
- Backend API Phase 3 node provisioning slice: `.venv\Scripts\python.exe -m pytest`
  and `.venv\Scripts\python.exe -m ruff check .` pass in `apps\api`.

## Blockers

- Real VPS end-to-end tests require using the provided server credentials
  through an encrypted local inventory. Plaintext `.env` storage is forbidden.

## Next

1. Finish scaffold files across all repositories.
2. Run basic local validation.
3. Commit and push initial scaffold.
4. Prepare encrypted server inventory for the two available VPS hosts.
5. Continue backend auth/session/RBAC/audit endpoint hardening.

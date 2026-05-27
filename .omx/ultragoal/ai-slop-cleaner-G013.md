AI SLOP CLEANUP REPORT
======================

Scope: G013 changed files and release artifacts after the final live-stage
review loop:
- apps/api/app/domains/subscriptions/service.py
- apps/api/app/domains/protocols/schemas.py
- apps/api/tests/test_license_subscription_routes.py
- apps/api/tests/test_control_plane_foundation_routes.py
- packages/subscription-schema/src/manifest.js
- packages/subscription-schema/test/manifest.test.js
- public installer release pins for v0.1.7
- .omx/ultragoal final evidence artifacts

Behavior Lock: Final verification was run after the product-code hardening
commits. The public manifest must remain unauthenticated by opaque public id,
must not expose inline credentials, must fail closed on revoked/expired license
state, and must validate in the client fixture.

Cleanup Plan:
1. Keep the security fixes narrowly scoped to manifest/license/credential
   boundaries.
2. Avoid broad refactors after live deployment evidence was collected.
3. Record the remaining LOW review item honestly instead of hiding it behind a
   "no issues" report.
4. Refresh stale G013 artifacts so they describe v0.1.7 and the actual live
   cleanup state.

Fallback Findings:
- none. No fallback-like or placeholder runtime behavior was introduced in the
  product-code changes.

UI/Design Findings:
- N/A for this gate; no UI files were changed in the final hardening loop.

Passes Completed:
1. Pass 1: Dead code deletion - no obsolete product code found in the final
   changed scope.
2. Pass 2: Duplicate removal - no duplicated manifest or validator logic was
   introduced beyond the intentional API/package boundary.
3. Pass 3: Naming/error handling cleanup - public manifest errors now fail
   closed with controlled API errors; malformed edge ids return 404 instead of
   upstream error leakage.
4. Pass 4: Test reinforcement - added tests for rejected plaintext profile
   credential references, invalid manifest ports, expired license public
   manifests, malformed edge public ids, and plaintext credentialsRef rejection
   in the schema package.

Quality Gates:
- Regression tests: PASS
- Lint: PASS
- Typecheck/build: PASS where available
- Static/security scan: PASS
- Live verification: PASS

Changed Files:
- Product hardening: subscriptions service, protocol schemas, API tests,
  subscription-schema package tests.
- Release/delivery: public v0.1.7 image pins and signed manifest validation.
- Durable evidence: G013 code review, quality gate, ai-slop-cleaner, goal, and
  ledger artifacts.

Fallback Review:
- Findings: none.
- Classification: none.
- Escalation Status: none.

Remaining Risks:
- LOW accepted: API-side vault reference validation is prefix-based while the
  subscription-schema package uses a stricter pattern. Current v0.1.7 live
  manifest is valid and does not leak secrets. Aligning the API regex exactly
  with the package regex is tracked as follow-up hardening.

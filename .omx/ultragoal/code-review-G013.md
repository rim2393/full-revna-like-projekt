CODE REVIEW REPORT
==================

Scope: G013 final live-stage changes across the self-hosted control plane,
public installer repository, license server repository, and client
compatibility repository.

Final reviewed state:
- Main repository HEAD: 27c7685 fix(subscription): enforce vault refs in schema package.
- Security hardening commit: 7ea511c fix(subscription): harden public manifest secrets.
- Public installer repository HEAD: 5cd3d56 chore(release): pin v0.1.7 images.
- Release image workflow: GitHub Actions run 26538866814, v0.1.7.
- Public installer validation workflow: GitHub Actions run 26539021296.
- Live panel/subscription/node stage: v0.1.7.

Reviewed areas:
- API subscription manifest service and public route.
- Protocol profile vault-reference validation.
- Subscription schema package and renderer packages.
- Lumen edge public subscription manifest proxy.
- Node-agent gated tcp-smoke live listener path and cleanup command.
- Public installer digest pinning, signed manifest validation, and source
  boundary controls.
- License-server backend/frontend checks.
- Client subscription manifest validator and tcp-smoke acceptance fixture.

Issues:
- CRITICAL: none.
- HIGH: none. A previous public-manifest credentialsRef leak risk was fixed in
  7ea511c by failing closed unless the manifest credential reference is a
  vault:// reference and by adding license status/date checks to public
  manifest serving.
- MEDIUM: none.
- LOW: accepted residual risk. API-side validation currently accepts any
  non-empty vault:// prefix while the subscription-schema package enforces a
  stricter vault reference pattern. This is not a live blocker: v0.1.7 emits a
  valid vault://subscriptions/g015/tcp-smoke reference and does not expose
  plaintext credentials. The stricter package-side validator and test were
  added in 27c7685; aligning the API regex exactly with the package regex is a
  follow-up hardening item, not a release blocker.

Architecture status: CLEAR.

Synthesis:
- codeReviewerRecommendation: APPROVE.
- architectStatus: CLEAR.
- finalRecommendation: APPROVE.

Evidence:
- v0.1.7 GHCR images were built and verified by release workflow 26538866814:
  api sha256:83adf1ac41ddd8260c693d981458a9fd8992c840b56adcfdc2dd3f00b37d2fd4,
  web sha256:3e891d1b239d51eb71b8b9917a5afdb514ebc1c703fc987c4eb1e4b46a11c4a5,
  node-agent sha256:6eb431f5cfc618deffb9372ce85c81af0b7974977314ed683a9adb9ac31a929c,
  subscription sha256:7e11c89f35d083efa2a25422fa47f92928c18c613ff209f5e38f4ca6b62594eb.
- Public installer repository pins those v0.1.7 images and passed manifest
  signature, secret scan, public-boundary, and CI validation checks.
- Panel VPS 89.185.85.184 was upgraded using the signed v0.1.7 manifest with
  encrypted backup /opt/lumen/backups/lumen-backup-20260527T211300Z.tar.gz.enc.
  API, web, and subscription containers are v0.1.7 digest-pinned and healthy.
- Node VPS 85.192.60.8 runs v0.1.7 node-agent digest-pinned with live smoke
  enabled and host networking.
- Public subscription URL
  https://sub.89-185-85-184.sslip.io/sub/lumen_sub_mewUPefwR9cpzoQYzy32fg/manifest
  returns 200 application/json with cache-control no-store and
  X-Content-Type-Options nosniff.
- Live manifest saved at D:\lumen-work\.deploy-secrets\g017-subdomain-manifest-final.json
  validates with the client fixture and contains schema
  lumen.subscription-manifest.v1, protocol tcp-smoke, endpoint 85.192.60.8:28771,
  and credentialsRef vault://subscriptions/g015/tcp-smoke.
- Live outbound command f425141d-e5e9-4f1a-99e4-6a8dd1c819ae reached
  implementationStatus live-listener-active and external TCP read returned
  banner lumen-g017-ok.
- Cleanup command 276754ed-699c-4f8d-b6db-6f115fc09a35 completed succeeded
  with implementationStatus live-listener-stopped; external TCP connect to
  85.192.60.8:28771 now fails.
- Final multi-agent review returned APPROVE with architectStatus CLEAR and no
  critical, high, or medium blockers.

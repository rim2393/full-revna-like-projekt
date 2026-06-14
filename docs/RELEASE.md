# Release process

Release manifests are public metadata. They reference runtime images by digest
and never include registry tokens, credentials, or generated source archives.

Minimum release artifacts:

- `release/manifest.<version>.json`
- `release/checksums.<version>.txt`
- Signed image digests for every runtime image
- Compatibility notes for migrations and installer version

Container image releases are produced by the `Release images` GitHub Actions
workflow:

```sh
gh workflow run release-images.yml -f version=v0.1.0
```

The workflow builds and pushes the API, web, node-agent, and subscription page
images to GHCR, signs each pushed digest with cosign keyless signing, and uploads
the generated manifest, checksums, and image reference list as a workflow
artifact. Do not copy placeholder digests from `manifest.template.json` into a
production `.env`; use the generated release artifact instead.

Release gates for this public repo:

- Shell scripts pass ShellCheck
- Compose templates render with `.env.example`
- Secret scan passes
- Release manifest validates as JSON
- Docs describe unsupported or remaining work honestly

Any release blocker must be tracked in public issues or public release notes
without exposing secrets or infrastructure credentials.

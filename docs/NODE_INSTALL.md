# Node install

The current supported open-source node path is token-based bootstrap from the
target VPS. The panel issues a short-lived install token, and the operator runs
the installer on the server that will host the node.

Supported flow:

1. Admin creates a node in the panel.
2. Backend creates a short-lived install token.
3. Operator copies the token to the VPS through a secure channel.
4. Operator runs `scripts/install-node.sh` on the VPS.
5. Node agent exchanges the one-time token for node credentials.
6. Node agent keeps an outbound connection to the panel.

Panel-initiated SSH push provisioning is not part of the current public release
path. If it is added later, it must be documented with its own threat model,
credential handling, tests, and release gates before being advertised as
supported.

Fallback command:

```bash
sudo ./scripts/install-node.sh \
  --panel-url https://panel.example.com \
  --install-token-stdin \
  --image ghcr.io/rim2393/lumen-node-agent:v0.1.0@sha256:<64 hex chars>
```

The token should be pasted through stdin or read from a root-only file. Avoid
putting one-time tokens in shell history.
The node-agent image must be pinned by digest and must come from the signed
release manifest. The fallback installer refuses missing, unpinned, zeroed, or
`CHANGE_ME` image references.

The node installer creates `/opt/lumen-node`, installs Docker/Compose when
missing, starts the `lumen-node-agent` container, and does not open an inbound
admin port.

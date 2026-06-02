import test from "node:test";
import assert from "node:assert/strict";
import {
  createIkev2ApplyPlan,
  renderSwanctlConfig
} from "../src/index.js";

const IKEV2_CONFIG = Object.freeze({
  ike_port: 500,
  nat_port: 4500,
  server_id: "vpn.example.test",
  pool: "10.92.0.0/24",
  dns: ["1.1.1.1"],
  pki: {
    ca_cert: "-----BEGIN CERTIFICATE-----\nca\n-----END CERTIFICATE-----",
    server_cert: "-----BEGIN CERTIFICATE-----\nserver\n-----END CERTIFICATE-----",
    server_key: "-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----"
  },
  users: [{ username: "lumen_sub_live", password: "ikev2-password" }]
});

test("renders strongSwan swanctl config with EAP users and server cert", () => {
  const plan = createIkev2ApplyPlan({ ikev2Config: IKEV2_CONFIG });
  assert.equal(plan.modelVersion, "lumen.node-agent.ikev2-runtime.v1");
  const rendered = renderSwanctlConfig(plan.config, {
    serverCertPath: "/etc/swanctl/x509/lumen.pem",
    serverKeyPath: "/etc/swanctl/private/lumen-key.pem"
  });
  assert.match(rendered, /connections \{/);
  assert.match(rendered, /auth = eap-mschapv2/);
  assert.match(rendered, /certs = \/etc\/swanctl\/x509\/lumen\.pem/);
  assert.match(rendered, /id = "lumen_sub_live"/);
  assert.match(rendered, /secret = "ikev2-password"/);
});

test("rejects unresolved IKEv2 credential references", () => {
  assert.throws(
    () => createIkev2ApplyPlan({
      ikev2Config: {
        ...IKEV2_CONFIG,
        users: undefined,
        clientsRef: "vault://subscriptions/p/creds"
      }
    }),
    /unresolved refs/
  );
});

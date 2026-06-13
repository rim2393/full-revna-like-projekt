import json

from pydantic import SecretStr

from app.core.config import Settings
from app.domains.subscriptions.renderers import render_subscription_for_target

TEST_CA_CERT = "-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----"


def _settings() -> Settings:
    return Settings(api_key_hash_pepper=SecretStr("renderer-test-pepper"))


def _manifest(protocols: list[dict[str, object]]) -> dict[str, object]:
    return {
        "subscription": {"id": "renderer-user"},
        "metadata": {},
        "nodes": [
            {
                "id": "node-1",
                "displayName": "Node One",
                "protocols": protocols,
            }
        ],
    }


def test_raw_subscription_renders_openvpn_wireguard_and_ikev2_profiles() -> None:
    rendered = render_subscription_for_target(
        _manifest(
            [
                {
                    "id": "openvpn-1",
                    "type": "openvpn",
                    "endpoint": {"host": "ovpn.example.test", "port": 1194, "transport": "udp"},
                    "credentialsRef": "vault://subscriptions/openvpn",
                    "rendererHints": {"caCert": TEST_CA_CERT},
                },
                {
                    "id": "wireguard-1",
                    "type": "wireguard",
                    "endpoint": {"host": "wg.example.test", "port": 51820, "transport": "udp"},
                    "security": {"publicKey": "server-public-key"},
                    "credentialsRef": "vault://subscriptions/wireguard",
                    "rendererHints": {"address": "10.66.0.2/32", "dns": "1.1.1.1"},
                },
                {
                    "id": "ikev2-1",
                    "type": "ikev2",
                    "endpoint": {"host": "ikev2.example.test", "port": 500, "transport": "udp"},
                    "credentialsRef": "vault://subscriptions/ikev2",
                    "rendererHints": {
                        "ikev2CaCert": TEST_CA_CERT,
                        "ikev2ServerId": "ikev2.example.test",
                    },
                },
            ]
        ),
        settings=_settings(),
        target="raw-uri",
    )

    assert rendered.content_type == "text/plain; charset=utf-8"
    assert "remote ovpn.example.test 1194" in rendered.body
    assert "<auth-user-pass>" in rendered.body
    assert "[Interface]" in rendered.body
    assert "Endpoint = wg.example.test:51820" in rendered.body
    assert '"type": "ikev2-eap"' in rendered.body
    assert '"addr": "ikev2.example.test"' in rendered.body


def test_structured_subscription_targets_render_vless_profile() -> None:
    manifest = _manifest(
        [
            {
                "id": "vless-1",
                "type": "vless",
                "endpoint": {"host": "xray.example.test", "port": 443, "transport": "tcp"},
                "credentialsRef": "vault://subscriptions/vless",
                "security": {"serverName": "xray.example.test"},
            }
        ]
    )

    mihomo = render_subscription_for_target(manifest, settings=_settings(), target="mihomo")
    sing_box = render_subscription_for_target(manifest, settings=_settings(), target="sing-box")
    xray = render_subscription_for_target(manifest, settings=_settings(), target="xray-json")

    assert "proxies:" in mihomo.body
    assert json.loads(sing_box.body)["outbounds"][0]["type"] == "vless"
    assert json.loads(xray.body)["outbounds"][0]["protocol"] == "vless"

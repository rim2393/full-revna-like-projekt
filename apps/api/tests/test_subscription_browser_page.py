from urllib.parse import quote

import pytest
from starlette.requests import Request

from app.domains.subscriptions.renderers import RenderedSubscription
from app.domains.subscriptions.router import (
    _render_public_subscription_request,
    _subscription_browser_page,
)


class _DummySession:
    async def commit(self) -> None:
        return None


def test_happ_browser_page_imports_raw_subscription(monkeypatch) -> None:
    captured_qr_values: list[str] = []

    def fake_qr_svg(value: str) -> str:
        captured_qr_values.append(value)
        return "<svg></svg>"

    monkeypatch.setattr(
        "app.domains.subscriptions.router._subscription_qr_svg",
        fake_qr_svg,
    )
    request = Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/sub/public-user/happ",
            "headers": [(b"host", b"sub.lumentech.tel")],
            "scheme": "https",
            "server": ("sub.lumentech.tel", 443),
            "query_string": b"",
        }
    )
    rendered = RenderedSubscription(
        body="vless://example",
        content_type="text/plain",
        filename="subscription.txt",
        headers={},
    )

    response = _subscription_browser_page(
        {
            "subscription": {"id": "public-user"},
            "metadata": {},
            "provider": {"name": "Lumen VPN"},
        },
        request=request,
        rendered=rendered,
        render_target="happ",
    )

    raw_url = "https://sub.lumentech.tel/sub/public-user/happ?raw=1"
    body = response.body.decode()

    assert captured_qr_values == [raw_url]
    assert f"happ://add/{quote(raw_url, safe='')}" in body
    assert f"happ://import/{quote(raw_url, safe='')}" in body
    assert 'data-url="https://sub.lumentech.tel/sub/public-user/happ?raw=1"' in body


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("target", "content_type", "body"),
    [
        ("happ", "text/plain; charset=utf-8", "vless://example\n"),
        ("hiddify", "text/plain; charset=utf-8", "vless://example\n"),
        ("sing-box", "application/json; charset=utf-8", '{"outbounds":[]}\n'),
    ],
)
async def test_short_public_subscription_raw_mode_returns_client_payload(
    monkeypatch,
    target: str,
    content_type: str,
    body: str,
) -> None:
    async def fake_build_manifest(*_args, **kwargs):
        assert kwargs["public_id"] == "public-user"
        assert kwargs["target"] == target
        return {"subscription": {"id": "public-user"}, "metadata": {}, "nodes": []}

    def fake_render(manifest, *, settings, target):
        assert manifest["subscription"]["id"] == "public-user"
        return RenderedSubscription(
            body=body,
            content_type=content_type,
            filename="subscription.txt",
            headers={},
        )

    async def fake_apply_template(_session, rendered, *, render_target):
        assert render_target == target
        return rendered

    monkeypatch.setattr(
        "app.domains.subscriptions.router.build_and_record_public_subscription_request",
        fake_build_manifest,
    )
    monkeypatch.setattr(
        "app.domains.subscriptions.router.render_subscription_for_target",
        fake_render,
    )
    monkeypatch.setattr(
        "app.domains.subscriptions.router._apply_subscription_template",
        fake_apply_template,
    )
    request = Request(
        {
            "type": "http",
            "method": "GET",
            "path": f"/sub/public-user/{target}",
            "headers": [(b"host", b"sub.lumentech.tel"), (b"accept", b"text/html")],
            "scheme": "https",
            "server": ("sub.lumentech.tel", 443),
            "query_string": b"raw=1",
        }
    )

    response = await _render_public_subscription_request(
        public_id="public-user",
        request=request,
        session=_DummySession(),
        settings=None,
        render_target=target,
        device_id=None,
        hwid=None,
        x_lumen_hwid=None,
        x_device_id=None,
        user_agent=None,
        raw=True,
    )

    assert response.media_type == content_type
    assert response.body.decode() == body
    assert b"<!doctype html>" not in response.body.lower()
    assert response.headers["x-lumen-render-target"] == target

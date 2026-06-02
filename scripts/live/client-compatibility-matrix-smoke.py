from __future__ import annotations

import asyncio
import base64
import json
import os
import secrets
import ssl
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.config import get_settings
from app.db.session import create_engine
from app.domains.licenses.models import License
from app.domains.licenses.service import hash_license_key
from app.domains.nodes.models import Node
from app.domains.subscriptions.models import Subscription
from app.domains.subscriptions.service import create_subscription_public_id
from app.domains.users.models import User


PANEL_PUBLIC_URL = os.environ.get(
    "PANEL_PUBLIC_URL",
    "https://panel.lumentech.tel",
).rstrip("/")

TARGET_CONTRACTS: dict[str, tuple[str, str]] = {
    "raw-uri": ("text/plain", "raw"),
    "v2ray": ("text/plain", "raw"),
    "v2ray-base64": ("text/plain", "base64"),
    "v2rayn": ("text/plain", "raw"),
    "v2rayng": ("text/plain", "raw"),
    "streisand": ("text/plain", "raw"),
    "shadowrocket": ("text/plain", "raw"),
    "hiddify": ("text/plain", "raw"),
    "happ": ("text/plain", "raw"),
    "mihomo": ("application/yaml", "mihomo"),
    "clash-meta": ("application/yaml", "mihomo"),
    "clash": ("application/yaml", "mihomo"),
    "flclash": ("application/yaml", "mihomo"),
    "stash": ("application/yaml", "mihomo"),
    "koala-clash": ("application/yaml", "mihomo"),
    "sing-box": ("application/json", "sing-box"),
    "nekobox": ("application/json", "sing-box"),
    "nekoray": ("application/json", "sing-box"),
    "xray-json": ("application/json", "xray"),
    "amnezia": ("application/json", "xray"),
    "lumen-json": ("application/json", "lumen"),
}


def _http_get(url: str) -> tuple[int, dict[str, str], str]:
    request = Request(
        url,
        headers={
            "User-Agent": "Lumen-PR006-live-smoke/1.0",
            "X-Lumen-HWID": "qa-pr006-client-matrix",
        },
        method="GET",
    )
    try:
        with urlopen(request, timeout=20, context=ssl.create_default_context()) as response:
            body = response.read().decode("utf-8", errors="replace")
            return response.status, {k.lower(): v for k, v in response.headers.items()}, body
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        return exc.code, {k.lower(): v for k, v in exc.headers.items()}, body


def _assert_target_contract(target: str, status: int, headers: dict[str, str], body: str) -> None:
    expected_type, family = TARGET_CONTRACTS[target]
    if status != 200:
        raise AssertionError(f"{target}: expected 200, got {status}")
    if headers.get("x-lumen-render-target") != target:
        raise AssertionError(f"{target}: missing normalized render target header")
    if not headers.get("content-type", "").startswith(expected_type):
        raise AssertionError(f"{target}: unexpected content type {headers.get('content-type')}")
    if not headers.get("profile-title", "").startswith("base64:"):
        raise AssertionError(f"{target}: missing base64 profile title")
    if "subscription-userinfo" not in headers:
        raise AssertionError(f"{target}: missing subscription-userinfo")
    forbidden = ("skeleton", "placeholder", "access_token")
    if family != "lumen":
        forbidden = (*forbidden, "credentialsref", "privatekey")
    lowered = body.lower()
    if any(marker in lowered for marker in forbidden):
        raise AssertionError(f"{target}: forbidden marker leaked")

    if family == "raw":
        if not body.startswith("vless://") or "security=reality" not in body:
            raise AssertionError(f"{target}: invalid raw URI body")
    elif family == "base64":
        decoded = base64.b64decode(body.strip()).decode("utf-8")
        if not decoded.startswith("vless://") or "security=reality" not in decoded:
            raise AssertionError(f"{target}: invalid base64 v2ray body")
    elif family == "mihomo":
        for marker in ("proxies:", "proxy-groups:", 'type: "vless"', "reality-opts:"):
            if marker not in body:
                raise AssertionError(f"{target}: missing YAML marker {marker}")
    elif family == "sing-box":
        parsed = json.loads(body)
        if parsed["outbounds"][0]["type"] != "vless":
            raise AssertionError(f"{target}: first outbound is not vless")
        if not parsed["outbounds"][0].get("tls", {}).get("reality", {}).get("public_key"):
            raise AssertionError(f"{target}: missing Reality public key")
    elif family == "xray":
        parsed = json.loads(body)
        if parsed["outbounds"][0]["protocol"] != "vless":
            raise AssertionError(f"{target}: first Xray outbound is not vless")
        if parsed["outbounds"][0]["streamSettings"]["security"] != "reality":
            raise AssertionError(f"{target}: missing Reality stream security")
    else:
        parsed = json.loads(body)
        if parsed["schemaVersion"] != "lumen.subscription-manifest.v1":
            raise AssertionError(f"{target}: invalid Lumen schema")


async def main() -> None:
    run_id = f"qa-pr006-{secrets.token_hex(6)}"
    settings = get_settings()
    engine = create_engine(settings)
    sessionmaker = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    ids: dict[str, Any] = {}
    public_id: str | None = None
    try:
        async with sessionmaker() as session:
            node = (
                await session.execute(
                    select(Node).where(Node.name == "node-01").order_by(Node.created_at.desc())
                )
            ).scalar_one_or_none()
            if node is None:
                node = (await session.execute(select(Node).order_by(Node.created_at.desc()))).scalars().first()
            if node is None:
                raise RuntimeError("No real node exists for PR-006 live smoke")

            user = User(
                email=f"{run_id}@example.test",
                username=run_id,
                display_name="PR-006 client matrix",
                status="active",
                traffic_limit_gb=500,
                traffic_used_gb=0,
                device_limit=10,
                expires_at=datetime.now(UTC) + timedelta(days=1),
                tags=["qa", "pr006"],
                metadata_json={"qa": "pr006", "run": run_id},
            )
            session.add(user)
            await session.flush()

            license_record = License(
                license_key_hash=hash_license_key(f"{run_id}-license"),
                customer_ref=run_id,
                status="active",
                max_devices=10,
                starts_at=datetime.now(UTC) - timedelta(minutes=1),
                expires_at=datetime.now(UTC) + timedelta(days=1),
                metadata_json={"qa": "pr006", "run": run_id},
            )
            session.add(license_record)
            await session.flush()

            public_id = await create_subscription_public_id(session)
            subscription = Subscription(
                public_id=public_id,
                user_id=user.id,
                license_id=license_record.id,
                node_id=node.id,
                status="active",
                delivery_profile={
                    "protocol": "vless-reality",
                    "adapter": "vless-reality",
                    "profile_title": "Lumen PR-006 Client Matrix",
                    "server_name": "www.example.com",
                    "public_key": "F1E2D3C4B5A69788776655443322110abcdEFGH_-",
                    "short_id": "a1b2c3d4",
                    "fingerprint": "chrome",
                    "spider_x": "/",
                    "flow": "xtls-rprx-vision",
                    "traffic_limit_gb": "500",
                    "client": ",".join(TARGET_CONTRACTS),
                },
                config_hash="sha256:pr006-client-matrix",
                expires_at=datetime.now(UTC) + timedelta(days=1),
            )
            session.add(subscription)
            await session.commit()
            ids = {
                "subscription": subscription.id,
                "license": license_record.id,
                "user": user.id,
            }

        target_results = []
        for target in TARGET_CONTRACTS:
            url = f"{PANEL_PUBLIC_URL}/api/v1/subscriptions/public/{public_id}/render?target={target}"
            status, headers, body = _http_get(url)
            _assert_target_contract(target, status, headers, body)
            target_results.append(
                {
                    "target": target,
                    "status": status,
                    "content_type": headers.get("content-type", "").split(";")[0],
                    "bytes": len(body.encode("utf-8")),
                }
            )

        async with sessionmaker() as session:
            await session.execute(delete(Subscription).where(Subscription.id == ids["subscription"]))
            await session.execute(delete(License).where(License.id == ids["license"]))
            await session.execute(delete(User).where(User.id == ids["user"]))
            await session.commit()
            leftovers = {
                "subscriptions": (
                    await session.execute(
                        select(func.count()).select_from(Subscription).where(Subscription.config_hash == "sha256:pr006-client-matrix")
                    )
                ).scalar_one(),
                "licenses": (
                    await session.execute(
                        select(func.count()).select_from(License).where(License.customer_ref.like("qa-pr006-%"))
                    )
                ).scalar_one(),
                "users": (
                    await session.execute(
                        select(func.count()).select_from(User).where(User.username.like("qa-pr006-%"))
                    )
                ).scalar_one(),
            }
        print(
            json.dumps(
                {
                    "ok": True,
                    "targets_checked": len(target_results),
                    "targets": target_results,
                    "cleanup_leftovers": leftovers,
                },
                ensure_ascii=False,
            )
        )
    finally:
        if ids:
            async with sessionmaker() as session:
                if "subscription" in ids:
                    await session.execute(delete(Subscription).where(Subscription.id == ids["subscription"]))
                if "license" in ids:
                    await session.execute(delete(License).where(License.id == ids["license"]))
                if "user" in ids:
                    await session.execute(delete(User).where(User.id == ids["user"]))
                await session.commit()
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())

from __future__ import annotations

import asyncio
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
from app.core.rbac import Permission
from app.db.session import create_engine
from app.domains.api_keys.models import ApiKey
from app.domains.api_keys.schemas import ApiKeyCreateRequest
from app.domains.api_keys.service import create_api_key
from app.domains.licenses.models import License
from app.domains.licenses.service import hash_license_key
from app.domains.nodes.models import Node
from app.domains.protocols.models import Host, ProtocolProfile
from app.domains.subscriptions.models import Subscription
from app.domains.users.models import User


PANEL_PUBLIC_URL = os.environ.get("PANEL_PUBLIC_URL", "https://panel.lumentech.tel").rstrip("/")


def _request_json(path: str, *, api_key: str, payload: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    request = Request(
        f"{PANEL_PUBLIC_URL}{path}",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "User-Agent": "Lumen-issue-from-profile-live-smoke/1.0",
            "X-Lumen-Api-Key": api_key,
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=20, context=ssl.create_default_context()) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(body)
        except json.JSONDecodeError:
            parsed = {"raw": body}
        return exc.code, parsed


def _get(path: str) -> tuple[int, dict[str, str], str]:
    request = Request(
        f"{PANEL_PUBLIC_URL}{path}",
        headers={
            "User-Agent": "Lumen-issue-from-profile-live-smoke/1.0",
            "X-Lumen-HWID": "qa-issue-from-profile",
        },
        method="GET",
    )
    try:
        with urlopen(request, timeout=20, context=ssl.create_default_context()) as response:
            return response.status, {key.lower(): value for key, value in response.headers.items()}, response.read().decode("utf-8", errors="replace")
    except HTTPError as exc:
        return exc.code, {key.lower(): value for key, value in exc.headers.items()}, exc.read().decode("utf-8", errors="replace")


async def main() -> None:
    run_id = f"qa-issue-profile-{secrets.token_hex(6)}"
    settings = get_settings()
    engine = create_engine(settings)
    sessionmaker = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    ids: dict[str, Any] = {}
    api_key_plaintext: str | None = None
    created_subscription_id: str | None = None
    try:
        async with sessionmaker() as session:
            node = (
                await session.execute(
                    select(Node).where(Node.name == "node-01").order_by(Node.created_at.desc())
                )
            ).scalar_one_or_none()
            if node is None:
                raise RuntimeError("node-01 does not exist")
            binding = (
                await session.execute(
                    select(ProtocolProfile, Host)
                    .join(Host, Host.protocol_profile_id == ProtocolProfile.id)
                    .where(ProtocolProfile.node_id == node.id)
                    .where(ProtocolProfile.status == "active")
                    .where(ProtocolProfile.adapter == "vless-reality")
                    .where(Host.status == "active")
                    .where(Host.hidden.is_(False))
                    .where(Host.subscription_excluded.is_(False))
                    .order_by(ProtocolProfile.created_at.asc(), Host.created_at.asc())
                )
            ).first()
            if binding is None:
                raise RuntimeError("No active real vless-reality profile+host exists")
            profile, host = binding

            owner = User(
                email=f"{run_id}-owner@example.test",
                username=f"{run_id}-owner",
                role="owner",
                status="active",
                metadata_json={"qa": "issue-from-profile", "run": run_id},
            )
            subscriber = User(
                email=f"{run_id}-subscriber@example.test",
                username=f"{run_id}-subscriber",
                status="active",
                device_limit=5,
                traffic_limit_gb=100,
                traffic_used_gb=0,
                metadata_json={"qa": "issue-from-profile", "run": run_id},
            )
            license_record = License(
                license_key_hash=hash_license_key(f"{run_id}-license"),
                customer_ref=run_id,
                status="active",
                max_devices=5,
                starts_at=datetime.now(UTC) - timedelta(minutes=1),
                expires_at=datetime.now(UTC) + timedelta(days=1),
                metadata_json={"qa": "issue-from-profile", "run": run_id},
            )
            session.add_all([owner, subscriber, license_record])
            await session.flush()

            api_key_record, api_key_plaintext = await create_api_key(
                session,
                owner_user_id=owner.id,
                request=ApiKeyCreateRequest(
                    name=f"{run_id}-api",
                    scopes=[Permission.SUBSCRIPTION_MANAGE],
                    expires_at=datetime.now(UTC) + timedelta(minutes=20),
                ),
                settings=settings,
            )
            await session.commit()
            ids = {
                "owner": owner.id,
                "subscriber": subscriber.id,
                "license": license_record.id,
                "api_key": api_key_record.id,
                "profile": profile.id,
                "host": host.id,
            }

        status, body = _request_json(
            "/api/v1/subscriptions/actions/issue-from-profile",
            api_key=api_key_plaintext,
            payload={
                "user_id": str(ids["subscriber"]),
                "license_id": str(ids["license"]),
                "profile_id": str(ids["profile"]),
                "host_id": str(ids["host"]),
                "render_targets": ["happ", "sing-box", "mihomo"],
                "profile_title": "Lumen issue-from-profile smoke",
            },
        )
        if status != 201:
            raise AssertionError(f"issue-from-profile expected 201, got {status}: {body}")
        created_subscription_id = body["id"]
        if body["delivery_profile"]["profile_id"] != str(ids["profile"]):
            raise AssertionError("response did not preserve profile_id")
        if body["delivery_profile"]["host_id"] != str(ids["host"]):
            raise AssertionError("response did not preserve host_id")
        if "happ" not in body["public_render_urls"] or "sing-box" not in body["public_render_urls"]:
            raise AssertionError("response did not expose requested render URLs")

        public_id = body["public_id"]
        happ_status, happ_headers, happ_body = _get(
            f"/api/v1/subscriptions/public/{public_id}/render?target=happ",
        )
        if happ_status != 200 or not happ_body.startswith("vless://"):
            raise AssertionError(f"happ render failed: {happ_status}")
        if happ_headers.get("x-lumen-render-target") != "happ":
            raise AssertionError("happ render missing target header")

        async with sessionmaker() as session:
            refreshed_profile = await session.get(ProtocolProfile, ids["profile"])
            refreshed_host = await session.get(Host, ids["host"])
            if refreshed_profile is None or refreshed_host is None:
                raise AssertionError("linked profile/host disappeared during smoke")
            profile_sync = (refreshed_profile.metadata_json or {}).get("runtime_sync") or {}
            host_sync = (refreshed_host.metadata_json or {}).get("runtime_sync") or {}
            if profile_sync.get("pending_apply") is not True:
                raise AssertionError(f"profile was not marked pending_apply: {profile_sync}")
            if host_sync.get("pending_apply") is not True:
                raise AssertionError(f"host was not marked pending_apply: {host_sync}")
            if profile_sync.get("reason") != "subscription.created":
                raise AssertionError(f"profile runtime_sync reason mismatch: {profile_sync}")
            if host_sync.get("reason") != "subscription.created":
                raise AssertionError(f"host runtime_sync reason mismatch: {host_sync}")
            if "subscription" not in set(profile_sync.get("changed_fields") or []):
                raise AssertionError(f"profile runtime_sync changed_fields mismatch: {profile_sync}")
            if "subscription" not in set(host_sync.get("changed_fields") or []):
                raise AssertionError(f"host runtime_sync changed_fields mismatch: {host_sync}")

            await session.execute(delete(Subscription).where(Subscription.id == created_subscription_id))
            await session.execute(delete(ApiKey).where(ApiKey.id == ids["api_key"]))
            await session.execute(delete(License).where(License.id == ids["license"]))
            await session.execute(delete(User).where(User.id.in_([ids["owner"], ids["subscriber"]])))
            await session.commit()
            leftovers = {
                "subscriptions": (
                    await session.execute(
                        select(func.count())
                        .select_from(Subscription)
                        .where(Subscription.user_id == ids["subscriber"])
                    )
                ).scalar_one(),
                "api_keys": (
                    await session.execute(
                        select(func.count()).select_from(ApiKey).where(ApiKey.id == ids["api_key"])
                    )
                ).scalar_one(),
                "licenses": (
                    await session.execute(
                        select(func.count()).select_from(License).where(License.customer_ref == run_id)
                    )
                ).scalar_one(),
                "users": (
                    await session.execute(
                        select(func.count()).select_from(User).where(User.username.like(f"{run_id}%"))
                    )
                ).scalar_one(),
            }
        print(
            json.dumps(
                {
                    "ok": True,
                    "issue_status": status,
                    "happ_status": happ_status,
                    "render_targets": sorted(body["public_render_urls"].keys()),
                    "runtime_sync": {
                        "profile_pending_apply": profile_sync.get("pending_apply"),
                        "profile_reason": profile_sync.get("reason"),
                        "host_pending_apply": host_sync.get("pending_apply"),
                        "host_reason": host_sync.get("reason"),
                    },
                    "cleanup_leftovers": leftovers,
                },
                ensure_ascii=False,
            )
        )
    finally:
        async with sessionmaker() as session:
            if created_subscription_id is not None:
                await session.execute(delete(Subscription).where(Subscription.id == created_subscription_id))
            if "api_key" in ids:
                await session.execute(delete(ApiKey).where(ApiKey.id == ids["api_key"]))
            if "license" in ids:
                await session.execute(delete(License).where(License.id == ids["license"]))
            user_ids = [value for key, value in ids.items() if key in {"owner", "subscriber"}]
            if user_ids:
                await session.execute(delete(User).where(User.id.in_(user_ids)))
            await session.commit()
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())

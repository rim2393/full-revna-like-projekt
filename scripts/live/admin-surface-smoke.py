from __future__ import annotations

import asyncio
import json
import os
import secrets
import ssl
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.config import get_settings
from app.core.rbac import Permission
from app.db.session import create_engine
from app.domains.api_keys.models import ApiKey
from app.domains.api_keys.schemas import ApiKeyCreateRequest
from app.domains.api_keys.service import create_api_key
from app.domains.protocols.models import Host, ProtocolProfile, Squad
from app.domains.subscriptions.models import Subscription
from app.domains.users.models import User


PANEL_PUBLIC_URL = os.environ.get("PANEL_PUBLIC_URL", "https://panel.lumentech.tel").rstrip("/")


def _request(
    method: str,
    path: str,
    *,
    api_key: str,
    payload: dict[str, Any] | None = None,
    query: dict[str, str] | None = None,
) -> tuple[int, dict[str, Any]]:
    suffix = path
    if query:
        suffix = f"{suffix}?{urlencode(query)}"
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    request = Request(
        f"{PANEL_PUBLIC_URL}{suffix}",
        data=body,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "Lumen-admin-surface-live-smoke/1.0",
            "X-Lumen-Api-Key": api_key,
        },
        method=method,
    )
    try:
        with urlopen(request, timeout=20, context=ssl.create_default_context()) as response:
            raw = response.read().decode("utf-8", errors="replace")
            return response.status, json.loads(raw) if raw else {}
    except HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            parsed = {"raw": raw}
        return exc.code, parsed


def _assert_items(name: str, body: dict[str, Any]) -> int:
    items = body.get("items")
    if not isinstance(items, list):
        raise AssertionError(f"{name}: expected items list")
    return len(items)


def _assert_status(name: str, status: int, body: dict[str, Any], expected: int = 200) -> None:
    if status != expected:
        raise AssertionError(f"{name}: expected {expected}, got {status}: {body}")


async def main() -> None:
    run_id = f"qa-admin-surface-{secrets.token_hex(6)}"
    settings = get_settings()
    engine = create_engine(settings)
    sessionmaker = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    ids: dict[str, Any] = {}
    try:
        async with sessionmaker() as session:
            owner = User(
                email=f"{run_id}-owner@example.test",
                username=f"{run_id}-owner",
                role="owner",
                status="active",
                metadata_json={"qa": "admin-surface", "run": run_id},
            )
            session.add(owner)
            await session.flush()
            api_key_record, api_key_plaintext = await create_api_key(
                session,
                owner_user_id=owner.id,
                request=ApiKeyCreateRequest(
                    name=f"{run_id}-api",
                    scopes=list(Permission),
                    expires_at=datetime.now(UTC) + timedelta(minutes=20),
                ),
                settings=settings,
            )
            await session.commit()
            ids = {"owner": owner.id, "api_key": api_key_record.id}

        checks: dict[str, int | str | bool] = {}
        list_endpoints = {
            "nodes": "/api/v1/nodes",
            "profiles": "/api/v1/profiles",
            "hosts": "/api/v1/hosts",
            "squads": "/api/v1/squads",
            "users": "/api/v1/users",
            "subscriptions": "/api/v1/subscriptions",
            "api_keys": "/api/v1/api-keys",
            "licenses": "/api/v1/licenses",
            "settings": "/api/v1/settings",
            "setting_groups": "/api/v1/settings/groups",
            "auth_providers": "/api/v1/settings/auth/providers",
            "templates": "/api/v1/subscription-templates",
            "response_rules": "/api/v1/response-rules",
            "subpage_configs": "/api/v1/subscription-page-configs",
            "audit_events": "/api/v1/audit/events",
            "node_plugins": "/api/v1/node-plugins",
            "infra_providers": "/api/v1/infra-billing/providers",
            "infra_records": "/api/v1/infra-billing/records",
            "ip_rules": "/api/v1/ip-control/rules",
            "ip_events": "/api/v1/ip-control/events",
        }
        for name, path in list_endpoints.items():
            status, body = _request("GET", path, api_key=api_key_plaintext)
            _assert_status(name, status, body)
            checks[name] = _assert_items(name, body)

        tool_endpoints = {
            "tools_summary": "/api/v1/tools/summary",
            "tools_hwid": "/api/v1/tools/hwid-inspector",
            "tools_top_users": "/api/v1/tools/top-users",
            "tools_user_ips": "/api/v1/tools/user-ips",
            "tools_node_user_ips": "/api/v1/tools/node-user-ips",
            "tools_srh": "/api/v1/tools/srh-inspector",
            "tools_sessions": "/api/v1/tools/sessions",
            "tools_torrent": "/api/v1/tools/torrent-blocker-reports",
            "tools_happ_routing": "/api/v1/tools/happ-routing",
            "tools_snippets": "/api/v1/tools/snippets",
        }
        for name, path in tool_endpoints.items():
            status, body = _request("GET", path, api_key=api_key_plaintext)
            _assert_status(name, status, body)
            if "items" in body:
                checks[name] = _assert_items(name, body)
            else:
                checks[name] = "ok"

        status, body = _request(
            "POST",
            "/api/v1/response-rules/test",
            api_key=api_key_plaintext,
            payload={"subscription_status": "active"},
        )
        _assert_status("response_rule_test", status, body)
        checks["response_rule_test"] = "matched" in body

        status, body = _request(
            "POST",
            "/api/v1/tools/happ-routing/build",
            api_key=api_key_plaintext,
            payload={
                "mode": "off",
                "subscription_url": "https://sub.example.invalid/sub/test",
                "crypto_method": "v4",
            },
        )
        _assert_status("happ_routing_build", status, body)
        if not isinstance(body.get("routing_link"), str) or not body["routing_link"]:
            raise AssertionError("happ_routing_build: missing routing link")
        checks["happ_routing_build"] = "ok"

        status, body = _request("POST", "/api/v1/tools/x25519-keypair", api_key=api_key_plaintext)
        _assert_status("x25519_keypair", status, body)
        if not body.get("public_key") or not body.get("private_key"):
            raise AssertionError("x25519_keypair: missing keys")
        checks["x25519_keypair"] = "ok"

        if checks["nodes"] < 1:
            raise AssertionError("nodes: expected at least one real node")
        if checks["profiles"] < 1:
            raise AssertionError("profiles: expected at least one real profile")
        if checks["hosts"] < 1:
            raise AssertionError("hosts: expected at least one real host")

        async with sessionmaker() as session:
            await session.execute(delete(ApiKey).where(ApiKey.id == ids["api_key"]))
            await session.execute(delete(User).where(User.id == ids["owner"]))
            await session.commit()
            leftovers = {
                "api_keys": (
                    await session.execute(
                        select(func.count()).select_from(ApiKey).where(ApiKey.id == ids["api_key"])
                    )
                ).scalar_one(),
                "users": (
                    await session.execute(
                        select(func.count()).select_from(User).where(User.username == f"{run_id}-owner")
                    )
                ).scalar_one(),
                "qa_subscriptions": (
                    await session.execute(
                        select(func.count())
                        .select_from(Subscription)
                        .where(Subscription.delivery_profile["run"].as_string() == run_id)
                    )
                ).scalar_one(),
                "qa_profiles": (
                    await session.execute(
                        select(func.count())
                        .select_from(ProtocolProfile)
                        .where(ProtocolProfile.metadata_json["run"].as_string() == run_id)
                    )
                ).scalar_one(),
                "qa_hosts": (
                    await session.execute(
                        select(func.count())
                        .select_from(Host)
                        .where(Host.metadata_json["run"].as_string() == run_id)
                    )
                ).scalar_one(),
                "qa_squads": (
                    await session.execute(
                        select(func.count())
                        .select_from(Squad)
                        .where(Squad.metadata_json["run"].as_string() == run_id)
                    )
                ).scalar_one(),
            }
        print(
            json.dumps(
                {
                    "ok": True,
                    "checks": checks,
                    "cleanup_leftovers": leftovers,
                },
                ensure_ascii=False,
                sort_keys=True,
            )
        )
    finally:
        async with sessionmaker() as session:
            if "api_key" in ids:
                await session.execute(delete(ApiKey).where(ApiKey.id == ids["api_key"]))
            if "owner" in ids:
                await session.execute(delete(User).where(User.id == ids["owner"]))
            await session.commit()
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())

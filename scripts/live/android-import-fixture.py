from __future__ import annotations

import argparse
import asyncio
import json
import os
import secrets
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

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


QA_PREFIX = "qa-pr006-android"


def _write_state(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    path.chmod(0o600)


async def create_fixture(state_path: Path, panel_public_url: str) -> None:
    run_id = f"{QA_PREFIX}-{secrets.token_hex(6)}"
    settings = get_settings()
    engine = create_engine(settings)
    sessionmaker = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    try:
        async with sessionmaker() as session:
            node = (
                await session.execute(select(Node).where(Node.name == "node-01").order_by(Node.created_at.desc()))
            ).scalar_one_or_none()
            if node is None:
                node = (await session.execute(select(Node).order_by(Node.created_at.desc()))).scalars().first()
            if node is None:
                raise RuntimeError("No real node exists for Android live import fixture")

            user = User(
                email=f"{run_id}@example.test",
                username=run_id,
                display_name="Android live import fixture",
                status="active",
                traffic_limit_gb=500,
                traffic_used_gb=0,
                device_limit=10,
                expires_at=datetime.now(UTC) + timedelta(hours=6),
                tags=["qa", "pr006", "android"],
                metadata_json={"qa": "pr006-android", "run": run_id},
            )
            session.add(user)
            await session.flush()

            license_record = License(
                license_key_hash=hash_license_key(f"{run_id}-license"),
                customer_ref=run_id,
                status="active",
                max_devices=10,
                starts_at=datetime.now(UTC) - timedelta(minutes=1),
                expires_at=datetime.now(UTC) + timedelta(hours=6),
                metadata_json={"qa": "pr006-android", "run": run_id},
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
                    "profile_title": "Lumen Android Live Import",
                    "server_name": "www.example.com",
                    "public_key": "F1E2D3C4B5A69788776655443322110abcdEFGH_-",
                    "short_id": "a1b2c3d4",
                    "fingerprint": "chrome",
                    "spider_x": "/",
                    "flow": "xtls-rprx-vision",
                    "traffic_limit_gb": "500",
                    "client": "happ",
                },
                config_hash=f"sha256:{run_id}",
                expires_at=datetime.now(UTC) + timedelta(hours=6),
            )
            session.add(subscription)
            await session.commit()

            _write_state(
                state_path,
                {
                    "run_id": run_id,
                    "public_url": (
                        f"{panel_public_url.rstrip('/')}/api/v1/subscriptions/public/"
                        f"{public_id}/render?target=happ"
                    ),
                    "subscription_id": str(subscription.id),
                    "license_id": str(license_record.id),
                    "user_id": str(user.id),
                },
            )
        print(json.dumps({"ok": True, "fixture": "created"}, ensure_ascii=False))
    finally:
        await engine.dispose()


async def cleanup_fixture(state_path: Path) -> None:
    if not state_path.exists():
        print(json.dumps({"ok": True, "fixture": "missing", "cleanup_leftovers": {}}))
        return
    state = json.loads(state_path.read_text(encoding="utf-8"))
    settings = get_settings()
    engine = create_engine(settings)
    sessionmaker = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    try:
        async with sessionmaker() as session:
            if state.get("subscription_id"):
                await session.execute(delete(Subscription).where(Subscription.id == state["subscription_id"]))
            if state.get("license_id"):
                await session.execute(delete(License).where(License.id == state["license_id"]))
            if state.get("user_id"):
                await session.execute(delete(User).where(User.id == state["user_id"]))
            await session.commit()
            leftovers = {
                "subscriptions": (
                    await session.execute(
                        select(func.count()).select_from(Subscription).where(Subscription.config_hash.like(f"sha256:{QA_PREFIX}-%"))
                    )
                ).scalar_one(),
                "licenses": (
                    await session.execute(select(func.count()).select_from(License).where(License.customer_ref.like(f"{QA_PREFIX}-%")))
                ).scalar_one(),
                "users": (
                    await session.execute(select(func.count()).select_from(User).where(User.username.like(f"{QA_PREFIX}-%")))
                ).scalar_one(),
            }
            await session.commit()
        state_path.unlink(missing_ok=True)
        print(json.dumps({"ok": True, "fixture": "cleaned", "cleanup_leftovers": leftovers}, ensure_ascii=False))
    finally:
        await engine.dispose()


async def main() -> None:
    parser = argparse.ArgumentParser(description="Create or clean a real temporary Android import fixture.")
    parser.add_argument("action", choices=("create", "cleanup"))
    parser.add_argument("--state", default="/tmp/lumen-android-import-fixture.json")
    parser.add_argument("--panel-public-url", default=os.environ.get("PANEL_PUBLIC_URL", "https://panel.lumentech.tel"))
    args = parser.parse_args()
    state_path = Path(args.state)
    if args.action == "create":
        await create_fixture(state_path, args.panel_public_url)
    else:
        await cleanup_fixture(state_path)


if __name__ == "__main__":
    asyncio.run(main())

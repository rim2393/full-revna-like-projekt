from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path

import app.db.models  # noqa: F401
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.config import get_settings
from app.db.session import create_engine
from app.domains.subscriptions.models import Subscription
from app.domains.subscriptions.service import build_subscription_manifest


async def verify_flow(state_path: Path, adapter: str) -> None:
    state = json.loads(state_path.read_text(encoding="utf-8"))
    settings = get_settings()
    engine = create_engine(settings)
    sessionmaker = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    try:
        async with sessionmaker() as session:
            subscription = await session.get(Subscription, state["subscription_id"])
            if subscription is None:
                raise RuntimeError("Subscription from smoke state does not exist")
            manifest = await build_subscription_manifest(session, subscription_id=subscription.id)
            flows = [
                protocol.get("flow")
                for node in manifest["nodes"]
                for protocol in node["protocols"]
                if protocol.get("adapter") == adapter
            ]
            print(
                json.dumps(
                    {
                        "ok": True,
                        "adapter": adapter,
                        "flow_present": bool(flows and flows[0]),
                    },
                    ensure_ascii=False,
                )
            )
    finally:
        await engine.dispose()


async def main() -> None:
    parser = argparse.ArgumentParser(description="Verify profile-backed subscription flow rendering.")
    parser.add_argument("--state", required=True)
    parser.add_argument("--adapter", required=True)
    args = parser.parse_args()
    await verify_flow(Path(args.state), args.adapter)


if __name__ == "__main__":
    asyncio.run(main())

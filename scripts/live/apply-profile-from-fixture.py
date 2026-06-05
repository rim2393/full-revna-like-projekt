from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path
from uuid import UUID

import app.db.models  # noqa: F401
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.config import get_settings
from app.db.session import create_engine
from app.domains.protocols.service import apply_profile_to_node
from app.domains.subscriptions.models import Subscription


async def apply_from_fixture(state_path: Path) -> None:
    state = json.loads(state_path.read_text(encoding="utf-8"))
    settings = get_settings()
    engine = create_engine(settings)
    sessionmaker = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    try:
        async with sessionmaker() as session:
            subscription = await session.get(Subscription, UUID(state["subscription_id"]))
            if subscription is None:
                raise RuntimeError("Subscription from smoke state does not exist")
            profile_id = subscription.delivery_profile.get("profile_id")
            if not profile_id:
                raise RuntimeError("Fixture subscription is not profile-backed")
            command = await apply_profile_to_node(session, profile_id=UUID(profile_id))
            await session.commit()
            print(
                json.dumps(
                    {
                        "ok": True,
                        "adapter": state.get("adapter"),
                        "command_status": command.status,
                        "command_type": command.command_type,
                    },
                    ensure_ascii=False,
                )
            )
    finally:
        await engine.dispose()


async def main() -> None:
    parser = argparse.ArgumentParser(description="Apply the protocol profile referenced by a live fixture.")
    parser.add_argument("--state", required=True)
    args = parser.parse_args()
    await apply_from_fixture(Path(args.state))


if __name__ == "__main__":
    asyncio.run(main())

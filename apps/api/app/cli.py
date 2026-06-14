import argparse
import asyncio
import os
import secrets
import sys
import time
from collections.abc import Sequence
from urllib.parse import urlparse

from pydantic import SecretStr
from sqlalchemy.ext.asyncio import async_sessionmaker

from alembic import command
from alembic.config import Config
from app.core.config import Settings, get_settings
from app.db.session import create_engine
from app.domains.users.bootstrap import bootstrap_first_admin


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="lumen-api")
    subparsers = parser.add_subparsers(dest="command", required=True)

    migrate_parser = subparsers.add_parser("migrate", help="Run database migrations.")
    migrate_parser.set_defaults(func=_migrate)

    bootstrap_parser = subparsers.add_parser(
        "bootstrap-admin",
        help="Create the first owner account when no users exist.",
    )
    bootstrap_parser.add_argument("--email", required=True)
    bootstrap_parser.add_argument("--username", required=True)
    password_group = bootstrap_parser.add_mutually_exclusive_group(required=True)
    password_group.add_argument("--password-env")
    password_group.add_argument("--generate-password", action="store_true")
    bootstrap_parser.set_defaults(func=_bootstrap_admin)

    healthcheck_parser = subparsers.add_parser("healthcheck", help="Check the running API.")
    healthcheck_parser.add_argument(
        "--url",
        default=f"http://127.0.0.1:{os.environ.get('PORT', '8080')}/healthz",
    )
    healthcheck_parser.set_defaults(func=_healthcheck)

    serve_parser = subparsers.add_parser("serve", help="Run the API server.")
    serve_parser.add_argument("--host", default="127.0.0.1")
    serve_parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8080")))
    serve_parser.set_defaults(func=_serve)

    worker_parser = subparsers.add_parser("worker", help="Run the background worker process.")
    worker_parser.add_argument("--queues", default="critical,default,provisioning,low")
    worker_parser.set_defaults(func=_worker)

    scheduler_parser = subparsers.add_parser("scheduler", help="Run the scheduler process.")
    scheduler_parser.set_defaults(func=_scheduler)

    args = parser.parse_args(argv)
    _bridge_release_env()
    return int(args.func(args))


def _bridge_release_env() -> None:
    aliases = {
        "DATABASE_URL": "LUMEN_DATABASE_URL",
        "API_TOKEN_PEPPER": "LUMEN_API_KEY_HASH_PEPPER",
        "REFRESH_SECRET": "LUMEN_SESSION_HASH_PEPPER",
        "NODE_CA_SEED": "LUMEN_NODE_TOKEN_HASH_PEPPER",
    }
    for source, target in aliases.items():
        if os.environ.get(source) and not os.environ.get(target):
            os.environ[target] = os.environ[source]
    get_settings.cache_clear()


def _migrate(_: argparse.Namespace) -> int:
    alembic_cfg = Config("alembic.ini")
    command.upgrade(alembic_cfg, "head")
    return 0


def _bootstrap_admin(args: argparse.Namespace) -> int:
    password: str
    generated = False
    if args.generate_password:
        password = secrets.token_urlsafe(24)
        generated = True
    else:
        password = os.environ.get(args.password_env, "")
        if not password:
            print(f"{args.password_env} is empty or unset", file=sys.stderr)
            return 2

    settings = Settings(
        first_admin_email=args.email,
        first_admin_username=args.username,
        first_admin_password=SecretStr(password),
    )
    created = asyncio.run(_run_bootstrap(settings))
    if created:
        print("first admin owner account created", file=sys.stderr)
        if generated:
            print(password)
    else:
        print(
            "first admin bootstrap skipped; users already exist or input is incomplete",
            file=sys.stderr,
        )
    return 0


async def _run_bootstrap(settings: Settings) -> bool:
    engine = create_engine(settings)
    session_factory = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)
    try:
        async with session_factory() as session:
            created = await bootstrap_first_admin(session, settings)
            await session.commit()
            return created
    finally:
        await engine.dispose()


def _healthcheck(args: argparse.Namespace) -> int:
    from urllib.error import URLError
    from urllib.request import urlopen

    parsed_url = urlparse(args.url)
    if parsed_url.scheme not in {"http", "https"}:
        print("healthcheck URL must use http or https", file=sys.stderr)
        return 2

    try:
        with urlopen(args.url, timeout=3) as response:  # noqa: S310
            return 0 if 200 <= response.status < 300 else 1
    except URLError as exc:
        print(f"healthcheck failed: {exc}", file=sys.stderr)
        return 1


def _serve(args: argparse.Namespace) -> int:
    import uvicorn

    uvicorn.run("app.main:create_app", factory=True, host=args.host, port=args.port)
    return 0


def _worker(args: argparse.Namespace) -> int:
    print(f"lumen-api worker active for queues: {args.queues}", file=sys.stderr)
    _sleep_forever()
    return 0


def _scheduler(_: argparse.Namespace) -> int:
    print("lumen-api scheduler active", file=sys.stderr)
    _sleep_forever()
    return 0


def _sleep_forever() -> None:
    while True:
        time.sleep(3600)


if __name__ == "__main__":
    raise SystemExit(main())

import base64
import json
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from pydantic import SecretStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import app.db.models  # noqa: F401
from app.core.config import Settings
from app.core.errors import APIError
from app.core.rbac import Permission, Role
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import create_engine, create_sessionmaker
from app.domains.api_keys.models import ApiKey
from app.domains.api_keys.schemas import ApiKeyCreateRequest
from app.domains.api_keys.service import create_api_key, verify_api_key
from app.domains.licenses.models import License
from app.domains.licenses.service import (
    enforce_free_node_policy,
    get_effective_node_limit,
    hash_license_key,
)
from app.domains.nodes.models import Node
from app.domains.users.models import User


@pytest.fixture
async def db_session(tmp_path) -> AsyncIterator[tuple[AsyncSession, Settings]]:
    settings = Settings(
        environment="test",
        database_url=f"sqlite+aiosqlite:///{tmp_path / 'api.db'}",
        api_key_hash_pepper=SecretStr("test-api-key-pepper"),
        session_hash_pepper=SecretStr("test-session-pepper"),
    )
    engine = create_engine(settings)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    sessionmaker = create_sessionmaker(settings)
    async with sessionmaker() as session:
        yield session, settings

    await engine.dispose()


async def seed_user(session: AsyncSession) -> User:
    user = User(
        email="owner@example.com",
        password_hash=hash_password(SecretStr("correct horse battery staple")),
        role=Role.OWNER.value,
        status="active",
    )
    session.add(user)
    await session.flush()
    return user


async def test_api_key_create_stores_hash_and_verifies_required_scope(
    db_session: tuple[AsyncSession, Settings],
) -> None:
    session, settings = db_session
    owner = await seed_user(session)

    record, plaintext = await create_api_key(
        session,
        owner_user_id=owner.id,
        request=ApiKeyCreateRequest(
            name="node automation",
            scopes=[Permission.NODE_MANAGE.value],
        ),
        settings=settings,
    )
    await session.commit()

    assert plaintext.startswith("lumen_sk_")
    assert record.key_hash != plaintext
    assert record.key_prefix == plaintext[:18]

    persisted = (await session.execute(select(ApiKey))).scalar_one()
    assert persisted.key_hash != plaintext
    assert persisted.key_prefix != plaintext
    assert persisted.scopes == [Permission.NODE_MANAGE.value]

    verified = await verify_api_key(
        session,
        api_key=plaintext,
        settings=settings,
        required_scopes=[Permission.NODE_MANAGE],
    )

    assert verified.id == record.id
    assert verified.last_used_at is not None


async def test_api_key_verify_rejects_invalid_missing_scope_and_expired_key(
    db_session: tuple[AsyncSession, Settings],
) -> None:
    session, settings = db_session
    owner = await seed_user(session)
    record, plaintext = await create_api_key(
        session,
        owner_user_id=owner.id,
        request=ApiKeyCreateRequest(name="limited", scopes=[Permission.SUBSCRIPTION_READ.value]),
        settings=settings,
    )

    with pytest.raises(APIError) as missing_scope:
        await verify_api_key(
            session,
            api_key=plaintext,
            settings=settings,
            required_scopes=[Permission.LICENSE_MANAGE],
        )
    assert missing_scope.value.code == "api_key_scope_denied"
    assert missing_scope.value.status_code == 403

    record.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    await session.flush()
    with pytest.raises(APIError) as expired:
        await verify_api_key(session, api_key=plaintext, settings=settings)
    assert expired.value.code == "api_key_expired"
    assert expired.value.status_code == 401

    with pytest.raises(APIError) as invalid:
        await verify_api_key(session, api_key="lumen_sk_wrong", settings=settings)
    assert invalid.value.code == "invalid_api_key"
    assert invalid.value.status_code == 401


async def test_free_license_policy_allows_three_nodes_and_blocks_fourth(
    db_session: tuple[AsyncSession, Settings],
) -> None:
    session, settings = db_session
    for index in range(2):
        session.add(
            Node(
                name=f"node-{index}",
                region="eu",
                public_address=f"10.0.0.{index + 1}",
                status="active",
                capabilities={},
            )
        )
    await session.flush()

    await enforce_free_node_policy(session, settings)

    session.add(
        Node(
            name="node-3",
            region="eu",
            public_address="10.0.0.3",
            status="active",
            capabilities={},
        )
    )
    await session.flush()

    with pytest.raises(APIError) as limit_error:
        await enforce_free_node_policy(session, settings)
    assert limit_error.value.code == "license_node_limit_exceeded"
    assert limit_error.value.status_code == 403
    assert "effective_limit=3" in limit_error.value.details


async def test_active_license_can_raise_effective_node_limit(
    db_session: tuple[AsyncSession, Settings],
) -> None:
    session, settings = db_session
    private_key = Ed25519PrivateKey.generate()
    license_key_hash = hash_license_key("central-license-key")
    starts_at = datetime.now(UTC) - timedelta(days=1)
    expires_at = datetime.now(UTC) + timedelta(days=1)
    entitlement_token = signed_entitlement_token(
        private_key,
        customer_ref="customer-1",
        license_key_hash=license_key_hash,
        max_devices=5,
        starts_at=starts_at,
        expires_at=expires_at,
    )
    settings = settings.model_copy(
        update={"central_license_public_key_b64": public_key_b64(private_key)}
    )
    session.add(
        License(
            license_key_hash=license_key_hash,
            customer_ref="customer-1",
            status="active",
            max_devices=99,
            starts_at=starts_at,
            expires_at=expires_at,
            metadata_json={"signed_entitlement": entitlement_token},
        )
    )
    for index in range(3):
        session.add(
            Node(
                name=f"node-{index}",
                region="us",
                public_address=f"192.0.2.{index + 1}",
                status="active",
                capabilities={},
            )
        )
    await session.flush()

    assert await get_effective_node_limit(session, settings) == 5
    await enforce_free_node_policy(session, settings)


async def test_forged_central_authority_cannot_raise_effective_node_limit(
    db_session: tuple[AsyncSession, Settings],
) -> None:
    session, settings = db_session
    settings = settings.model_copy(
        update={"central_license_public_key_b64": public_key_b64(Ed25519PrivateKey.generate())}
    )
    session.add(
        License(
            license_key_hash="self-authorized-license-key",
            customer_ref="customer-1",
            status="active",
            max_devices=99,
            starts_at=datetime.now(UTC) - timedelta(days=1),
            expires_at=datetime.now(UTC) + timedelta(days=1),
            metadata_json={"authority": "central_license_server"},
        )
    )
    await session.flush()

    assert await get_effective_node_limit(session, settings) == settings.free_license_node_limit


async def test_forged_entitlement_signature_cannot_raise_effective_node_limit(
    db_session: tuple[AsyncSession, Settings],
) -> None:
    session, settings = db_session
    trusted_key = Ed25519PrivateKey.generate()
    untrusted_key = Ed25519PrivateKey.generate()
    license_key_hash = hash_license_key("forged-entitlement-license-key")
    entitlement_token = signed_entitlement_token(
        untrusted_key,
        customer_ref="customer-1",
        license_key_hash=license_key_hash,
        max_devices=99,
    )
    settings = settings.model_copy(
        update={"central_license_public_key_b64": public_key_b64(trusted_key)}
    )
    session.add(
        License(
            license_key_hash=license_key_hash,
            customer_ref="customer-1",
            status="active",
            max_devices=99,
            metadata_json={"signed_entitlement": entitlement_token},
        )
    )
    await session.flush()

    assert await get_effective_node_limit(session, settings) == settings.free_license_node_limit


def signed_entitlement_token(
    private_key: Ed25519PrivateKey,
    *,
    license_key_hash: str,
    max_devices: int,
    customer_ref: str | None = None,
    starts_at: datetime | None = None,
    expires_at: datetime | None = None,
) -> str:
    payload = json.dumps(
        {
            "customer_ref": customer_ref,
            "expires_at": expires_at.isoformat() if expires_at else None,
            "issued_at": datetime.now(UTC).isoformat(),
            "key_id": "test-central-v1",
            "license_key_hash": license_key_hash,
            "max_devices": max_devices,
            "schema_version": 1,
            "starts_at": starts_at.isoformat() if starts_at else None,
            "status": "active",
        },
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    signature = private_key.sign(payload)
    return f"{b64url(payload)}.{b64url(signature)}"


def public_key_b64(private_key: Ed25519PrivateKey) -> str:
    public_key = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    return b64url(public_key)


def b64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")

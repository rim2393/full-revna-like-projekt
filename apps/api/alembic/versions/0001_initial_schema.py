"""Initial Lumen API schema.

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-05-27 00:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0001_initial_schema"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.String(length=512), nullable=True),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=False)

    op.create_table(
        "licenses",
        sa.Column("license_key_hash", sa.String(length=128), nullable=False),
        sa.Column("customer_ref", sa.String(length=128), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("max_devices", sa.Integer(), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_licenses"),
        sa.UniqueConstraint("license_key_hash", name="uq_licenses_license_key_hash"),
    )
    op.create_index("ix_licenses_customer_ref", "licenses", ["customer_ref"], unique=False)
    op.create_index("ix_licenses_license_key_hash", "licenses", ["license_key_hash"], unique=False)

    op.create_table(
        "nodes",
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("region", sa.String(length=64), nullable=False),
        sa.Column("public_address", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("capabilities", sa.JSON(), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("enrolled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("agent_token_prefix", sa.String(length=24), nullable=True),
        sa.Column("agent_token_hash", sa.String(length=128), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_nodes"),
        sa.UniqueConstraint("agent_token_hash", name="uq_nodes_agent_token_hash"),
        sa.UniqueConstraint("name", name="uq_nodes_name"),
    )
    op.create_index("ix_nodes_agent_token_hash", "nodes", ["agent_token_hash"], unique=False)
    op.create_index("ix_nodes_agent_token_prefix", "nodes", ["agent_token_prefix"], unique=False)
    op.create_index("ix_nodes_region", "nodes", ["region"], unique=False)

    op.create_table(
        "node_provisioning_jobs",
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        sa.Column("node_id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("preflight_status", sa.String(length=32), nullable=False),
        sa.Column("ssh_host", sa.String(length=255), nullable=False),
        sa.Column("ssh_port", sa.Integer(), nullable=False),
        sa.Column("ssh_username", sa.String(length=128), nullable=False),
        sa.Column("ssh_credentials_ref", sa.String(length=512), nullable=False),
        sa.Column("requested_capabilities", sa.JSON(), nullable=False),
        sa.Column("preflight_result", sa.JSON(), nullable=False),
        sa.Column("error_code", sa.String(length=64), nullable=True),
        sa.Column("error_message", sa.String(length=512), nullable=True),
        sa.Column("token_issued_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("token_exchanged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["node_id"],
            ["nodes.id"],
            name="fk_node_provisioning_jobs_node_id_nodes",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_node_provisioning_jobs"),
        sa.UniqueConstraint(
            "idempotency_key",
            name="uq_node_provisioning_jobs_idempotency_key",
        ),
    )
    op.create_index(
        "ix_node_provisioning_jobs_idempotency_key",
        "node_provisioning_jobs",
        ["idempotency_key"],
        unique=False,
    )
    op.create_index(
        "ix_node_provisioning_jobs_node_id",
        "node_provisioning_jobs",
        ["node_id"],
        unique=False,
    )
    op.create_index(
        "ix_node_provisioning_jobs_status",
        "node_provisioning_jobs",
        ["status"],
        unique=False,
    )

    op.create_table(
        "node_install_tokens",
        sa.Column("provisioning_job_id", sa.Uuid(), nullable=False),
        sa.Column("token_prefix", sa.String(length=24), nullable=False),
        sa.Column("token_hash", sa.String(length=128), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["provisioning_job_id"],
            ["node_provisioning_jobs.id"],
            name="fk_node_install_tokens_provisioning_job_id_node_provisioning_jobs",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_node_install_tokens"),
        sa.UniqueConstraint(
            "provisioning_job_id",
            name="uq_node_install_tokens_provisioning_job_id",
        ),
        sa.UniqueConstraint("token_hash", name="uq_node_install_tokens_token_hash"),
    )
    op.create_index(
        "ix_node_install_tokens_provisioning_job_id",
        "node_install_tokens",
        ["provisioning_job_id"],
        unique=False,
    )
    op.create_index(
        "ix_node_install_tokens_token_hash",
        "node_install_tokens",
        ["token_hash"],
        unique=False,
    )
    op.create_index(
        "ix_node_install_tokens_token_prefix",
        "node_install_tokens",
        ["token_prefix"],
        unique=False,
    )

    op.create_table(
        "api_keys",
        sa.Column("owner_user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("key_prefix", sa.String(length=24), nullable=False),
        sa.Column("key_hash", sa.String(length=128), nullable=False),
        sa.Column("scopes", sa.JSON(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["owner_user_id"],
            ["users.id"],
            name="fk_api_keys_owner_user_id_users",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_api_keys"),
        sa.UniqueConstraint("key_hash", name="uq_api_keys_key_hash"),
    )
    op.create_index("ix_api_keys_key_hash", "api_keys", ["key_hash"], unique=False)
    op.create_index("ix_api_keys_key_prefix", "api_keys", ["key_prefix"], unique=False)
    op.create_index("ix_api_keys_owner_user_id", "api_keys", ["owner_user_id"], unique=False)

    op.create_table(
        "user_sessions",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.String(length=128), nullable=False),
        sa.Column("ip_hash", sa.String(length=128), nullable=True),
        sa.Column("user_agent_hash", sa.String(length=128), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_user_sessions_user_id_users",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_user_sessions"),
        sa.UniqueConstraint("token_hash", name="uq_user_sessions_token_hash"),
    )
    op.create_index("ix_user_sessions_token_hash", "user_sessions", ["token_hash"], unique=False)
    op.create_index("ix_user_sessions_user_id", "user_sessions", ["user_id"], unique=False)

    op.create_table(
        "subscriptions",
        sa.Column("public_id", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("license_id", sa.Uuid(), nullable=False),
        sa.Column("node_id", sa.Uuid(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("delivery_profile", sa.JSON(), nullable=False),
        sa.Column("config_hash", sa.String(length=128), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["license_id"],
            ["licenses.id"],
            name="fk_subscriptions_license_id_licenses",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["node_id"],
            ["nodes.id"],
            name="fk_subscriptions_node_id_nodes",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_subscriptions_user_id_users",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_subscriptions"),
        sa.UniqueConstraint("public_id", name="uq_subscriptions_public_id"),
    )
    op.create_index("ix_subscriptions_license_id", "subscriptions", ["license_id"], unique=False)
    op.create_index("ix_subscriptions_node_id", "subscriptions", ["node_id"], unique=False)
    op.create_index("ix_subscriptions_public_id", "subscriptions", ["public_id"], unique=False)
    op.create_index("ix_subscriptions_user_id", "subscriptions", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_subscriptions_user_id", table_name="subscriptions")
    op.drop_index("ix_subscriptions_public_id", table_name="subscriptions")
    op.drop_index("ix_subscriptions_node_id", table_name="subscriptions")
    op.drop_index("ix_subscriptions_license_id", table_name="subscriptions")
    op.drop_table("subscriptions")

    op.drop_index("ix_user_sessions_user_id", table_name="user_sessions")
    op.drop_index("ix_user_sessions_token_hash", table_name="user_sessions")
    op.drop_table("user_sessions")

    op.drop_index("ix_api_keys_owner_user_id", table_name="api_keys")
    op.drop_index("ix_api_keys_key_prefix", table_name="api_keys")
    op.drop_index("ix_api_keys_key_hash", table_name="api_keys")
    op.drop_table("api_keys")

    op.drop_index("ix_node_install_tokens_token_prefix", table_name="node_install_tokens")
    op.drop_index("ix_node_install_tokens_token_hash", table_name="node_install_tokens")
    op.drop_index(
        "ix_node_install_tokens_provisioning_job_id",
        table_name="node_install_tokens",
    )
    op.drop_table("node_install_tokens")

    op.drop_index("ix_node_provisioning_jobs_status", table_name="node_provisioning_jobs")
    op.drop_index("ix_node_provisioning_jobs_node_id", table_name="node_provisioning_jobs")
    op.drop_index(
        "ix_node_provisioning_jobs_idempotency_key",
        table_name="node_provisioning_jobs",
    )
    op.drop_table("node_provisioning_jobs")

    op.drop_index("ix_nodes_agent_token_prefix", table_name="nodes")
    op.drop_index("ix_nodes_agent_token_hash", table_name="nodes")
    op.drop_index("ix_nodes_region", table_name="nodes")
    op.drop_table("nodes")

    op.drop_index("ix_licenses_license_key_hash", table_name="licenses")
    op.drop_index("ix_licenses_customer_ref", table_name="licenses")
    op.drop_table("licenses")

    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")

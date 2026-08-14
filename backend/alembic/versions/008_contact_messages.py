"""Add contact_messages — the public contact page's submissions.

The contact page (Watermelon UI contact-7) asks for a name, an email, an enquiry type
and a message. `leads` can hold the first two and nothing else, so the form needed a
table of its own rather than a `source='contact'` lead row that drops the message.

`notified` records whether the owner alert was actually sent, so an enquiry that arrived
while the mail transport was down can be found by querying rather than by trusting that
someone read the logs that day.

Revision ID: 008
Revises: 007
"""
import sqlalchemy as sa
from alembic import op

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "contact_messages",
        # IdMixin generates the UUID in Python (default=uuid4), so there is no
        # server_default here — matching every other table in this schema.
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("enquiry_type", sa.String(64), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("notified", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    # The triage query is "what came in, newest first", and secondarily "has anything
    # gone un-notified" — both served by this one index.
    op.create_index("ix_contact_messages_created_at", "contact_messages", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_contact_messages_created_at", table_name="contact_messages")
    op.drop_table("contact_messages")

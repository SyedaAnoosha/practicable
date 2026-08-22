"""Operational settings key-value store (Phase 6C / W4-R13).

This table stores ONLY non-secret operational configuration. Secrets are never
stored here — they live in env vars exclusively, with no code path by which a
database row could ever supply a key. The docstring says so because a later
reader must not "helpfully" add one.
"""

from sqlalchemy import String, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, TimestampMixin


class Setting(Base, TimestampMixin):
    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(255), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    updated_by: Mapped[str | None] = mapped_column(String(255), nullable=True)

"""Recommendation-click event model.

Created by migration 024_recommendation_events, alongside the same privacy constraint
filter_events and download_events already carry: no user_id, no session id, no IP.

Recorded when a reader follows a routed recommendation, and nowhere else. Writes must
not fail the navigation — wrap and swallow, exactly as filter_events does.
"""
from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdMixin


class RecommendationEvent(Base, IdMixin):
    """Anonymous recommendation click — counts the question->product pair, not people."""

    __tablename__ = "recommendation_events"

    # "question" (RoutedProducts) or "catalogue" (SituationProducts).
    surface: Mapped[str] = mapped_column(String, nullable=False)
    # Null on the catalogue surface, which routes from a filter set rather than one question.
    question_slug: Mapped[str | None] = mapped_column(String, nullable=True)
    product_slug: Mapped[str] = mapped_column(String, nullable=False)

    # created_at only — no updated_at in the migration.
    created_at = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, IdMixin, TimestampMixin

class WebhookEvent(Base, IdMixin, TimestampMixin):
    __tablename__ = "webhook_events"
    
    # Stripe event ID for idempotency
    stripe_event_id: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    
    # Event type (e.g., "checkout.session.completed")
    event_type: Mapped[str] = mapped_column(String(255), nullable=False)
    
    # Whether processing succeeded
    processed: Mapped[bool] = mapped_column(default=False)
    error_message: Mapped[str | None] = mapped_column(String(1000), nullable=True)

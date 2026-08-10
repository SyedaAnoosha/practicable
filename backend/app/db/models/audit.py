from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, IdMixin, TimestampMixin
import uuid

class AuditLog(Base, IdMixin, TimestampMixin):
    __tablename__ = "audit_log"
    
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(255), nullable=False)  # "grant_entitlement", "publish_course", etc.
    target_type: Mapped[str] = mapped_column(String(100), nullable=False)  # "product", "course", "user"
    target_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    
    # Additional context as JSON string
    context: Mapped[str | None] = mapped_column(String(2000), nullable=True)

from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, IdMixin, TimestampMixin, str_enum
import enum
import uuid

class MediaStatus(str, enum.Enum):
    UPLOADING = "uploading"
    READY = "ready"
    ERROR = "error"

class Media(Base, IdMixin, TimestampMixin):
    __tablename__ = "media"
    
    lesson_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lessons.id"), nullable=False)
    
    # Mux video reference
    mux_asset_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    mux_playback_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    
    status: Mapped[MediaStatus] = mapped_column(str_enum(MediaStatus), default=MediaStatus.UPLOADING, nullable=False)
    duration_seconds: Mapped[int | None] = mapped_column(default=None)
    
    # Relationships
    lesson: Mapped["Lesson"] = relationship("Lesson", back_populates="media")

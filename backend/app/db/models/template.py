from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, IdMixin, TimestampMixin
import uuid

class Template(Base, IdMixin, TimestampMixin):
    __tablename__ = "templates"
    
    slug: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    
    section_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sections.id"), nullable=False)
    author_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("authors.id"), nullable=False)
    
    # Supabase Storage file reference (S3-compatible key within the bucket)
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(default=0)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    
    published: Mapped[bool] = mapped_column(default=False)
    
    # Relationships
    section: Mapped["Section"] = relationship("Section")
    author: Mapped["Author"] = relationship("Author")

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, IdMixin, TimestampMixin

class Author(Base, IdMixin, TimestampMixin):
    __tablename__ = "authors"
    
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    bio: Mapped[str | None] = mapped_column(String(2000), nullable=True)

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, IdMixin, TimestampMixin

class Section(Base, IdMixin, TimestampMixin):
    __tablename__ = "sections"
    
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)

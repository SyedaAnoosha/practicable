from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, IdMixin, TimestampMixin

class Lead(Base, IdMixin, TimestampMixin):
    __tablename__ = "leads"
    
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    
    # Which free entry point they came from (optional)
    source: Mapped[str | None] = mapped_column(String(255), nullable=True)

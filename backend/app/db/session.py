from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.config import settings


def _asyncpg_url(database_url: str) -> str:
    """Force the asyncpg driver regardless of which postgres:// scheme was supplied."""
    if database_url.startswith("postgresql+asyncpg://"):
        return database_url
    if database_url.startswith("postgresql://"):
        return database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if database_url.startswith("postgres://"):
        return database_url.replace("postgres://", "postgresql+asyncpg://", 1)
    raise ValueError(f"DATABASE_URL does not look like a Postgres connection string: {database_url!r}")


# Create async engine — from DATABASE_URL, the actual Postgres DSN, never supabase_url.
engine = create_async_engine(
    _asyncpg_url(settings.database_url),
    echo=False,
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

async def get_session() -> AsyncSession:
    """Dependency for getting async database sessions."""
    async with AsyncSessionLocal() as session:
        yield session

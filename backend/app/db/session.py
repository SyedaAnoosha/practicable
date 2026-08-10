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
# DATABASE_URL points at Supabase's connection pooler on port 6543 (pgbouncer,
# transaction-mode pooling — recommended for a stateless web service like Render's),
# which does not support named prepared statements: pgbouncer freely hands the same
# backend connection to different client sessions between transactions, and a
# statement name one session prepared can still be sitting on that connection when
# another session's asyncpg client tries to prepare the same deterministic name —
# DuplicatePreparedStatementError. Two separate caches have to be disabled, not one:
# asyncpg's own client-side cache (statement_cache_size, a real asyncpg.connect() kwarg)
# AND SQLAlchemy's asyncpg dialect's independent cache on top of it
# (prepared_statement_cache_size, a SQLAlchemy-level kwarg it intercepts before
# forwarding the rest to asyncpg.connect() — see sqlalchemy/dialects/postgresql/asyncpg.py).
# Missing either one still reproduces the error.
engine = create_async_engine(
    _asyncpg_url(settings.database_url),
    echo=False,
    connect_args={"statement_cache_size": 0, "prepared_statement_cache_size": 0},
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

import os
import glob
import re
import oracledb
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from contextlib import asynccontextmanager
from app.config import get_settings

settings = get_settings()

engine = create_async_engine(settings.DATABASE_URL, echo=False, pool_size=10, max_overflow=5)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


# ─────────────────────────────────────────
# ORACLE EBS — oracledb Thick Mode
# ─────────────────────────────────────────

_oracle_initialized = False


def _prepare_oracle_lib_dir(source_dir: str) -> str:
    """
    Oracle Instant Client 12.x ships libclntsh.so.12.1 but NOT libclntsh.so.
    When the bind-mount filesystem is read-only (Windows NTFS via Docker),
    create symlinks in /tmp/oracle_ic/ pointing to actual .so files.
    Returns the directory to pass to init_oracle_client().
    """
    if os.path.exists(os.path.join(source_dir, "libclntsh.so")):
        return source_dir

    tmp_dir = "/tmp/oracle_ic"
    os.makedirs(tmp_dir, exist_ok=True)

    for so_file in glob.glob(os.path.join(source_dir, "*.so*")):
        basename = os.path.basename(so_file)
        lnk = os.path.join(tmp_dir, basename)
        if not os.path.lexists(lnk):
            os.symlink(so_file, lnk)
        generic = re.sub(r"\.so\..*$", ".so", basename)
        if generic != basename:
            generic_lnk = os.path.join(tmp_dir, generic)
            if not os.path.lexists(generic_lnk):
                os.symlink(so_file, generic_lnk)

    return tmp_dir if os.path.exists(os.path.join(tmp_dir, "libclntsh.so")) else source_dir


def init_oracle_client():
    """Initialize Oracle Thick Mode once per process."""
    global _oracle_initialized
    if not _oracle_initialized:
        lib_dir = _prepare_oracle_lib_dir(settings.ORACLE_INSTANT_CLIENT)
        oracledb.init_oracle_client(lib_dir=lib_dir)
        _oracle_initialized = True


def get_oracle_connection():
    """
    Returns a synchronous Oracle connection (thick mode).
    Use inside Celery tasks only — not in async routes.
    """
    init_oracle_client()
    return oracledb.connect(
        user=settings.ORACLE_USER,
        password=settings.ORACLE_PASSWORD,
        dsn=settings.oracle_dsn,
    )


@asynccontextmanager
async def get_oracle_async():
    """Async context manager wrapping synchronous Oracle connection."""
    conn = None
    try:
        conn = get_oracle_connection()
        yield conn
    finally:
        if conn:
            conn.close()

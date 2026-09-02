#!/usr/bin/env python3
"""
Create e-magazine tables in PostgreSQL.
Run this script once to initialize the e-magazine database schema.
"""

import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.config import get_settings
from app.database import Base
from app.models import (
    EMagazineEdition,
    EMagazineContent,
    EMagazineHotspot,
    EMagazineAnalytics,
)


async def create_tables():
    settings = get_settings()

    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=True,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    await engine.dispose()
    print("✅ E-magazine tables created successfully!")


if __name__ == "__main__":
    asyncio.run(create_tables())

#!/usr/bin/env python3
"""
PDF Parser for E-Magazine
Converts PDF to structured content and populates database.
"""

import asyncio
import json
from pathlib import Path
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
import subprocess

from app.config import get_settings
from app.database import Base
from app.models import EMagazineEdition, EMagazineContent


# Section mapping from TOC
SECTIONS = {
    "OPENING": "Opening",
    "COMPANY": "Company's News",
    "BEHIND THE ID CARD": "Behind The ID Card",
    "BIRTHDAY": "Employee Birthday",
    "COLLABORATION": "Collaboration Star",
    "VOICE OF MEMBER": "Voice of Member",
    "CLOSING": "Closing",
}


def extract_text_from_pdf(pdf_path: str) -> dict:
    """Extract text from PDF using pdftotext"""
    try:
        result = subprocess.run(
            ["pdftotext", "-layout", pdf_path, "-"],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode == 0:
            return {"success": True, "text": result.stdout}
        else:
            return {"success": False, "error": result.stderr}
    except Exception as e:
        return {"success": False, "error": str(e)}


def split_text_by_pages(text: str) -> dict:
    """
    Naive page splitting by looking for page markers in pdftotext output.
    This is a heuristic - may need refinement based on actual PDF structure.
    """
    pages = {}

    # Split by form feed character (PDF page breaks)
    page_sections = text.split("\f")

    for idx, page_text in enumerate(page_sections, 1):
        pages[idx] = page_text.strip()

    return pages


def identify_section(text: str) -> str:
    """Identify which section a text belongs to"""
    text_upper = text.upper()

    for keyword, section_name in SECTIONS.items():
        if keyword in text_upper:
            return section_name

    return "General"


def clean_text(text: str) -> str:
    """Clean extracted text"""
    # Remove extra whitespace
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    return "\n".join(lines)


async def populate_database(
    edition_title: str,
    edition_number: int,
    published_date: str,
    pdf_path: str,
    pages_content: dict,
    session: AsyncSession,
):
    """Populate database with parsed content"""

    # Create edition
    edition = EMagazineEdition(
        title=edition_title,
        edition_number=edition_number,
        published_date=datetime.strptime(published_date, "%Y-%m-%d").date(),
        total_pages=len(pages_content),
        pdf_path=pdf_path,
        pdf_filename=Path(pdf_path).name,
    )

    session.add(edition)
    await session.flush()  # Get edition.id

    print(f"Created edition: {edition.title} (ID: {edition.id})")

    # Create content entries for each page
    for page_num, page_text in pages_content.items():
        if not page_text.strip():
            continue

        section = identify_section(page_text)
        cleaned_text = clean_text(page_text)

        # Extract first line as title
        lines = cleaned_text.split("\n")
        title = lines[0][:255] if lines else "Untitled"

        content = EMagazineContent(
            edition_id=edition.id,
            page_number=page_num,
            section_name=section,
            title=title,
            content_type="text",
            content_data={"raw_text": cleaned_text, "extracted_at": datetime.utcnow().isoformat()},
            searchable_text=cleaned_text,
        )

        session.add(content)

    await session.commit()
    print(f"✅ Populated {len(pages_content)} pages into database")


async def main():
    settings = get_settings()

    # Configuration
    pdf_path = "/home/user/eis-dashboard-v2/backend/emagazine_archive/CKD_OTTO_eMagz_3rd_Edition_ORIGINAL_v1.pdf"
    edition_title = "CKD OTTO E-Magazine 3rd Edition"
    edition_number = 3
    published_date = "2026-09-01"

    if not Path(pdf_path).exists():
        print(f"❌ PDF not found: {pdf_path}")
        return

    print(f"📖 Parsing PDF: {pdf_path}")

    # Extract text
    result = extract_text_from_pdf(pdf_path)
    if not result["success"]:
        print(f"❌ Failed to extract text: {result['error']}")
        return

    print("✅ Text extracted successfully")

    # Split by pages
    pages_content = split_text_by_pages(result["text"])
    print(f"📄 Total pages extracted: {len(pages_content)}")

    # Setup database
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with AsyncSessionLocal() as session:
        # Check if edition already exists
        stmt = select(EMagazineEdition).where(
            EMagazineEdition.edition_number == edition_number
        )
        existing = await session.execute(stmt)
        if existing.scalar_one_or_none():
            print(f"⚠️  Edition {edition_number} already exists in database")
            return

        # Populate database
        await populate_database(
            edition_title,
            edition_number,
            published_date,
            pdf_path,
            pages_content,
            session,
        )

    await engine.dispose()
    print("✅ Done!")


if __name__ == "__main__":
    asyncio.run(main())

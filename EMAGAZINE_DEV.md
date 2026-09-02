# E-Magazine Dynamic Viewer — Development Guide

## Overview
Transformasi PDF e-magazine statis CKD OTTO menjadi web-based aplikasi interaktif dengan:
- Page-flip navigation
- Full-text search
- Interactive hotspots (clickable areas)
- QR code & sharing
- Analytics tracking
- Database-driven content

## Project Structure

```
backend/
├── app/
│   ├── models/
│   │   └── emagazine.py          # SQLAlchemy models
│   ├── routers/
│   │   └── emagazine.py          # FastAPI endpoints
│   └── main.py                    # Router registration
├── create_emagazine_tables.py    # DB schema creation script
├── parse_emagazine_pdf.py        # PDF parser script
└── emagazine_archive/
    └── CKD_OTTO_eMagz_3rd_Edition_ORIGINAL_v1.pdf  # Backup
```

## Database Schema

### Tables Created
1. **emagazine_editions** — Magazine versions/editions
2. **emagazine_content** — Extracted page content (searchable)
3. **emagazine_hotspots** — Clickable areas with actions
4. **emagazine_analytics** — User interaction tracking

### Indexes
- Full-text search on `emagazine_content.searchable_text`
- Composite indexes for edition + page lookups
- User analytics tracking indexes

## Setup Instructions

### 1. Create Database Tables
```bash
cd backend
python create_emagazine_tables.py
```

Output:
```
CREATE TABLE emagazine_editions (...)
CREATE TABLE emagazine_content (...)
CREATE TABLE emagazine_hotspots (...)
CREATE TABLE emagazine_analytics (...)
✅ E-magazine tables created successfully!
```

### 2. Parse PDF & Populate Database
```bash
python parse_emagazine_pdf.py
```

This script:
- Extracts text from PDF using `pdftotext`
- Splits content by pages
- Identifies sections (Opening, Company News, etc)
- Populates `emagazine_editions` & `emagazine_content` tables

Output:
```
📖 Parsing PDF: /home/user/eis-dashboard-v2/backend/emagazine_archive/...
✅ Text extracted successfully
📄 Total pages extracted: 216
Created edition: CKD OTTO E-Magazine 3rd Edition (ID: 1)
✅ Populated 216 pages into database
```

## API Endpoints

All endpoints prefixed with `/api/emagazine`

### List Editions
```bash
GET /editions
```
Response:
```json
[
  {
    "id": 1,
    "title": "CKD OTTO E-Magazine 3rd Edition",
    "edition_number": 3,
    "published_date": "2026-09-01",
    "total_pages": 216
  }
]
```

### Get Single Page
```bash
GET /editions/{edition_id}/pages/{page_num}
```

### Search Content
```bash
POST /search
Content-Type: application/json

{
  "query": "birthday",
  "edition_id": 1
}
```

Response:
```json
[
  {
    "content_id": 45,
    "page_number": 12,
    "section_name": "Employee Birthday",
    "title": "Birthday Celebrations",
    "snippet": "...celebrate the birthday of our valued employees..."
  }
]
```

### Get Table of Contents
```bash
GET /editions/{edition_id}/toc
```

Response:
```json
{
  "Opening": [
    {"page": 1, "title": "CKD OTTO E-Magazine 3rd Edition", "id": 1}
  ],
  "Company's News": [
    {"page": 2, "title": "What's New?", "id": 2}
  ],
  ...
}
```

### Track Analytics
```bash
POST /analytics?edition_id=1&user_id=user123
Content-Type: application/json

{
  "action_type": "page_view",
  "page_number": 5,
  "metadata": {"device": "mobile", "session_id": "abc123"}
}
```

### Analytics Summary
```bash
GET /analytics/{edition_id}/summary
```

Response:
```json
{
  "edition_id": 1,
  "total_page_views": 456,
  "unique_users": 45,
  "popular_pages": [
    {"page": 10, "views": 125},
    {"page": 5, "views": 98}
  ]
}
```

## Development Phases

### ✅ Phase 1 (COMPLETED)
- [x] Database schema with PostgreSQL
- [x] SQLAlchemy models
- [x] Backend API endpoints
- [x] PDF parser script
- [x] Full-text search capability
- [x] Analytics tracking infrastructure

### 🔄 Phase 2 (IN PROGRESS)
- [ ] Frontend E-Magazine Viewer Component
  - [ ] Page-flip navigation
  - [ ] Search interface
  - [ ] Table of contents sidebar
  - [ ] Responsive design (mobile/tablet/desktop)
- [ ] Interactive hotspots/modals
- [ ] QR code generator
- [ ] Print/download functionality

### 📋 Phase 3 (PLANNED)
- [ ] Hotspot management (define clickable areas)
- [ ] Action configuration (links, videos, forms, modals)
- [ ] Integration with Keycloak auth
- [ ] Analytics dashboard for admins

### 📋 Phase 4 (PLANNED)
- [ ] Admin interface for:
  - [ ] Upload new editions
  - [ ] Create/edit hotspots
  - [ ] Configure actions
  - [ ] View analytics dashboard

## Frontend Integration

### E-Magazine Page Component
Location: `frontend/src/pages/EMagazinePage.jsx`

Features to implement:
1. **Viewer Container** — Displays magazine pages
2. **Navigation Bar** — Previous/Next/Go to page
3. **Search Input** — Full-text search
4. **Table of Contents** — Sidebar with sections
5. **Interactive Layer** — Hotspots for clickable areas
6. **Modals** — Details, videos, forms, etc
7. **Toolbar** — Search, zoom, download, print, share

### Component Architecture
```
EMagazinePage
├── EMagazineViewer
│   ├── PageDisplay (canvas/SVG)
│   ├── HotspotLayer (clickable areas)
│   └── ModalContainer (overlays)
├── NavigationBar
│   ├── PageCounter
│   ├── PreviousButton
│   ├── NextButton
│   └── PageInput
├── Sidebar (optional)
│   ├── SearchInput
│   └── TableOfContents
└── Toolbar
    ├── ZoomControls
    ├── SearchIcon
    ├── DownloadButton
    ├── PrintButton
    └── ShareButton
```

## Configuration

### Backend URL
Ensure `.env` has correct API endpoint:
```
VITE_API_BASE_URL=http://localhost:8001/api
```

### Storage
- PDF originals: `backend/emagazine_archive/`
- Extracted images: `backend/emagazine_uploads/` (to be created)

## Testing

### Quick Test
```bash
# Terminal 1: Backend
cd backend
python -m uvicorn app.main:app --reload --port 8001

# Terminal 2: Test API
curl http://localhost:8001/api/emagazine/editions
```

## Next Steps

1. **Create Frontend Page** (`frontend/src/pages/EMagazinePage.jsx`)
   - Build E-Magazine Viewer component
   - Integrate with backend API
   - Implement page navigation

2. **Test PDF Parsing**
   - Run `parse_emagazine_pdf.py`
   - Verify database population
   - Test search functionality

3. **Add Hotspots** (Phase 3)
   - Create admin interface to define clickable areas
   - Implement modal actions

4. **Deploy & Test** (Phase 4)
   - Full integration testing
   - Analytics verification
   - Performance optimization

## Troubleshooting

### PDF Parser Not Found
```bash
apt-get install -y poppler-utils
```

### Database Connection Error
Ensure PostgreSQL is running and `.env` has correct credentials.

### Missing Dependencies
```bash
pip install -r requirements.txt
```

## Architecture Decisions

1. **Database-Driven Content** — All content in PostgreSQL for:
   - Easy search
   - Version control
   - Analytics
   - Dynamic updates (no need to re-parse PDF)

2. **Modular Hotspots** — Clickable areas stored separately:
   - Easy to add/update without re-parsing
   - Flexible action types
   - Position-based (x, y, width, height)

3. **Full-Text Search** — PostgreSQL native:
   - Fast searching
   - Relevance ranking
   - No external service dependency

4. **Analytics First** — Track all interactions:
   - Popular pages
   - User engagement
   - Search trends
   - Future feature recommendations

## References

- [SQLAlchemy Async](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html)
- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [PostgreSQL Full-Text Search](https://www.postgresql.org/docs/current/textsearch.html)
- [PDF.js](https://mozilla.github.io/pdf.js/) (for frontend rendering)

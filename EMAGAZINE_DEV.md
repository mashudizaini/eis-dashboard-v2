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

### ✅ Phase 2 (COMPLETED)
- [x] Frontend E-Magazine Viewer Component
  - [x] Page-by-page navigation (Previous/Next/Go-to-page)
  - [x] Search interface with results and snippets
  - [x] Table of contents sidebar (collapsible sections)
  - [x] Responsive design (mobile/tablet/desktop)
- [x] Page viewer component with content display
- [x] State management with Zustand
- [x] API integration (fetch editions, pages, search)
- [x] Analytics tracking (page views)
- [x] Navigation bar with toolbar buttons
- [x] Sidebar navigation link
- [x] Route setup (/emagazine)

### 🔄 Phase 3 (NEXT)
- [ ] Hotspot management (define clickable areas)
  - [ ] Create hotspots database entries
  - [ ] Define clickable rectangles (x, y, width, height)
  - [ ] Configure action types (link, modal, video, form)
- [ ] Interactive modals
  - [ ] Profile/detail modal for clickable areas
  - [ ] Video embedding
  - [ ] Form/survey modals
  - [ ] Link handling
- [ ] QR code generation
  - [ ] Generate QR for share/contact
  - [ ] Display in modals
- [ ] Keycloak auth integration for analytics user tracking

### 📋 Phase 4 (PLANNED)
- [ ] Admin interface for:
  - [ ] Upload new editions
  - [ ] Create/edit hotspots
  - [ ] Configure actions
  - [ ] View analytics dashboard

## Frontend Structure (Phase 2)

### Directory Layout
```
frontend/src/
├── pages/
│   └── EMagazinePage.jsx          # Main e-magazine page (full-screen)
├── components/
│   └── emagazine/
│       ├── NavigationBar.jsx      # Top nav with pagination & tools
│       ├── PageViewer.jsx         # Content display component
│       ├── SearchBar.jsx          # Search interface
│       └── TableOfContents.jsx    # Sidebar with TOC
├── stores/
│   └── emagazineStore.js          # Zustand state management
└── utils/
    └── emagazineApi.js            # API client
```

### State Management (Zustand)
```javascript
useEMagazineStore()
├── State:
│   ├── editions[]
│   ├── currentEditionId
│   ├── currentPage
│   ├── totalPages
│   ├── searchQuery
│   ├── searchResults[]
│   ├── tableOfContents{}
│   ├── showSidebar (boolean)
│   └── showSearch (boolean)
└── Actions:
    ├── setCurrentEdition(id, totalPages)
    ├── setCurrentPage(page)
    ├── nextPage() / prevPage()
    ├── setSearchQuery(query)
    ├── setSearchResults(results)
    ├── toggleSidebar() / toggleSearch()
    └── reset()
```

## Frontend Integration (Phase 2 Complete)

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

### Phase 2 Integration Test

**Prerequisites:**
1. Database tables created (Phase 1): `python backend/create_emagazine_tables.py`
2. PDF parsed & populated (Phase 1): `python backend/parse_emagazine_pdf.py`

**Step-by-Step Testing:**

```bash
# Terminal 1: Backend
cd backend
python -m uvicorn app.main:app --reload --port 8001

# Terminal 2: Frontend (new terminal)
cd frontend
npm run dev              # Starts on http://localhost:3001

# Terminal 3: Test API (in browser or curl)
curl http://localhost:8001/api/emagazine/editions
```

**Manual Testing in Browser:**

1. **Navigate to E-Magazine**
   - Open http://localhost:3001/emagazine
   - Should load first edition automatically
   - Check browser console for any errors

2. **Test Navigation**
   - Click Previous/Next buttons
   - Input page number and press Enter
   - Verify page content changes

3. **Test Search**
   - Click Search icon (top right)
   - Type a search term (e.g., "birthday", "company", "welcome")
   - Verify results appear with snippets
   - Click result to navigate to page

4. **Test Table of Contents**
   - Sidebar should show sections (Opening, Company's News, etc)
   - Click sections to expand/collapse
   - Click page in TOC to navigate
   - Current page should highlight

5. **Test Analytics**
   - Open DevTools → Network tab
   - Navigate pages and search
   - Should see POST /api/emagazine/analytics requests
   - Verify action_type is recorded (page_view, click)

6. **Responsive Design**
   - Resize browser window (mobile view)
   - Sidebar should hide on small screens (use menu button)
   - Content should remain readable

### API Endpoint Tests

```bash
# Test editions list
curl http://localhost:8001/api/emagazine/editions

# Test get single page
curl http://localhost:8001/api/emagazine/editions/1/pages/5

# Test search
curl -X POST http://localhost:8001/api/emagazine/search \
  -H "Content-Type: application/json" \
  -d '{"query":"birthday","edition_id":1}'

# Test TOC
curl http://localhost:8001/api/emagazine/editions/1/toc

# Test analytics
curl -X POST "http://localhost:8001/api/emagazine/analytics?edition_id=1" \
  -H "Content-Type: application/json" \
  -d '{"action_type":"page_view","page_number":5,"metadata":{}}'
```

## Next Steps

### Immediate (Phase 2 Verification)
1. **Test Full Stack**
   ```bash
   # Terminal 1: Backend
   cd backend
   python create_emagazine_tables.py
   python parse_emagazine_pdf.py
   python -m uvicorn app.main:app --reload --port 8001

   # Terminal 2: Frontend
   cd frontend
   npm run dev

   # Browser: http://localhost:3001/emagazine
   ```

2. **Verify Integration**
   - Check page loads without errors
   - Verify API calls in Network tab
   - Test all navigation features
   - Confirm search works

### Phase 3: Interactive Elements
1. **Hotspot Management**
   - Create admin UI to define clickable areas on pages
   - Store hotspots in database (emagazine_hotspots table)
   - Position on page using SVG overlay

2. **Modal System**
   - Build ModalContainer component
   - Support different action types:
     * Link (external URL)
     * Contact (email/phone)
     * Form (embedded)
     * Video (embed iframe)
     * Profile (modal with details)

3. **QR Code Integration**
   - Add qrcode library: `npm install qrcode.react`
   - Generate QR for page links
   - Display in share modal

### Phase 4: Admin & Analytics
1. **Hotspot Admin Interface**
   - Create/edit/delete hotspots
   - Position tool (click on page to create)
   - Configure actions

2. **Analytics Dashboard**
   - Popular pages chart
   - Search trends
   - User engagement metrics

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

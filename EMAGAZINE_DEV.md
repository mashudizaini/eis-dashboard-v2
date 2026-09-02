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

### Hotspot Endpoints (Phase 3)

#### Get Hotspots for Page
```bash
GET /api/emagazine/hotspots/editions/{edition_id}/pages/{page_num}
```

Response:
```json
[
  {
    "id": 1,
    "edition_id": 1,
    "page_number": 5,
    "x_pos": 100,
    "y_pos": 150,
    "width": 200,
    "height": 80,
    "action_type": "contact",
    "action_data": {
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+62-123-4567"
    },
    "tooltip": "Click for contact",
    "created_at": "2024-09-02T10:30:00"
  }
]
```

#### Create Hotspot
```bash
POST /api/emagazine/hotspots
Content-Type: application/json

{
  "edition_id": 1,
  "page_number": 5,
  "x_pos": 100,
  "y_pos": 150,
  "width": 200,
  "height": 80,
  "action_type": "contact",
  "action_data": {...},
  "tooltip": "Click for contact"
}
```

#### Update Hotspot
```bash
PUT /api/emagazine/hotspots/{id}
Content-Type: application/json

{
  "action_data": {...},
  "tooltip": "Updated tooltip"
}
```

#### Delete Hotspot
```bash
DELETE /api/emagazine/hotspots/{id}
```

#### Batch Create Hotspots
```bash
POST /api/emagazine/hotspots/batch/editions/{edition_id}
Content-Type: application/json

[
  {...hotspot1...},
  {...hotspot2...}
]
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

### ✅ Phase 3 (COMPLETED)
- [x] Backend hotspot management API (CRUD operations)
  - [x] GET /api/emagazine/hotspots/editions/{id} (list)
  - [x] GET /api/emagazine/hotspots/editions/{id}/pages/{num} (get for page)
  - [x] POST /api/emagazine/hotspots (create)
  - [x] PUT /api/emagazine/hotspots/{id} (update)
  - [x] DELETE /api/emagazine/hotspots/{id} (delete)
  - [x] Batch create endpoint
- [x] Interactive modals (5 types)
  - [x] ContactModal - Profile/contact with QR code
  - [x] LinkModal - External links with copy button
  - [x] VideoModal - YouTube/Vimeo embed
  - [x] Modal placeholder for forms and QR codes
  - [x] Base Modal component (reusable)
- [x] Hotspot SVG overlay layer
  - [x] Clickable areas with hover effects
  - [x] Tooltips on hover
  - [x] Action type indicators (colored circles)
  - [x] Responsive positioning
- [x] QR code generation (contact modal)
  - [x] Generate mailto QR codes
  - [x] Display in contact modals
- [x] Analytics tracking for hotspot clicks
- [x] API methods for hotspot management
- [x] Frontend-backend integration

### ✅ Phase 4 (COMPLETED)
- [x] Admin interface for:
  - [x] Upload new editions (EditionUploader component)
  - [x] Create/edit hotspots (HotspotManager CRUD)
  - [x] Configure actions (Dynamic action_data forms)
  - [x] View analytics dashboard (AnalyticsDashboard with KPIs)
- [x] Main admin page with tabbed interface (EMagazineAdminPage)
- [x] Reusable Tabs UI component
- [x] Dynamic form fields for multiple action types
- [x] Hotspots grouped by page
- [x] Analytics KPI cards and visualization

## Frontend Structure (Phase 2-4)

### Directory Layout
```
frontend/src/
├── pages/
│   ├── EMagazinePage.jsx                    # Main e-magazine page (full-screen)
│   └── admin/
│       └── EMagazineAdminPage.jsx           # Admin dashboard with tabs
├── components/
│   ├── emagazine/
│   │   ├── NavigationBar.jsx                # Top nav with pagination & tools
│   │   ├── PageViewer.jsx                   # Content display + hotspots + modals
│   │   ├── SearchBar.jsx                    # Search interface
│   │   ├── TableOfContents.jsx              # Sidebar with TOC
│   │   ├── HotspotLayer.jsx                 # SVG overlay for interactive areas
│   │   ├── Modal.jsx                        # Base modal component
│   │   ├── ContactModal.jsx                 # Profile/contact info modal
│   │   ├── LinkModal.jsx                    # External link modal
│   │   └── VideoModal.jsx                   # Video embedding modal
│   ├── admin/
│   │   ├── HotspotManager.jsx               # CRUD interface for hotspots
│   │   ├── AnalyticsDashboard.jsx           # Analytics KPI & charts
│   │   └── EditionUploader.jsx              # PDF upload form
│   └── ui/
│       └── Tabs.jsx                         # Reusable tabs component
├── stores/
│   └── emagazineStore.js                    # Zustand state management
└── utils/
    └── emagazineApi.js                      # API client + hotspot methods
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

## Admin Interface (Phase 4)

### Admin Dashboard Structure
Location: `frontend/src/pages/admin/EMagazineAdminPage.jsx`

**Features:**
- Edition selector dropdown to switch between versions
- Tabbed navigation (Hotspots, Analytics, Editions)
- Responsive layout with max-width container

### Admin Components

#### 1. HotspotManager
Location: `frontend/src/components/admin/HotspotManager.jsx`

**Functionality:**
- Lists all hotspots grouped by page number
- Expandable/collapsible page sections
- CRUD operations (Create, Read, Update, Delete)
- Dynamic forms based on action_type

**Action Types Supported:**
- **Contact**: name, email, phone, bio fields
- **Link**: URL and description
- **Video**: provider (YouTube/Vimeo), videoId, description
- **Form**: (placeholder for form integration)
- **QR Code**: (placeholder for QR generation)

**UI Elements:**
- New Hotspot button
- Edit/Delete buttons for each hotspot
- Page-based grouping with counts
- Expandable form sections

#### 2. AnalyticsDashboard
Location: `frontend/src/components/admin/AnalyticsDashboard.jsx`

**Metrics Displayed:**
- **KPI Cards**: Total Page Views, Unique Users, Average Views per User
- **Popular Pages Chart**: Bar chart visualization (Recharts)
- **Engagement Metrics**:
  - Pages with views
  - Average page views
  - Most popular page
  - Peak views
- **Insights**: Recommendation for adding hotspots to popular pages

**Data Source:**
- Fetches from `/api/emagazine/analytics/{edition_id}/summary`

#### 3. EditionUploader
Location: `frontend/src/components/admin/EditionUploader.jsx`

**Form Fields:**
- Edition Title (text input)
- Edition Number (number input, min 1)
- Published Date (date picker)
- PDF File (drag-and-drop or click to select)

**Features:**
- File type validation (PDF only)
- Form validation (all fields required)
- Drag-and-drop file upload UI
- Status messages (error/success/info)
- Loading state with spinner
- Instruction section with process steps

**Process Description:**
1. Upload triggers backend PDF parsing
2. Content extracted and indexed (searchable)
3. Edition added to database with metadata
4. Hotspots can be created per page
5. Analytics tracking begins automatically

### Tabs Component
Location: `frontend/src/components/ui/Tabs.jsx`

**Features:**
- Reusable tabbed navigation component
- Props: value (active tab), onValueChange (callback)
- Sub-components:
  - TabsList: Container for tab buttons
  - TabsTrigger: Individual tab button
  - TabsContent: Content container for tab
- Styling: Blue underline for active state, hover effects

## Frontend Integration (Phase 2-3 Complete)

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

### Immediate (Phase 3 Testing)
1. **Install Dependencies**
   ```bash
   cd frontend
   npm install  # Install qrcode.react
   ```

2. **Test with Sample Data**
   ```bash
   # Terminal 1: Backend
   cd backend
   python -m uvicorn app.main:app --reload --port 8001

   # Terminal 2: Frontend
   cd frontend
   npm run dev

   # Terminal 3: Create sample hotspots
   curl -X POST http://localhost:8001/api/emagazine/hotspots \
     -H "Content-Type: application/json" \
     -d '{
       "edition_id": 1,
       "page_number": 5,
       "x_pos": 100,
       "y_pos": 150,
       "width": 200,
       "height": 80,
       "action_type": "contact",
       "action_data": {
         "name": "John Doe",
         "title": "Manager",
         "email": "john@example.com",
         "phone": "+62-123-4567",
         "bio": "Team lead"
       },
       "tooltip": "Click for contact"
     }'
   ```

3. **Manual Testing**
   - Navigate to http://localhost:3001/emagazine
   - Hover over hotspots (should see tooltip)
   - Click hotspot → modal opens
   - Test contact modal with QR code
   - Test video embed modal
   - Verify analytics tracking in Network tab

### Phase 4: Admin Interface & Deployment (COMPLETED)
**Completed Features:**
1. **Hotspot Admin Tool** ✅
   - Page: `/admin/emagazine` with tabbed interface
   - List all hotspots for edition, grouped by page
   - Edit/delete existing hotspots
   - Dynamic forms for action type configuration
   - Support for contact, link, video, form, and QR code actions

2. **Edition Management** ✅ (Partial - Backend to follow)
   - EditionUploader component with form validation
   - Fields for title, edition number, published date
   - PDF file input with drag-and-drop UI
   - Status messaging (error/success/info)

3. **Analytics Dashboard** ✅
   - KPI cards: Total Page Views, Unique Users, Avg Views per User
   - Bar chart of popular pages using Recharts
   - Engagement metrics grid
   - Insights section with recommendations

4. **Admin UI Components** ✅
   - Main admin page with tabbed navigation (Hotspots, Analytics, Editions)
   - HotspotManager with full CRUD functionality
   - AnalyticsDashboard with visualization
   - EditionUploader form
   - Reusable Tabs component

### 📋 Phase 4.2: Backend PDF Upload & Visual Editor (PLANNED)
1. **Backend PDF Upload Endpoint**
   - POST /api/emagazine/editions/upload
   - Accept multipart/form-data with PDF file
   - Auto-parse using pdftotext
   - Create new edition entry
   - Populate content in database

2. **Visual Hotspot Editor**
   - Click on page to create hotspots
   - Drag to position and resize
   - Visual feedback for existing hotspots
   - Quick action type assignment

3. **Performance & Deployment**
   - Optimize hotspot rendering
   - Cache page content
   - Image optimization
   - Production deployment checklist

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

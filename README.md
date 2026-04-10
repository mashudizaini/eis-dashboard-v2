# EIS Dashboard — PT CKD OTTO Pharmaceuticals

Executive Information System dashboard — web-based replacement for the Excel-based EIS.

Built with FastAPI + React + PostgreSQL + Redis + Celery, containerized with Docker Compose.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              Docker Compose (standalone)             │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │  React   │  │ FastAPI  │  │  Nginx (proxy)   │  │
│  │  :3001   │  │  :8001   │  │     :8080        │  │
│  └────┬─────┘  └────┬─────┘  └──────────────────┘  │
│       │              │                               │
│  ┌────┴─────┐  ┌─────┴────┐  ┌──────────────────┐  │
│  │ Postgres │  │  Redis   │  │  Celery worker   │  │
│  │  :5433   │  │  :6380   │  │  + beat          │  │
│  └──────────┘  └──────────┘  └────────┬─────────┘  │
└───────────────────────────────────────┼─────────────┘
                                        │
                          ┌─────────────┴──────────┐
                          │  Oracle EBS 12.2.8     │
                          │  172.21.2.201:1521     │
                          └────────────────────────┘
```

## Quick Start

```bash
# 1. Clone
git clone <repo> eis-dashboard
cd eis-dashboard

# 2. Configure
cp .env.example .env
# Edit .env — fill in ORACLE_PASSWORD, KEYCLOAK_CLIENT_SECRET, etc.

# 3. Run
docker-compose up -d

# 4. Check
docker-compose ps
docker-compose logs -f backend
```

## Service URLs

| Service            | URL                          |
|--------------------|------------------------------|
| Dashboard          | http://localhost:8080         |
| Frontend (dev)     | http://localhost:3001         |
| Backend API        | http://localhost:8001         |
| API Docs (Swagger) | http://localhost:8001/docs    |
| PostgreSQL         | localhost:5433                |
| Redis              | localhost:6380                |

## Dashboard Modules

| Module              | Path              | Description                          |
|---------------------|-------------------|--------------------------------------|
| Summary             | `/`               | KPI cards, NWC, closing estimation   |
| Performance         | `/performance`    | Sales achievement, EBIT, area sales  |
| Production          | `/production`     | Yield, DIO, COGS, overtime           |
| Business Expansion  | `/expansion`      | Pipeline Gantt chart (13 products)   |
| Administration      | `/administration` | HR, financial, ratios, budget        |
| Business Plan Entry | `/business-plan`  | Manual BP data entry form            |
| ETL Management      | `/etl`            | Job schedule, trigger, history       |

## ETL Schedule (Celery Beat)

| Job             | Frequency | Time         | Source            |
|-----------------|-----------|--------------|-------------------|
| etl_sales       | Daily     | 02:00 AM WIB | Oracle GL         |
| etl_ar_ap       | Daily     | 02:30 AM WIB | Oracle AR/AP      |
| etl_inventory   | Daily     | 03:00 AM WIB | Oracle INV        |
| etl_production  | Daily     | 03:15 AM WIB | Oracle WIP        |
| etl_employee    | Weekly    | Mon 02:00 AM | Oracle HR         |
| etl_financial   | Daily     | 04:00 AM WIB | Oracle GL         |

## Ports (offset from CKDO Dashboard v2)

| Service    | CKDO v2 | EIS Dashboard |
|------------|---------|---------------|
| Frontend   | 3000    | 3001          |
| Backend    | 8000    | 8001          |
| PostgreSQL | 5432    | 5433          |
| Redis      | 6379    | 6380          |

## Tech Stack

**Backend:** Python 3.11, FastAPI, SQLAlchemy 2.0, Celery, oracledb
**Frontend:** React 18, Vite, Tailwind CSS, Recharts, Zustand, Keycloak JS
**Database:** PostgreSQL 15, Redis 7
**Auth:** Keycloak SSO (shared with CKDO Dashboard v2)

## Keycloak Setup

Register a new client `eis-dashboard` in the existing `ckdo` realm:
1. Go to Keycloak Admin → Clients → Create
2. Client ID: `eis-dashboard`
3. Client Protocol: `openid-connect`
4. Access Type: `public`
5. Valid Redirect URIs: `http://localhost:3001/*`, `http://localhost:8080/*`
6. Web Origins: `+`

## Project Structure

```
eis-dashboard/
├── docker-compose.yml
├── .env.example
├── .gitignore
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py              # FastAPI entry point
│       ├── config.py            # Pydantic settings
│       ├── database.py          # PostgreSQL + Oracle connections
│       ├── dependencies.py      # Keycloak JWT auth
│       ├── routers/
│       │   ├── summary.py       # Summary endpoints
│       │   ├── performance.py   # Performance endpoints
│       │   ├── production.py    # Production endpoints
│       │   ├── expansion.py     # Business expansion endpoints
│       │   ├── administration.py # Admin endpoints
│       │   ├── business_plan.py # BP entry CRUD
│       │   └── etl_admin.py     # ETL management
│       └── tasks/
│           ├── __init__.py      # Celery app + beat schedule
│           └── etl_tasks.py     # Oracle ETL extraction tasks
├── frontend/
│   ├── Dockerfile.dev
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx              # Router + auth gate
│       ├── stores/
│       │   ├── authStore.js     # Keycloak SSO store
│       │   └── dashboardStore.js # Year/period filters
│       ├── utils/
│       │   └── api.js           # Axios client + all endpoints
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Sidebar.jsx
│       │   │   └── TopBar.jsx
│       │   └── common/
│       │       ├── KpiCard.jsx
│       │       └── Loading.jsx
│       ├── pages/
│       │   ├── SummaryPage.jsx
│       │   ├── PerformancePage.jsx
│       │   ├── ProductionPage.jsx
│       │   ├── ExpansionPage.jsx
│       │   ├── AdministrationPage.jsx
│       │   ├── BusinessPlanPage.jsx
│       │   └── EtlPage.jsx
│       └── styles/
│           └── globals.css
├── nginx/
│   └── nginx.conf
└── postgres/
    └── init.sql                 # Full schema + seed data
```

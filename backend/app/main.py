from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.config import get_settings
from app.routers import summary, performance, production, expansion, administration, business_plan, etl_admin

settings = get_settings()

API_PREFIX = "/api/v1/eis"


@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"[EIS Dashboard] Starting — {settings.ENVIRONMENT} mode")
    yield
    print("[EIS Dashboard] Shutting down")


app = FastAPI(
    title="EIS Dashboard API",
    description="Executive Information System — PT CKD OTTO Pharmaceuticals",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Router Registration ──────────────────────────────────────

app.include_router(summary.router, prefix=f"{API_PREFIX}/summary", tags=["Summary"])
app.include_router(performance.router, prefix=f"{API_PREFIX}/performance", tags=["Performance"])
app.include_router(production.router, prefix=f"{API_PREFIX}/production", tags=["Production"])
app.include_router(expansion.router, prefix=f"{API_PREFIX}/expansion", tags=["Business Expansion"])
app.include_router(administration.router, prefix=f"{API_PREFIX}/admin", tags=["Administration"])
app.include_router(business_plan.router, prefix=f"{API_PREFIX}/bp", tags=["Business Plan"])
app.include_router(etl_admin.router, prefix=f"{API_PREFIX}/etl", tags=["ETL Admin"])


@app.get("/health")
async def health_check():
    return {"status": "ok", "app": settings.APP_NAME, "env": settings.ENVIRONMENT}

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Optional
from pydantic import BaseModel
from app.database import get_db
from app.dependencies import require_role

router = APIRouter()


class TriggerParams(BaseModel):
    year: Optional[int] = None   # None = tahun berjalan
    month: Optional[int] = None  # None = semua bulan tahun tersebut


@router.get("/status")
async def etl_status(
    limit: int = Query(20),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role("admin", "it_staff")),
):
    q = text("""
        SELECT id, job_name, status, started_at, finished_at,
               records_processed, error_message, run_params,
               EXTRACT(EPOCH FROM (COALESCE(finished_at, NOW()) - started_at))::int as duration_secs
        FROM eis.etl_job_log
        ORDER BY started_at DESC
        LIMIT :limit
    """)
    result = await db.execute(q, {"limit": limit})
    return {"data": [dict(r) for r in result.mappings().all()]}


@router.post("/trigger/{job_name}")
async def trigger_etl(
    job_name: str,
    params: TriggerParams,
    user: dict = Depends(require_role("admin", "it_staff")),
):
    from app.tasks.celery_app import celery_app
    valid_jobs = [
        "etl_sales", "etl_production", "etl_financial",
        "etl_employee", "etl_inventory", "etl_ar_ap", "etl_budget",
    ]
    if job_name not in valid_jobs:
        return {"error": f"Unknown job. Valid: {valid_jobs}"}

    result = celery_app.send_task(
        f"app.tasks.etl_tasks.{job_name}",
        kwargs={"year": params.year, "month": params.month},
    )
    return {"message": f"Job {job_name} triggered", "task_id": result.id}


@router.get("/schedule")
async def etl_schedule(
    user: dict = Depends(require_role("admin", "it_staff")),
):
    return {"data": [
        {"job": "etl_sales", "frequency": "Daily", "schedule": "02:00 AM WIB", "source": "Oracle GL_BALANCES"},
        {"job": "etl_ar_ap", "frequency": "Daily", "schedule": "02:30 AM WIB", "source": "Oracle AR/AP"},
        {"job": "etl_inventory", "frequency": "Daily", "schedule": "03:00 AM WIB", "source": "Oracle INV"},
        {"job": "etl_production", "frequency": "Daily", "schedule": "03:15 AM WIB", "source": "Oracle WIP"},
        {"job": "etl_employee", "frequency": "Weekly", "schedule": "Mon 02:00 AM", "source": "Oracle HR"},
        {"job": "etl_financial", "frequency": "Daily", "schedule": "04:00 AM WIB", "source": "Oracle GL"},
        {"job": "etl_budget", "frequency": "Daily", "schedule": "04:30 AM WIB", "source": "Oracle GL (OPEX)"},
    ]}

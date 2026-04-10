from celery import Celery
from celery.schedules import crontab
from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "eis_tasks",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_BROKER_URL.replace("/1", "/2"),
    include=["app.tasks.etl_tasks"],
)

celery_app.conf.update(
    timezone="Asia/Jakarta",
    enable_utc=False,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
    worker_max_tasks_per_child=50,
)

celery_app.conf.beat_schedule = {
    "etl-sales-daily": {
        "task": "app.tasks.etl_tasks.etl_sales",
        "schedule": crontab(hour=2, minute=0),
    },
    "etl-ar-ap-daily": {
        "task": "app.tasks.etl_tasks.etl_ar_ap",
        "schedule": crontab(hour=2, minute=30),
    },
    "etl-inventory-daily": {
        "task": "app.tasks.etl_tasks.etl_inventory",
        "schedule": crontab(hour=3, minute=0),
    },
    "etl-production-daily": {
        "task": "app.tasks.etl_tasks.etl_production",
        "schedule": crontab(hour=3, minute=15),
    },
    "etl-employee-weekly": {
        "task": "app.tasks.etl_tasks.etl_employee",
        "schedule": crontab(hour=2, minute=0, day_of_week="monday"),
    },
    "etl-financial-daily": {
        "task": "app.tasks.etl_tasks.etl_financial",
        "schedule": crontab(hour=4, minute=0),
    },
}

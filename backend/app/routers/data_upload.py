import io
import logging
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from app.dependencies import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)

MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
]


def _parse_overtime_excel(content: bytes) -> list[dict]:
    try:
        import openpyxl
    except ImportError:
        raise HTTPException(status_code=500, detail="openpyxl not installed")

    wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(min_row=1, max_row=10, values_only=True))

    overtime_row = None
    working_row = None
    for row in rows:
        if row is None:
            continue
        type_val = str(row[1]).strip().lower() if row[1] is not None else ''
        if 'overtime hour' in type_val:
            overtime_row = row
        elif 'working hour' in type_val:
            working_row = row

    if overtime_row is None or working_row is None:
        raise HTTPException(
            status_code=422,
            detail="Format tidak valid: baris 'Overtime Hour' atau 'Working Hour' tidak ditemukan. "
                   "Pastikan kolom B berisi label tersebut.",
        )

    result = []
    for i, month_name in enumerate(MONTH_NAMES):
        ot = float(overtime_row[i + 2] or 0) if (i + 2) < len(overtime_row) else 0.0
        wk = float(working_row[i + 2] or 0) if (i + 2) < len(working_row) else 0.0
        total = ot + wk
        ratio = round(ot / total * 100, 2) if total > 0 else 0.0
        result.append({
            'period_num': i + 1,
            'period_name': month_name,
            'overtime_hours': round(ot, 2),
            'working_hours': round(wk, 2),
            'ratio_pct': ratio,
        })
    return result


@router.get("/overtime")
async def get_overtime_data(
    year: int = Query(2025),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Return uploaded overtime data for the given year."""
    q = text("""
        SELECT per.period_num, per.period_name,
               o.overtime_hours, o.working_hours,
               CASE WHEN (o.working_hours + o.overtime_hours) > 0
                    THEN ROUND((o.overtime_hours / (o.working_hours + o.overtime_hours) * 100)::numeric, 2)
                    ELSE 0 END AS ratio_pct
        FROM eis.fact_overtime o
        JOIN eis.dim_period per ON o.period_id = per.id
        WHERE per.fiscal_year = :year
        ORDER BY per.period_num
    """)
    result = await db.execute(q, {"year": year})
    return {"data": [dict(r) for r in result.mappings().all()]}


@router.post("/overtime/upload")
async def upload_overtime(
    year: int = Query(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Parse overtime Excel and upsert into fact_overtime."""
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=422, detail="File harus .xlsx atau .xls")

    content = await file.read()
    months = _parse_overtime_excel(content)

    loaded = 0
    for m in months:
        # Find period_id
        res = await db.execute(
            text("SELECT id FROM eis.dim_period WHERE fiscal_year=:y AND period_num=:p"),
            {"y": year, "p": m["period_num"]},
        )
        row = res.fetchone()
        if not row:
            continue
        period_id = row[0]

        await db.execute(text("""
            INSERT INTO eis.fact_overtime (period_id, overtime_hours, working_hours)
            VALUES (:pid, :ot, :wk)
            ON CONFLICT (period_id) DO UPDATE SET
                overtime_hours = EXCLUDED.overtime_hours,
                working_hours  = EXCLUDED.working_hours
        """), {"pid": period_id, "ot": m["overtime_hours"], "wk": m["working_hours"]})
        loaded += 1

    await db.commit()
    return {
        "message": f"Berhasil upload {loaded} bulan overtime untuk tahun {year}",
        "year": year,
        "loaded": loaded,
        "data": months,
    }


# ══════════════════════════════════════════════════════════════
# COGS Upload
# ══════════════════════════════════════════════════════════════

def _parse_cogs_excel(content: bytes) -> list[dict]:
    try:
        import openpyxl
    except ImportError:
        raise HTTPException(status_code=500, detail="openpyxl not installed")

    wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(min_row=1, max_row=ws.max_row, values_only=True))

    # Find header row (contains 'PRODUCT' or 'product')
    header_idx = None
    for i, row in enumerate(rows):
        if any(str(v).strip().upper() in ('PRODUCT', 'PRODUK') for v in row if v is not None):
            header_idx = i
            break

    if header_idx is None:
        raise HTTPException(
            status_code=422,
            detail="Format tidak valid: header kolom 'PRODUCT' tidak ditemukan di kolom manapun.",
        )

    result = []
    for row in rows[header_idx + 1:]:
        if not any(v is not None for v in row):
            continue
        # Find product name (first non-None string after index 0)
        prod_name = None
        cogs_val = None
        for cell in row[1:]:
            if cell is None:
                continue
            if prod_name is None and isinstance(cell, str) and cell.strip():
                prod_name = cell.strip()
            elif isinstance(cell, (int, float)) and cell >= 0:
                cogs_val = float(cell)

        if prod_name and cogs_val is not None:
            result.append({"product_name": prod_name, "cogs_total": round(cogs_val, 2)})

    if not result:
        raise HTTPException(status_code=422, detail="Tidak ada data produk yang bisa dibaca dari file.")

    return result


@router.get("/cogs")
async def get_cogs_data(
    year: int = Query(2025),
    period: int = Query(12),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Return COGS ratio data for the given year/period (from fact_cogs)."""
    q = text("""
        SELECT p.product_name,
               ROUND(SUM(c.sales_amount)::numeric, 2)  AS net_sales,
               ROUND(SUM(c.cogs_total)::numeric, 2)    AS cogs,
               CASE WHEN SUM(c.sales_amount) > 0
                    THEN ROUND((SUM(c.cogs_total) / SUM(c.sales_amount) * 100)::numeric, 2)
                    ELSE 0 END                          AS cogs_pct
        FROM eis.fact_cogs c
        JOIN eis.dim_product p   ON c.product_id = p.id
        JOIN eis.dim_period  per ON c.period_id  = per.id
        WHERE per.fiscal_year = :year AND per.period_num <= :period
        GROUP BY p.product_name
        HAVING SUM(c.sales_amount) > 0
        ORDER BY cogs_pct DESC
    """)
    result = await db.execute(q, {"year": year, "period": period})
    return {"data": [dict(r) for r in result.mappings().all()]}


@router.post("/cogs/upload")
async def upload_cogs(
    year: int = Query(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Parse COGS Excel and distribute into fact_cogs proportionally based on OE sales."""
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=422, detail="File harus .xlsx atau .xls")

    content = await file.read()
    products = _parse_cogs_excel(content)

    # Get all period_ids for the year
    periods_res = await db.execute(
        text("SELECT id, period_num FROM eis.dim_period WHERE fiscal_year=:y ORDER BY period_num"),
        {"y": year},
    )
    all_periods = {r[1]: r[0] for r in periods_res.fetchall()}  # period_num → period_id

    loaded = 0
    skipped = []
    results = []

    for item in products:
        prod_name = item["product_name"]
        total_cogs = item["cogs_total"]

        # Match product in dim_product (case-insensitive partial match)
        match_res = await db.execute(
            text("""
                SELECT id, product_name
                FROM eis.dim_product
                WHERE LOWER(product_name) LIKE LOWER(:name)
                   OR LOWER(:name) LIKE '%' || LOWER(product_name) || '%'
                ORDER BY LENGTH(product_name) ASC
                LIMIT 1
            """),
            {"name": f"%{prod_name}%"},
        )
        prod_row = match_res.fetchone()

        if not prod_row:
            logger.warning(f"[upload_cogs] Product not found in dim_product: '{prod_name}'")
            skipped.append(prod_name)
            continue

        product_id = prod_row[0]
        matched_name = prod_row[1]

        # Get existing sales per period for this product+year
        sales_res = await db.execute(
            text("""
                SELECT fc.period_id, per.period_num, fc.sales_amount
                FROM eis.fact_cogs fc
                JOIN eis.dim_period per ON fc.period_id = per.id
                WHERE fc.product_id = :pid AND per.fiscal_year = :year
                ORDER BY per.period_num
            """),
            {"pid": product_id, "year": year},
        )
        sales_rows = sales_res.fetchall()  # (period_id, period_num, sales_amount)

        if sales_rows:
            # Distribute COGS proportionally based on sales
            total_sales = sum(float(r[2] or 0) for r in sales_rows)
            for period_id, period_num, sales_amt in sales_rows:
                if total_sales > 0:
                    cogs_for_period = round(total_cogs * (float(sales_amt or 0) / total_sales), 2)
                else:
                    cogs_for_period = round(total_cogs / len(sales_rows), 2)

                await db.execute(text("""
                    UPDATE eis.fact_cogs
                    SET cogs_total = :cogs
                    WHERE period_id = :pid AND product_id = :prod_id
                """), {"cogs": cogs_for_period, "pid": period_id, "prod_id": product_id})
            loaded += 1
        else:
            # No existing sales rows — insert with equal monthly distribution
            cogs_per_month = round(total_cogs / 12, 2)
            for period_num, period_id in all_periods.items():
                await db.execute(text("""
                    INSERT INTO eis.fact_cogs (period_id, product_id, cogs_total, sales_amount)
                    VALUES (:pid, :prod_id, :cogs, 0)
                    ON CONFLICT (period_id, product_id) DO UPDATE SET
                        cogs_total = EXCLUDED.cogs_total
                """), {"pid": period_id, "prod_id": product_id, "cogs": cogs_per_month})
            loaded += 1
            logger.info(f"[upload_cogs] '{prod_name}' has no OE sales — distributed equally ({cogs_per_month}/month)")

        results.append({
            "excel_name": prod_name,
            "matched_name": matched_name,
            "cogs_total": total_cogs,
        })

    await db.commit()

    return {
        "message": f"Berhasil update {loaded} produk COGS untuk tahun {year}",
        "year": year,
        "loaded": loaded,
        "skipped": skipped,
        "data": results,
    }

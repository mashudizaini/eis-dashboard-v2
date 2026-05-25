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
# COGS Upload — format baru (COGS Data New.xlsx)
#
# Struktur Excel:
#   Row 1-2 : judul / catatan
#   Row 3   : header utama (No, Market, Customer, Products,
#             Price USD, Price IDR, COGS Quantity, COGS Amount)
#   Row 4   : sub-header (tahun untuk Price, nama bulan Jan-Dec)
#   Row 5+  : data produk
#
# Kolom (0-indexed):
#   col 1  = No (nomor urut)
#   col 2  = Market  (Public / Private / CMO / Export / Service Agreement)
#   col 3  = Customer
#   col 4  = Products (nama produk pendek + berat, e.g. "Carboplatin 150 mg")
#   col 6  = Price USD 2024
#   col 7  = Price USD 2025
#   col 7  = Price IDR 2024
#   col 8  = Price IDR 2025
#   col 9–20  = COGS Quantity per bulan Jan–Dec
#   col 21 = Total Quantity
#   col 22–33 = COGS Amount per bulan Jan–Dec (juta IDR)
#   col 34 = Total COGS Amount
#   col 37 = Nama produk lengkap dengan brand
#   col 40 = Kode barang (opsional, diisi jika ada)
# ══════════════════════════════════════════════════════════════

_MARKET_BIZ_TYPE = {
    "public":            "Local",
    "private":           "Local",
    "service agreement": "Local",
    "accounting":        "Local",
    "cmo":               "CMO",
    "export":            "Export",
}

_MARKET_CODE = {
    "public":            "PUB",
    "private":           "PRI",
    "cmo":               "CMO",
    "export":            "EXP",
    "service agreement": "SVC",
    "accounting":        "ACC",
}


def _parse_cogs_new_excel(content: bytes) -> list[dict]:
    """Parse COGS Data New.xlsx format.

    Returns list of dicts:
      {product_code, product_short, product_full, biz_type, market,
       price_idr, qty[12], cogs_amt[12]}
    """
    try:
        import openpyxl
    except ImportError:
        raise HTTPException(status_code=500, detail="openpyxl not installed")

    wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
    ws = wb.active

    records = []
    for row in ws.iter_rows(min_row=5, values_only=True):
        no = row[1] if len(row) > 1 else None
        if no is None or not isinstance(no, (int, float)):
            continue

        market       = str(row[2] or "Public").strip()
        product_short = str(row[4] or "").strip()
        # col 37 = full brand name (0-indexed), col 40 = explicit product code
        product_full = str(row[37] if len(row) > 37 and row[37] else row[4] or "").strip()
        # Use explicit product code if present (col 40), else generate
        explicit_code = str(row[40]).strip() if len(row) > 40 and row[40] else None

        # Price IDR 2025 = col 8 (0-indexed)
        price_idr = float(row[8] or 0) if len(row) > 8 else 0.0

        qty      = [float(row[9  + i] or 0) if len(row) > 9  + i else 0.0 for i in range(12)]
        cogs_amt = [float(row[22 + i] or 0) if len(row) > 22 + i else 0.0 for i in range(12)]

        # Skip rows with no data at all
        if not any(qty) and not any(cogs_amt):
            continue

        mkt_lower = market.lower()
        biz_type  = _MARKET_BIZ_TYPE.get(mkt_lower, "Local")
        mkt_code  = _MARKET_CODE.get(mkt_lower, "OTH")

        if explicit_code:
            product_code = explicit_code[:20]
        else:
            product_code = f"{mkt_code}{int(no):03d}"[:20]

        records.append({
            "product_code":  product_code,
            "product_short": product_short,
            "product_full":  (product_full or product_short)[:150],
            "biz_type":      biz_type,
            "market":        market,
            "price_idr":     price_idr,
            "qty":           qty,       # list[float] len=12
            "cogs_amt":      cogs_amt,  # list[float] len=12, unit = juta IDR
        })

    if not records:
        raise HTTPException(
            status_code=422,
            detail=(
                "Tidak ada data yang bisa dibaca. "
                "Pastikan format file sesuai: baris 3 header, baris 4 nama bulan, "
                "baris 5+ data produk dengan kolom No di kolom B."
            ),
        )
    return records


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
    """Parse COGS Excel (format baru) dan insert langsung per bulan ke fact_cogs.

    Format file: COGS Data New.xlsx
    - Baris 3   : header kolom
    - Baris 4   : nama bulan (Jan–Dec)
    - Baris 5+  : data produk
    - Kolom B   : No urut
    - Kolom C   : Market (Public/Private/CMO/Export/Service Agreement)
    - Kolom E   : Nama produk (pendek)
    - Kolom I   : Price IDR tahun upload
    - Kolom J–U : COGS Quantity Jan–Dec
    - Kolom W–AH: COGS Amount Jan–Dec (juta IDR)
    - Kolom AL  : Nama produk lengkap dengan brand (opsional)
    - Kolom AO  : Kode barang (opsional, jika kosong digenerate otomatis)
    """
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=422, detail="File harus .xlsx atau .xls")

    content = await file.read()
    records = _parse_cogs_new_excel(content)

    # Build period_id lookup for the target year
    periods_res = await db.execute(
        text("SELECT period_num, id FROM eis.dim_period WHERE fiscal_year=:y ORDER BY period_num"),
        {"y": year},
    )
    period_map = {r[0]: r[1] for r in periods_res.fetchall()}

    if not period_map:
        raise HTTPException(status_code=422, detail=f"Tidak ada data periode untuk tahun {year}")

    loaded_products = 0
    loaded_cogs = 0
    skipped = []
    results = []

    for rec in records:
        # Upsert dim_product
        await db.execute(text("""
            INSERT INTO eis.dim_product (product_code, product_name, business_type, market)
            VALUES (:code, :name, :biz, :mkt)
            ON CONFLICT (product_code) DO UPDATE SET
                product_name  = EXCLUDED.product_name,
                business_type = EXCLUDED.business_type,
                market        = EXCLUDED.market
        """), {
            "code": rec["product_code"],
            "name": rec["product_full"],
            "biz":  rec["biz_type"],
            "mkt":  rec["market"],
        })

        prod_res = await db.execute(
            text("SELECT id FROM eis.dim_product WHERE product_code = :code"),
            {"code": rec["product_code"]},
        )
        product_id = prod_res.fetchone()[0]
        loaded_products += 1

        month_loaded = 0
        for month_idx, (qty, cogs_amt) in enumerate(zip(rec["qty"], rec["cogs_amt"])):
            if qty == 0 and cogs_amt == 0:
                continue

            month_num = month_idx + 1
            period_id = period_map.get(month_num)
            if not period_id:
                continue

            # sales_amount = Price IDR × Qty ÷ 1,000,000 (juta IDR)
            sales_amt = round(rec["price_idr"] * qty / 1_000_000, 4)
            ebit_amt  = round(sales_amt - cogs_amt, 4)

            await db.execute(text("""
                INSERT INTO eis.fact_cogs
                    (period_id, product_id, sales_amount, cogs_total, ebit_amount)
                VALUES (:pid, :prod_id, :sales, :cogs, :ebit)
                ON CONFLICT (period_id, product_id) DO UPDATE SET
                    sales_amount = EXCLUDED.sales_amount,
                    cogs_total   = EXCLUDED.cogs_total,
                    ebit_amount  = EXCLUDED.ebit_amount
            """), {
                "pid":     period_id,
                "prod_id": product_id,
                "sales":   sales_amt,
                "cogs":    round(cogs_amt, 4),
                "ebit":    ebit_amt,
            })
            month_loaded += 1
            loaded_cogs += 1

        results.append({
            "product_code":  rec["product_code"],
            "product_name":  rec["product_full"],
            "market":        rec["market"],
            "months_loaded": month_loaded,
        })
        if month_loaded == 0:
            skipped.append(rec["product_code"])

    await db.commit()
    logger.info(f"[upload_cogs] {loaded_products} products, {loaded_cogs} cogs rows for {year}")

    return {
        "message": f"Berhasil upload {loaded_products} produk ({loaded_cogs} baris COGS) untuk tahun {year}",
        "year":    year,
        "products": loaded_products,
        "cogs_rows": loaded_cogs,
        "skipped": skipped,
        "data":    results,
    }

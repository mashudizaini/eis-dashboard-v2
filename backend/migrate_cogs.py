"""
migrate_cogs.py — One-time migration script for COGS Data New.xlsx

Reads COGS Data New.xlsx, clears old COGS data, inserts fresh dim_product
and fact_cogs records for 2025 (Jan–Sep) into the EIS PostgreSQL database.

Run inside the backend Docker container:
    docker compose exec backend python migrate_cogs.py

Or locally (update DB_URL to point to localhost:5433):
    python migrate_cogs.py
"""

import os
import sys
import psycopg2
import openpyxl

# ── Connection ──────────────────────────────────────────────────────
DB_URL = os.environ.get(
    "DATABASE_URL_SYNC",
    "postgresql://eis_user:eis_secret@postgres:5432/eis_dashboard"
)

EXCEL_PATH = os.path.join(os.path.dirname(__file__), "data_upload", "COGS Data New.xlsx")
FISCAL_YEAR = 2025

# ── Market → business_type mapping ──────────────────────────────────
MARKET_BIZ_TYPE = {
    "Public":            "Local",
    "Private":           "Local",
    "Service Agreement": "Local",
    "Accounting":        "Local",
    "CMO":               "CMO",
    "Export":            "Export",
}

MARKET_CODE = {
    "Public":            "PUB",
    "Private":           "PRI",
    "CMO":               "CMO",
    "Export":            "EXP",
    "Service Agreement": "SVC",
    "Accounting":        "ACC",
}

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def parse_excel(path: str) -> list[dict]:
    """Parse COGS Data New.xlsx.

    Structure:
      Row 1-2 : title / notes
      Row 3   : main headers (No, Market, Customer, Products, Price USD, Price IDR,
                              COGS Quantity, COGS Amount)
      Row 4   : sub-headers  (year columns for Price, month names for Qty/Amount)
      Row 5+  : data

    Column mapping (0-indexed):
      1  = No
      2  = Market
      3  = Customer
      4  = Products (short name incl. weight)
      5  = Price USD 2024
      6  = Price USD 2025
      7  = Price IDR 2024
      8  = Price IDR 2025
      9–20  = COGS Quantity Jan–Dec
      21 = Total Quantity
      22–33 = COGS Amount Jan–Dec (millions IDR)
      34 = Total COGS Amount
      37 = Full brand name (e.g. "Kemobotin / Carboplatin 150 mg")
    """
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb.active

    records = []
    for row in ws.iter_rows(min_row=5, values_only=True):
        no = row[1]
        if no is None or not isinstance(no, (int, float)):
            continue

        market = str(row[2] or "Public").strip()
        product_short = str(row[4] or "").strip()
        product_full  = str(row[37] or row[4] or "").strip()
        price_idr_2025 = float(row[8] or 0)

        qty   = [float(row[9  + i] or 0) for i in range(12)]
        cogs  = [float(row[22 + i] or 0) for i in range(12)]

        # Skip rows where all months are zero
        if not any(qty) and not any(cogs):
            continue

        mkt_code = MARKET_CODE.get(market, "OTH")
        product_code = f"{mkt_code}{int(no):03d}"   # e.g. PUB001, CMO003

        records.append({
            "no":            int(no),
            "market":        market,
            "product_code":  product_code[:20],
            "product_short": product_short,
            "product_full":  product_full[:150],
            "biz_type":      MARKET_BIZ_TYPE.get(market, "Local"),
            "price_idr":     price_idr_2025,
            "qty":           qty,    # list[float] len=12
            "cogs_amt":      cogs,   # list[float] len=12, unit = millions IDR
        })

    return records


def run():
    print(f"[migrate_cogs] Connecting to: {DB_URL.split('@')[1]}")
    pg = psycopg2.connect(DB_URL)
    cur = pg.cursor()

    # ── Parse Excel ──────────────────────────────────────────────────
    print(f"[migrate_cogs] Reading {EXCEL_PATH}")
    records = parse_excel(EXCEL_PATH)
    print(f"[migrate_cogs] Parsed {len(records)} products with data")

    # ── Clear old COGS ETL data ──────────────────────────────────────
    # Only delete rows that came from ETL (product_code is all-numeric, i.e. inventory_item_id)
    # Keep manually-uploaded products.
    # Safest: truncate fact_cogs completely then re-insert from this file.
    cur.execute("TRUNCATE eis.fact_cogs RESTART IDENTITY CASCADE")
    # Remove old ETL-generated products (numeric codes from inventory_item_id)
    cur.execute("""
        DELETE FROM eis.dim_product
        WHERE product_code ~ '^[0-9]+$'
    """)
    print("[migrate_cogs] Cleared old ETL COGS data")

    # ── Build period_id map ──────────────────────────────────────────
    cur.execute(
        "SELECT period_num, id FROM eis.dim_period WHERE fiscal_year = %s",
        (FISCAL_YEAR,)
    )
    period_map = {row[0]: row[1] for row in cur.fetchall()}
    if not period_map:
        print(f"[migrate_cogs] ERROR: No dim_period rows for year {FISCAL_YEAR}. Aborting.")
        sys.exit(1)

    # ── Insert products & monthly fact_cogs ─────────────────────────
    loaded_products = 0
    loaded_cogs = 0
    skipped_periods = []

    for rec in records:
        # Upsert dim_product
        cur.execute("""
            INSERT INTO eis.dim_product (product_code, product_name, business_type, market)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (product_code) DO UPDATE SET
                product_name  = EXCLUDED.product_name,
                business_type = EXCLUDED.business_type,
                market        = EXCLUDED.market
        """, (rec["product_code"], rec["product_full"] or rec["product_short"],
              rec["biz_type"], rec["market"]))

        cur.execute(
            "SELECT id FROM eis.dim_product WHERE product_code = %s",
            (rec["product_code"],)
        )
        product_id = cur.fetchone()[0]
        loaded_products += 1

        # Insert monthly data
        for month_idx, (qty, cogs_amt) in enumerate(zip(rec["qty"], rec["cogs_amt"])):
            month_num = month_idx + 1

            if qty == 0 and cogs_amt == 0:
                continue   # skip empty months

            period_id = period_map.get(month_num)
            if not period_id:
                skipped_periods.append((rec["product_code"], month_num))
                continue

            # Sales amount = Price IDR × Quantity ÷ 1,000,000 (convert to millions IDR)
            sales_amt = round(rec["price_idr"] * qty / 1_000_000, 4)
            ebit_amt  = round(sales_amt - cogs_amt, 4)

            cur.execute("""
                INSERT INTO eis.fact_cogs
                    (period_id, product_id, sales_amount, cogs_total, ebit_amount)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (period_id, product_id) DO UPDATE SET
                    sales_amount = EXCLUDED.sales_amount,
                    cogs_total   = EXCLUDED.cogs_total,
                    ebit_amount  = EXCLUDED.ebit_amount
            """, (period_id, product_id, sales_amt, round(cogs_amt, 4), ebit_amt))
            loaded_cogs += 1

    pg.commit()
    print(f"[migrate_cogs] Inserted/updated {loaded_products} products in dim_product")
    print(f"[migrate_cogs] Inserted/updated {loaded_cogs} rows in fact_cogs")
    if skipped_periods:
        print(f"[migrate_cogs] Skipped {len(skipped_periods)} period mismatches: {skipped_periods[:5]}")
    print("[migrate_cogs] Done.")
    pg.close()


if __name__ == "__main__":
    run()

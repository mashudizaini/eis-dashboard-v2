"""
migrate_cogs.py — One-time migration script for COGS Data New.xlsx

Produk digabung berdasarkan nama dasar (tanpa kekuatan/berat):
  Paclitaxel 30 mg + Paclitaxel 100 mg + Paclitaxel 300 mg
  → satu entri "Paclitaxel" per market

Quantity dan COGS Amount dijumlahkan per (base_name, market, bulan).
Product_code = {BASECODE}_{MKT}  e.g. CARBOPLATIN_PUB, PACLITAXEL_CMO

Run inside the backend Docker container:
    docker compose exec backend python migrate_cogs.py
"""

import os
import sys
import re
import psycopg2
import openpyxl
from collections import defaultdict

# ── Connection ──────────────────────────────────────────────────────
DB_URL = os.environ.get(
    "DATABASE_URL_SYNC",
    "postgresql://eis_user:eis_secret@postgres:5432/eis_dashboard"
)

EXCEL_PATH = os.path.join(os.path.dirname(__file__), "data_upload", "COGS Data New.xlsx")
FISCAL_YEAR = 2025

# ── Market mappings ──────────────────────────────────────────────────
MARKET_BIZ_TYPE = {
    "public":            "Local",
    "private":           "Local",
    "service agreement": "Local",
    "accounting":        "Local",
    "cmo":               "CMO",
    "export":            "Export",
}

MARKET_CODE = {
    "public":            "PUB",
    "private":           "PRI",
    "cmo":               "CMO",
    "export":            "EXP",
    "service agreement": "SVC",
    "accounting":        "ACC",
}

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def extract_base_name(product_name: str) -> str:
    """Remove strength/weight suffix, return base drug name.

    Examples:
      'Carboplatin 150 mg'    → 'Carboplatin'
      'Paclitaxel 30 mg'      → 'Paclitaxel'
      'Gemcitabine 200 mg - Liquid' → 'Gemcitabine'
      'Darbepoetin alfa 20 mcg' → 'Darbepoetin alfa'
    """
    # Remove strength: "NNN unit" at end (mg, mcg, gr, g, ml, IU, L, mL, µg, μg)
    base = re.sub(
        r'\s+[\d,\.]+\s*(mg|mcg|gr|g(?!em)|ml|mL|L|IU|iu|µg|μg)(/\w+)?\s*$',
        '', product_name, flags=re.IGNORECASE
    ).strip()
    # Remove trailing "- Liquid" or "Liquid"
    base = re.sub(r'\s*[-–]\s*Liquid\s*$', '', base, flags=re.IGNORECASE).strip()
    return base if base else product_name


def make_product_code(base_name: str, market: str) -> str:
    """Generate unique product_code <= 20 chars from base name + market."""
    mkt_lower = market.lower()
    mkt_code  = MARKET_CODE.get(mkt_lower, "OTH")
    clean     = re.sub(r'[^A-Za-z0-9]', '', base_name)[:12].upper()
    return f"{clean}_{mkt_code}"   # e.g. "PACLITAXEL_CMO" (max 16 chars)


def parse_and_group(path: str) -> dict:
    """Parse Excel and aggregate by (base_name, market, month).

    Returns:
      {
        (base_name, market): {
          'product_code': str,
          'biz_type':     str,
          'price_idr':    float,         # average weighted by qty
          'qty':          [float x 12],  # total per month
          'cogs_amt':     [float x 12],  # total (juta IDR) per month
        }
      }
    """
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb.active

    # Aggregation: key = (base_name, market)
    groups: dict = {}

    for row in ws.iter_rows(min_row=5, values_only=True):
        no = row[1] if len(row) > 1 else None
        if no is None or not isinstance(no, (int, float)):
            continue

        market        = str(row[2] or "Public").strip()
        product_short = str(row[4] or "").strip()
        price_idr     = float(row[8] or 0) if len(row) > 8 else 0.0
        full_name     = str(row[37] if len(row) > 37 and row[37] else row[4] or "").strip()

        qty      = [float(row[9  + i] or 0) if len(row) > 9  + i else 0.0 for i in range(12)]
        cogs_amt = [float(row[22 + i] or 0) if len(row) > 22 + i else 0.0 for i in range(12)]

        # Skip rows with no data at all
        if not any(qty) and not any(cogs_amt):
            continue

        base_name = extract_base_name(product_short)
        key       = (base_name, market)

        if key not in groups:
            groups[key] = {
                "product_code": make_product_code(base_name, market)[:20],
                "biz_type":     MARKET_BIZ_TYPE.get(market.lower(), "Local"),
                "market":       market,
                # Use the first full_name as display name; aggregate later
                "display_name": f"{base_name} ({market})" if market != "Public" else base_name,
                "price_idr":    price_idr,
                "qty":          [0.0] * 12,
                "cogs_amt":     [0.0] * 12,
                "total_qty":    0.0,
                "total_sales":  0.0,
            }

        g = groups[key]
        for i in range(12):
            g["qty"][i]      += qty[i]
            g["cogs_amt"][i] += cogs_amt[i]

        # Weighted average price by quantity
        row_total_qty   = sum(qty)
        row_total_sales = price_idr * row_total_qty
        g["total_qty"]   += row_total_qty
        g["total_sales"] += row_total_sales

    # Compute effective price_idr = total_sales / total_qty
    for g in groups.values():
        if g["total_qty"] > 0:
            g["price_idr"] = g["total_sales"] / g["total_qty"]

    return groups


def run():
    print(f"[migrate_cogs] Connecting to: {DB_URL.split('@')[1]}")
    pg  = psycopg2.connect(DB_URL)
    cur = pg.cursor()

    # ── Parse & group ────────────────────────────────────────────────
    print(f"[migrate_cogs] Reading {EXCEL_PATH}")
    groups = parse_and_group(EXCEL_PATH)
    print(f"[migrate_cogs] {len(groups)} unique (product, market) groups after aggregation")

    # ── Clear old COGS data ──────────────────────────────────────────
    cur.execute("TRUNCATE eis.fact_cogs RESTART IDENTITY CASCADE")
    # Remove ETL-generated products (all-numeric codes from inventory_item_id)
    cur.execute("DELETE FROM eis.dim_product WHERE product_code ~ '^[0-9]+$'")
    # Remove previously migrated products (code pattern XXXX_YYY)
    cur.execute("DELETE FROM eis.dim_product WHERE product_code ~ '^[A-Z0-9]+_[A-Z]+$'")
    print("[migrate_cogs] Cleared old COGS data")

    # ── Build period_id map ──────────────────────────────────────────
    cur.execute(
        "SELECT period_num, id FROM eis.dim_period WHERE fiscal_year = %s",
        (FISCAL_YEAR,)
    )
    period_map = {row[0]: row[1] for row in cur.fetchall()}
    if not period_map:
        print(f"[migrate_cogs] ERROR: No dim_period rows for year {FISCAL_YEAR}.")
        sys.exit(1)

    # ── Insert products & fact_cogs ──────────────────────────────────
    loaded_products = 0
    loaded_cogs     = 0
    skipped_periods = []

    for (base_name, market), g in sorted(groups.items()):
        code      = g["product_code"]
        disp_name = g["display_name"][:150]
        biz_type  = g["biz_type"]

        cur.execute("""
            INSERT INTO eis.dim_product (product_code, product_name, business_type, market)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (product_code) DO UPDATE SET
                product_name  = EXCLUDED.product_name,
                business_type = EXCLUDED.business_type,
                market        = EXCLUDED.market
        """, (code, disp_name, biz_type, market))

        cur.execute("SELECT id FROM eis.dim_product WHERE product_code = %s", (code,))
        product_id = cur.fetchone()[0]
        loaded_products += 1

        price_idr = g["price_idr"]

        for month_idx, (qty, cogs_amt) in enumerate(zip(g["qty"], g["cogs_amt"])):
            if qty == 0 and cogs_amt == 0:
                continue

            month_num = month_idx + 1
            period_id = period_map.get(month_num)
            if not period_id:
                skipped_periods.append((code, month_num))
                continue

            # sales = Price IDR × Qty ÷ 1,000,000 (juta IDR)
            sales_amt = round(price_idr * qty / 1_000_000, 4)
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

    # ── Summary ──────────────────────────────────────────────────────
    cur.execute("SELECT COUNT(*) FROM eis.dim_product")
    print(f"[migrate_cogs] dim_product total: {cur.fetchone()[0]} rows")
    cur.execute("SELECT COUNT(*) FROM eis.fact_cogs")
    print(f"[migrate_cogs] fact_cogs   total: {cur.fetchone()[0]} rows")
    print("[migrate_cogs] Done.")
    pg.close()


if __name__ == "__main__":
    run()

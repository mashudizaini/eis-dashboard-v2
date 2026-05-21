"""Diagnostic script v2 — cari kolom quantity di OPM."""
import sys
sys.path.insert(0, '/app')

from app.database import get_oracle_connection

try:
    ora = get_oracle_connection()
    cur = ora.cursor()
    print("Connection: OK\n")

    # 1. Semua kolom gme_batch_header yang mengandung 'qty' atau 'quantity'
    cur.execute("""
        SELECT column_name, data_type
        FROM all_tab_columns
        WHERE table_name = 'GME_BATCH_HEADER'
          AND (LOWER(column_name) LIKE '%qty%' OR LOWER(column_name) LIKE '%quantity%')
        ORDER BY column_name
    """)
    print("1. gme_batch_header qty-columns:")
    for r in cur.fetchall():
        print("  ", r)

    # 2. Cek tabel gme_material_details (product output lines)
    cur.execute("""
        SELECT COUNT(*) FROM gme_material_details WHERE ROWNUM <= 1
    """)
    print("\n2. gme_material_details accessible:", cur.fetchone()[0])

    cur.execute("""
        SELECT column_name, data_type
        FROM all_tab_columns
        WHERE table_name = 'GME_MATERIAL_DETAILS'
          AND (LOWER(column_name) LIKE '%qty%' OR LOWER(column_name) LIKE '%quantity%'
               OR LOWER(column_name) LIKE '%line_type%')
        ORDER BY column_name
    """)
    print("   gme_material_details qty/line_type columns:")
    for r in cur.fetchall():
        print("  ", r)

    # 3. Distinct line_type values
    cur.execute("""
        SELECT DISTINCT gmd.line_type, COUNT(*)
        FROM gme_material_details gmd
        JOIN gme_batch_header gbh ON gmd.batch_id = gbh.batch_id
        WHERE gbh.batch_status IN (3, 4)
          AND EXTRACT(YEAR FROM gbh.actual_cmplt_date) = 2025
        GROUP BY gmd.line_type
        ORDER BY gmd.line_type
    """)
    print("\n3. line_type values (1=product output, -1=ingredient):", cur.fetchall())

    # 4. Test query dengan join ke gme_material_details (line_type=1 = product)
    cur.execute("""
        SELECT TO_CHAR(gbh.actual_cmplt_date, 'YYYY-MM') AS period,
               SUM(NVL(gmd.plan_qty,   0)) AS planned_qty,
               SUM(NVL(gmd.actual_qty, 0)) AS actual_qty
        FROM gme_batch_header     gbh
        JOIN gme_material_details gmd ON gbh.batch_id = gmd.batch_id
        WHERE gbh.batch_status IN (3, 4)
          AND gbh.actual_cmplt_date IS NOT NULL
          AND gmd.line_type = 1
          AND EXTRACT(YEAR FROM gbh.actual_cmplt_date) = 2025
        GROUP BY TO_CHAR(gbh.actual_cmplt_date, 'YYYY-MM')
        ORDER BY 1
    """)
    rows = cur.fetchall()
    print(f"\n4. Query with gme_material_details ({len(rows)} rows):")
    for r in rows:
        print("  ", r)

    ora.close()

except Exception as e:
    print(f"\nERROR: {type(e).__name__}: {e}")

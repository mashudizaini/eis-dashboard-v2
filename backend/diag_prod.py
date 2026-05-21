import sys
sys.path.insert(0, '/app')
from app.database import get_oracle_connection

try:
    ora = get_oracle_connection()
    cur = ora.cursor()
    print("Connection: OK")

    cur.execute("""SELECT column_name FROM all_tab_columns
        WHERE table_name='GME_BATCH_HEADER'
        AND (LOWER(column_name) LIKE '%qty%' OR LOWER(column_name) LIKE '%quantity%')
        ORDER BY column_name""")
    print("gme_batch_header qty cols:", [r[0] for r in cur.fetchall()])

    try:
        cur.execute("SELECT COUNT(*) FROM gme_material_details WHERE ROWNUM<=1")
        print("gme_material_details accessible:", cur.fetchone()[0])

        cur.execute("""SELECT TO_CHAR(gbh.actual_cmplt_date,'YYYY-MM') period,
               SUM(NVL(gmd.plan_qty,0)) plan, SUM(NVL(gmd.actual_qty,0)) actual
        FROM gme_batch_header gbh
        JOIN gme_material_details gmd ON gbh.batch_id=gmd.batch_id
        WHERE gbh.batch_status IN (3,4)
          AND gbh.actual_cmplt_date IS NOT NULL
          AND gmd.line_type=1
          AND EXTRACT(YEAR FROM gbh.actual_cmplt_date)=2025
        GROUP BY TO_CHAR(gbh.actual_cmplt_date,'YYYY-MM') ORDER BY 1""")
        rows = cur.fetchall()
        print(f"gme_material_details query ({len(rows)} rows):")
        for r in rows: print(" ", r)
    except Exception as e2:
        print("gme_material_details ERROR:", e2)

        cur.execute("""SELECT column_name FROM all_tab_columns
            WHERE table_name='GME_BATCH_HEADER'
            ORDER BY column_id""")
        print("ALL gme_batch_header columns:")
        for r in cur.fetchall(): print(" ", r[0])

    ora.close()
except Exception as e:
    print(f"ERROR: {type(e).__name__}: {e}")

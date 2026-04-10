import json
import logging
from collections import defaultdict
from datetime import datetime
from app.tasks.celery_app import celery_app
from app.config import get_settings
from app.database import get_oracle_connection
import psycopg2

logger = logging.getLogger(__name__)
settings = get_settings()


def _get_pg():
    return psycopg2.connect(settings.DATABASE_URL_SYNC)


def _log_start(pg, job_name, year, month):
    run_params = json.dumps({"year": year, "month": month})
    cur = pg.cursor()
    cur.execute(
        "INSERT INTO eis.etl_job_log (job_name, status, run_params) VALUES (%s, 'running', %s) RETURNING id",
        (job_name, run_params),
    )
    pg.commit()
    return cur.fetchone()[0]


def _log_end(pg, job_id, status, records=0, error=None):
    cur = pg.cursor()
    cur.execute(
        "UPDATE eis.etl_job_log SET status=%s, finished_at=NOW(), records_processed=%s, error_message=%s WHERE id=%s",
        (status, records, error, job_id),
    )
    pg.commit()


def _month_filter_gl(year, month):
    """Return Oracle GL period_name filter clause and params."""
    if month:
        # Oracle GL period_name format: 'MMM-YY' e.g. 'JAN-26'
        month_abbr = datetime(year, month, 1).strftime('%b').upper()
        year_short = str(year)[-2:]
        period = f"{month_abbr}-{year_short}"
        return "AND gb.period_name = :period_name AND gb.period_year = :year", {
            "period_name": period, "year": year,
        }
    return "AND gb.period_year = :year", {"year": year}


def _parse_gl_period(period_name_ora):
    """Parse Oracle GL period_name 'MMM-YY' → (year, month). Returns None on error."""
    try:
        month_abbr = period_name_ora[:3]
        year_short = int(period_name_ora[4:])
        ora_year = 2000 + year_short
        ora_month = datetime.strptime(month_abbr, '%b').month
        return ora_year, ora_month
    except (ValueError, IndexError):
        return None


def _get_period_id(cur_pg, year, month):
    """Lookup period_id from dim_period. Returns None if not found."""
    cur_pg.execute(
        "SELECT id FROM eis.dim_period WHERE fiscal_year=%s AND period_num=%s",
        (year, month),
    )
    row = cur_pg.fetchone()
    return row[0] if row else None


def _normalize_biz_type(raw):
    """Map Oracle segment value to known business_type."""
    if not raw:
        return 'Local'
    val = str(raw).strip().upper()
    if 'CMO' in val:
        return 'CMO'
    if 'EXPORT' in val or 'EXP' in val:
        return 'Export'
    return 'Local'


@celery_app.task(name="app.tasks.etl_tasks.etl_sales")
def etl_sales(year: int = None, month: int = None):
    """Extract sales data from Oracle GL_BALANCES and load into fact_sales."""
    year = year or datetime.now().year
    pg = _get_pg()
    job_id = _log_start(pg, "etl_sales", year, month)
    records = 0
    try:
        ora = get_oracle_connection()
        cur_ora = ora.cursor()

        period_clause, period_params = _month_filter_gl(year, month)
        cur_ora.execute(f"""
            SELECT
                gb.period_name,
                gcc.segment2 as product_segment,
                gcc.segment4 as business_segment,
                SUM(NVL(gb.period_net_dr, 0) - NVL(gb.period_net_cr, 0)) as net_amount,
                gb.actual_flag
            FROM gl_balances gb
            JOIN gl_code_combinations gcc ON gb.code_combination_id = gcc.code_combination_id
            WHERE gb.actual_flag IN ('A', 'B')
              AND gcc.segment3 BETWEEN '40000' AND '49999'
              AND gb.currency_code = 'IDR'
              {period_clause}
            GROUP BY gb.period_name, gcc.segment2, gcc.segment4, gb.actual_flag
        """, period_params)

        rows = cur_ora.fetchall()
        records = len(rows)
        logger.info(f"[etl_sales] Extracted {records} rows from Oracle GL (year={year}, month={month})")
        ora.close()

        # ── LOAD ──────────────────────────────────────────────────
        # Aggregate per (period, business_type, actual_flag)
        # key = (ora_year, ora_month, biz_type) → {A: total, B: total}
        agg = defaultdict(lambda: {'A': 0.0, 'B': 0.0})

        for period_name_ora, product_segment, business_segment, net_amount, actual_flag in rows:
            parsed = _parse_gl_period(period_name_ora)
            if not parsed:
                logger.warning(f"[etl_sales] Cannot parse period: {period_name_ora}")
                continue
            ora_year, ora_month = parsed
            biz_type = _normalize_biz_type(business_segment)
            # Revenue accounts are credits in GL → negate for positive sales figures
            amount = abs(float(net_amount or 0))
            key = (ora_year, ora_month, biz_type)
            if actual_flag in ('A', 'B'):
                agg[key][actual_flag] += amount

        cur_pg = pg.cursor()
        loaded = 0
        for (ora_year, ora_month, biz_type), amounts in agg.items():
            period_id = _get_period_id(cur_pg, ora_year, ora_month)
            if not period_id:
                logger.warning(f"[etl_sales] No dim_period for {ora_year}/{ora_month}")
                continue

            # DELETE existing aggregated row (product_id IS NULL) then INSERT
            cur_pg.execute(
                "DELETE FROM eis.fact_sales WHERE period_id=%s AND business_type=%s AND market='All' AND product_id IS NULL",
                (period_id, biz_type),
            )
            cur_pg.execute(
                """INSERT INTO eis.fact_sales
                       (period_id, product_id, business_type, market, bp_amount, actual_amount)
                   VALUES (%s, NULL, %s, 'All', %s, %s)""",
                (period_id, biz_type, amounts['B'], amounts['A']),
            )
            loaded += 1

        pg.commit()
        logger.info(f"[etl_sales] Loaded {loaded} rows into fact_sales")
        # ──────────────────────────────────────────────────────────

        _log_end(pg, job_id, "success", records)
        logger.info(f"[etl_sales] Completed: {records} extracted, {loaded} loaded")

    except Exception as e:
        logger.error(f"[etl_sales] Failed: {e}")
        _log_end(pg, job_id, "failed", records, str(e))
        raise
    finally:
        pg.close()

    return {"status": "success", "records": records}


@celery_app.task(name="app.tasks.etl_tasks.etl_ar_ap")
def etl_ar_ap(year: int = None, month: int = None):
    """Extract AR/AP balances from Oracle and load into fact_financial_ratio."""
    year = year or datetime.now().year
    pg = _get_pg()
    job_id = _log_start(pg, "etl_ar_ap", year, month)
    records = 0
    try:
        ora = get_oracle_connection()
        cur_ora = ora.cursor()

        if month:
            date_filter = "AND EXTRACT(YEAR FROM ps.due_date) = :year AND EXTRACT(MONTH FROM ps.due_date) = :month"
            date_params_ar = {"year": year, "month": month}
            date_filter_ap = "AND EXTRACT(YEAR FROM i.invoice_date) = :year AND EXTRACT(MONTH FROM i.invoice_date) = :month"
            date_params_ap = {"year": year, "month": month}
        else:
            date_filter = "AND EXTRACT(YEAR FROM ps.due_date) = :year"
            date_params_ar = {"year": year}
            date_filter_ap = "AND EXTRACT(YEAR FROM i.invoice_date) = :year"
            date_params_ap = {"year": year}

        cur_ora.execute(f"""
            SELECT
                TO_CHAR(ps.due_date, 'YYYY-MM') as period,
                SUM(ps.amount_due_remaining) as ar_balance
            FROM ar_payment_schedules_all ps
            WHERE ps.status = 'OP'
              {date_filter}
            GROUP BY TO_CHAR(ps.due_date, 'YYYY-MM')
            ORDER BY period
        """, date_params_ar)
        ar_rows = cur_ora.fetchall()

        cur_ora.execute(f"""
            SELECT
                TO_CHAR(i.invoice_date, 'YYYY-MM') as period,
                SUM(ps.amount_remaining) as ap_balance
            FROM ap_invoices_all i
            JOIN ap_payment_schedules_all ps ON i.invoice_id = ps.invoice_id
            WHERE ps.payment_status_flag != 'Y'
              {date_filter_ap}
            GROUP BY TO_CHAR(i.invoice_date, 'YYYY-MM')
            ORDER BY period
        """, date_params_ap)
        ap_rows = cur_ora.fetchall()

        records = len(ar_rows) + len(ap_rows)
        ora.close()

        # ── LOAD ──────────────────────────────────────────────────
        # Map period 'YYYY-MM' → period_id, collect AR and AP averages
        ar_map = {row[0]: float(row[1] or 0) for row in ar_rows}
        ap_map = {row[0]: float(row[1] or 0) for row in ap_rows}

        all_periods = set(ar_map.keys()) | set(ap_map.keys())
        cur_pg = pg.cursor()
        loaded = 0

        for period_str in all_periods:
            try:
                ora_year, ora_month = int(period_str[:4]), int(period_str[5:7])
            except (ValueError, IndexError):
                continue

            period_id = _get_period_id(cur_pg, ora_year, ora_month)
            if not period_id:
                logger.warning(f"[etl_ar_ap] No dim_period for {period_str}")
                continue

            ar_avg = ar_map.get(period_str, 0.0)
            ap_avg = ap_map.get(period_str, 0.0)

            # Sales from fact_sales for DSO
            cur_pg.execute(
                "SELECT COALESCE(SUM(actual_amount), 0) FROM eis.fact_sales WHERE period_id=%s",
                (period_id,),
            )
            sales_amt = float(cur_pg.fetchone()[0] or 0)

            # COGS: prefer fact_cogs; fall back to total expenses from fact_financial
            cur_pg.execute(
                "SELECT COALESCE(SUM(cogs_total), 0) FROM eis.fact_cogs WHERE period_id=%s",
                (period_id,),
            )
            cogs_amt = float(cur_pg.fetchone()[0] or 0)
            if cogs_amt == 0:
                cur_pg.execute(
                    """SELECT COALESCE(ABS(net_profit_actual - 0), 0),
                              COALESCE(cf_cash_out_actual, 0)
                       FROM eis.fact_financial WHERE period_id=%s""",
                    (period_id,),
                )
                fin_row = cur_pg.fetchone()
                if fin_row:
                    # Use cash_out as COGS proxy (cost of goods/services paid)
                    cogs_amt = float(fin_row[1] or 0)
                    if cogs_amt == 0:
                        # Last resort: derive from sales (assume 60% COGS ratio)
                        cogs_amt = sales_amt * 0.60

            # DSO = AR / (Sales/30), DPO = AP / (COGS/30)
            dso_days = round(ar_avg / (sales_amt / 30), 2) if sales_amt > 0 else 0.0
            dpo_days = round(ap_avg / (cogs_amt / 30), 2) if cogs_amt > 0 else 0.0

            cur_pg.execute(
                """INSERT INTO eis.fact_financial_ratio
                       (period_id, dso_ar_avg, dso_sales, dso_days,
                        dpo_ap_avg, dpo_cogs, dpo_days)
                   VALUES (%s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (period_id) DO UPDATE SET
                       dso_ar_avg = EXCLUDED.dso_ar_avg,
                       dso_sales  = EXCLUDED.dso_sales,
                       dso_days   = EXCLUDED.dso_days,
                       dpo_ap_avg = EXCLUDED.dpo_ap_avg,
                       dpo_cogs   = EXCLUDED.dpo_cogs,
                       dpo_days   = EXCLUDED.dpo_days""",
                (period_id, ar_avg, sales_amt, dso_days, ap_avg, cogs_amt, dpo_days),
            )
            loaded += 1

        pg.commit()
        logger.info(f"[etl_ar_ap] Loaded {loaded} rows into fact_financial_ratio")
        # ──────────────────────────────────────────────────────────

        _log_end(pg, job_id, "success", records)

    except Exception as e:
        logger.error(f"[etl_ar_ap] Failed: {e}")
        _log_end(pg, job_id, "failed", records, str(e))
        raise
    finally:
        pg.close()

    return {"status": "success", "records": records}


@celery_app.task(name="app.tasks.etl_tasks.etl_inventory")
def etl_inventory(year: int = None, month: int = None):
    """Extract inventory valuation from Oracle and load into fact_financial_ratio."""
    year = year or datetime.now().year
    pg = _get_pg()
    job_id = _log_start(pg, "etl_inventory", year, month)
    records = 0
    try:
        ora = get_oracle_connection()
        cur_ora = ora.cursor()

        if month:
            date_filter = "AND EXTRACT(YEAR FROM moq.last_update_date) = :year AND EXTRACT(MONTH FROM moq.last_update_date) = :month"
            date_params = {"year": year, "month": month}
        else:
            date_filter = "AND EXTRACT(YEAR FROM moq.last_update_date) = :year"
            date_params = {"year": year}

        cur_ora.execute(f"""
            SELECT
                moq.organization_id,
                SUM(moq.transaction_quantity * cic.item_cost) as inventory_value
            FROM mtl_onhand_quantities_detail moq
            JOIN cst_item_costs cic ON moq.inventory_item_id = cic.inventory_item_id
                AND moq.organization_id = cic.organization_id
                AND cic.cost_type_id = 1
            WHERE 1=1
              {date_filter}
            GROUP BY moq.organization_id
        """, date_params)
        rows = cur_ora.fetchall()
        records = len(rows)
        ora.close()

        # ── LOAD ──────────────────────────────────────────────────
        # Sum all organizations → total inventory value for the period
        total_inv = sum(float(r[1] or 0) for r in rows)

        if total_inv > 0:
            cur_pg = pg.cursor()
            ora_month = month or 12  # if full-year, use December as snapshot month

            period_id = _get_period_id(cur_pg, year, ora_month)
            if period_id:
                # COGS: prefer fact_cogs; fall back to cash_out from fact_financial
                cur_pg.execute(
                    "SELECT COALESCE(SUM(cogs_total), 0) FROM eis.fact_cogs WHERE period_id=%s",
                    (period_id,),
                )
                cogs_amt = float(cur_pg.fetchone()[0] or 0)
                if cogs_amt == 0:
                    cur_pg.execute(
                        "SELECT COALESCE(cf_cash_out_actual, 0) FROM eis.fact_financial WHERE period_id=%s",
                        (period_id,),
                    )
                    fin_row = cur_pg.fetchone()
                    if fin_row:
                        cogs_amt = float(fin_row[0] or 0)
                    if cogs_amt == 0:
                        # Last resort: derive from sales (assume 60% COGS ratio)
                        cur_pg.execute(
                            "SELECT COALESCE(SUM(actual_amount), 0) FROM eis.fact_sales WHERE period_id=%s",
                            (period_id,),
                        )
                        sales_amt = float(cur_pg.fetchone()[0] or 0)
                        cogs_amt = sales_amt * 0.60
                dio_days = round(total_inv / (cogs_amt / 30), 2) if cogs_amt > 0 else 0.0

                cur_pg.execute(
                    """INSERT INTO eis.fact_financial_ratio
                           (period_id, dio_inv_avg, dio_cogs, dio_days)
                       VALUES (%s, %s, %s, %s)
                       ON CONFLICT (period_id) DO UPDATE SET
                           dio_inv_avg = EXCLUDED.dio_inv_avg,
                           dio_cogs    = EXCLUDED.dio_cogs,
                           dio_days    = EXCLUDED.dio_days""",
                    (period_id, total_inv, cogs_amt, dio_days),
                )
                pg.commit()
                logger.info(f"[etl_inventory] Loaded inventory {total_inv:,.0f} into period_id={period_id}")
            else:
                logger.warning(f"[etl_inventory] No dim_period for {year}/{ora_month}")
        # ──────────────────────────────────────────────────────────

        _log_end(pg, job_id, "success", records)

    except Exception as e:
        logger.error(f"[etl_inventory] Failed: {e}")
        _log_end(pg, job_id, "failed", records, str(e))
        raise
    finally:
        pg.close()

    return {"status": "success", "records": records}


@celery_app.task(name="app.tasks.etl_tasks.etl_production")
def etl_production(year: int = None, month: int = None):
    """Extract production data from Oracle WIP and load into fact_production."""
    year = year or datetime.now().year
    pg = _get_pg()
    job_id = _log_start(pg, "etl_production", year, month)
    records = 0
    try:
        ora = get_oracle_connection()
        cur_ora = ora.cursor()

        if month:
            date_filter = "AND EXTRACT(YEAR FROM wdj.date_completed) = :year AND EXTRACT(MONTH FROM wdj.date_completed) = :month"
            date_params = {"year": year, "month": month}
        else:
            date_filter = "AND EXTRACT(YEAR FROM wdj.date_completed) = :year"
            date_params = {"year": year}

        cur_ora.execute(f"""
            SELECT
                TO_CHAR(wdj.date_completed, 'YYYY-MM') as period,
                SUM(wdj.quantity_completed) as actual_qty,
                SUM(wdj.start_quantity) as planned_qty
            FROM wip_discrete_jobs wdj
            WHERE wdj.status_type IN (4, 12)
              {date_filter}
            GROUP BY TO_CHAR(wdj.date_completed, 'YYYY-MM')
            ORDER BY period
        """, date_params)
        rows = cur_ora.fetchall()
        records = len(rows)
        ora.close()

        # ── LOAD ──────────────────────────────────────────────────
        cur_pg = pg.cursor()
        loaded = 0

        for period_str, actual_qty, planned_qty in rows:
            try:
                ora_year, ora_month = int(period_str[:4]), int(period_str[5:7])
            except (ValueError, IndexError):
                continue

            period_id = _get_period_id(cur_pg, ora_year, ora_month)
            if not period_id:
                logger.warning(f"[etl_production] No dim_period for {period_str}")
                continue

            act = float(actual_qty or 0)
            plan = float(planned_qty or 0)

            # Insert as 'Local' segment (primary segment); extend later with org mapping
            cur_pg.execute(
                """INSERT INTO eis.fact_production
                       (period_id, segment, bp_qty, actual_qty, batch_size, yield_qty)
                   VALUES (%s, 'Local', %s, %s, %s, %s)
                   ON CONFLICT (period_id, segment) DO UPDATE SET
                       bp_qty     = EXCLUDED.bp_qty,
                       actual_qty = EXCLUDED.actual_qty,
                       batch_size = EXCLUDED.batch_size,
                       yield_qty  = EXCLUDED.yield_qty""",
                (period_id, plan, act, plan, act),
            )
            loaded += 1

        pg.commit()
        logger.info(f"[etl_production] Loaded {loaded} rows into fact_production")
        # ──────────────────────────────────────────────────────────

        _log_end(pg, job_id, "success", records)

    except Exception as e:
        logger.error(f"[etl_production] Failed: {e}")
        _log_end(pg, job_id, "failed", records, str(e))
        raise
    finally:
        pg.close()

    return {"status": "success", "records": records}


@celery_app.task(name="app.tasks.etl_tasks.etl_employee")
def etl_employee(year: int = None, month: int = None):
    """Extract employee headcount from Oracle HR and load into fact_employee."""
    year = year or datetime.now().year
    pg = _get_pg()
    job_id = _log_start(pg, "etl_employee", year, month)
    records = 0
    try:
        ora = get_oracle_connection()
        cur_ora = ora.cursor()

        if month:
            eff_date = f"01-{datetime(year, month, 1).strftime('%b').upper()}-{year}"
            date_params = {"eff_date": eff_date}
            date_clause = "TO_DATE(:eff_date, 'DD-MON-YYYY')"
        else:
            date_params = {"year": year}
            date_clause = f"TO_DATE('01-JAN-' || :year, 'DD-MON-YYYY')"

        cur_ora.execute(f"""
            SELECT
                haou.name as department,
                COUNT(DISTINCT papf.person_id) as headcount
            FROM per_all_people_f papf
            JOIN per_all_assignments_f paaf ON papf.person_id = paaf.person_id
            JOIN hr_all_organization_units haou ON paaf.organization_id = haou.organization_id
            WHERE {date_clause} BETWEEN papf.effective_start_date AND papf.effective_end_date
              AND {date_clause} BETWEEN paaf.effective_start_date AND paaf.effective_end_date
              AND paaf.assignment_type = 'E'
              AND paaf.primary_flag = 'Y'
            GROUP BY haou.name
        """, date_params)
        rows = cur_ora.fetchall()
        records = len(rows)
        ora.close()

        # ── LOAD ──────────────────────────────────────────────────
        # Map Oracle HR department name → dept_group
        def _map_dept(dept_name):
            n = str(dept_name).upper()
            if any(k in n for k in ('SALES', 'MARKETING', 'MARKET')):
                return 'SM'
            if any(k in n for k in ('SUPPLY', 'DISTRIBUT', 'LOGISTIC', 'WAREHOUSE')):
                return 'SD'
            if any(k in n for k in ('PLANT DIRECT', 'PRODUCTION', 'QC', 'QUALITY CONTROL', 'MANUFACT')):
                return 'Plant Direct'
            if any(k in n for k in ('PLANT INDIRECT', 'ENGINEERING', 'MAINTENANCE', 'FACILITY')):
                return 'Plant Indirect'
            if any(k in n for k in ('PLANT',)):
                return 'Plant'
            return 'Admin'

        # Aggregate by dept_group
        dept_totals = defaultdict(int)
        for dept_name, headcount in rows:
            grp = _map_dept(dept_name)
            dept_totals[grp] += int(headcount or 0)

        ora_month = month or 1  # default to January if full-year run
        period_id = None
        cur_pg = pg.cursor()

        if month:
            period_id = _get_period_id(cur_pg, year, ora_month)
        else:
            # Full-year: use the most recent period that has data
            period_id = _get_period_id(cur_pg, year, 12) or _get_period_id(cur_pg, year, 1)

        loaded = 0
        if period_id:
            for dept_group, headcount in dept_totals.items():
                cur_pg.execute(
                    """INSERT INTO eis.fact_employee
                           (period_id, dept_group, headcount, plan_headcount, resigned_cumulative)
                       VALUES (%s, %s, %s, 0, 0)
                       ON CONFLICT (period_id, dept_group) DO UPDATE SET
                           headcount = EXCLUDED.headcount""",
                    (period_id, dept_group, headcount),
                )
                loaded += 1
            pg.commit()
            logger.info(f"[etl_employee] Loaded {loaded} rows into fact_employee")
        else:
            logger.warning(f"[etl_employee] No dim_period found for {year}/{ora_month}")
        # ──────────────────────────────────────────────────────────

        _log_end(pg, job_id, "success", records)

    except Exception as e:
        logger.error(f"[etl_employee] Failed: {e}")
        _log_end(pg, job_id, "failed", records, str(e))
        raise
    finally:
        pg.close()

    return {"status": "success", "records": records}


@celery_app.task(name="app.tasks.etl_tasks.etl_financial")
def etl_financial(year: int = None, month: int = None):
    """Extract financial P&L and cashflow from Oracle GL into fact_financial.

    Actual net profit  → Oracle GL actual_flag='A' (revenue − expenses)
    BP net profit      → eis.business_plan WHERE plan_type='Financial Target'
    Actual cashflow    → Oracle GL actual_flag='A', cash/bank accounts (segment3 10000-14999)
    BP cashflow        → eis.business_plan WHERE plan_type='Cashflow'
    """
    year = year or datetime.now().year
    pg = _get_pg()
    job_id = _log_start(pg, "etl_financial", year, month)
    records = 0
    try:
        ora = get_oracle_connection()
        cur_ora = ora.cursor()
        period_clause, period_params = _month_filter_gl(year, month)

        # ── 1. Actual P&L ─────────────────────────────────────────
        cur_ora.execute(f"""
            SELECT
                gb.period_name,
                gb.period_year,
                gb.period_num,
                SUM(CASE WHEN gcc.account_type = 'R'
                    THEN NVL(gb.period_net_cr, 0) - NVL(gb.period_net_dr, 0)
                    ELSE 0 END) as revenue,
                SUM(CASE WHEN gcc.account_type = 'E'
                    THEN NVL(gb.period_net_dr, 0) - NVL(gb.period_net_cr, 0)
                    ELSE 0 END) as expenses
            FROM gl_balances gb
            JOIN gl_code_combinations gcc ON gb.code_combination_id = gcc.code_combination_id
            WHERE gb.actual_flag = 'A'
              AND gb.currency_code = 'IDR'
              {period_clause}
            GROUP BY gb.period_name, gb.period_year, gb.period_num
            ORDER BY gb.period_year, gb.period_num
        """, period_params)
        pl_rows = cur_ora.fetchall()
        records += len(pl_rows)

        # ── 2. Actual cashflow (net movement of cash/bank accounts) ──
        # Segment3 10000-14999 = Cash & Bank accounts (adjust to your COA)
        cur_ora.execute(f"""
            SELECT
                gb.period_name,
                gb.period_year,
                gb.period_num,
                SUM(NVL(gb.period_net_dr, 0) - NVL(gb.period_net_cr, 0)) as cash_in,
                SUM(NVL(gb.period_net_cr, 0) - NVL(gb.period_net_dr, 0)) as cash_out
            FROM gl_balances gb
            JOIN gl_code_combinations gcc ON gb.code_combination_id = gcc.code_combination_id
            WHERE gb.actual_flag = 'A'
              AND gb.currency_code = 'IDR'
              AND gcc.segment3 BETWEEN '10000' AND '14999'
              {period_clause}
            GROUP BY gb.period_name, gb.period_year, gb.period_num
            ORDER BY gb.period_year, gb.period_num
        """, period_params)
        cf_rows = cur_ora.fetchall()
        records += len(cf_rows)
        ora.close()

        # ── 3. BP net profit from business_plan table (PostgreSQL) ──
        # plan_type='Financial Target', category='Net Profit'
        # month columns: jan feb mar apr may jun jul aug sep oct nov dec
        _MONTH_COLS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun',
                       'jul', 'aug', 'sep', 'oct', 'nov', '"dec"']
        cur_pg = pg.cursor()
        cur_pg.execute(
            """SELECT jan,feb,mar,apr,may,jun,jul,aug,sep,oct,nov,"dec"
               FROM eis.business_plan
               WHERE fiscal_year=%s
                 AND plan_type='Financial Target'
                 AND LOWER(category) LIKE '%%net profit%%'
               LIMIT 1""",
            (year,),
        )
        bp_profit_row = cur_pg.fetchone()

        # Fallback: sum all 'Financial Target' rows if no 'net profit' row
        if not bp_profit_row:
            cur_pg.execute(
                """SELECT jan,feb,mar,apr,may,jun,jul,aug,sep,oct,nov,"dec"
                   FROM eis.business_plan
                   WHERE fiscal_year=%s AND plan_type='Financial Target'
                   LIMIT 1""",
                (year,),
            )
            bp_profit_row = cur_pg.fetchone()

        # bp_profit_by_month[month_num] = bp_amount (1-indexed)
        bp_profit_by_month = {}
        if bp_profit_row:
            for i, val in enumerate(bp_profit_row):
                bp_profit_by_month[i + 1] = float(val or 0)

        # ── 4. BP cashflow from business_plan table ──────────────
        cur_pg.execute(
            """SELECT jan,feb,mar,apr,may,jun,jul,aug,sep,oct,nov,"dec"
               FROM eis.business_plan
               WHERE fiscal_year=%s AND plan_type='Cashflow'
               LIMIT 1""",
            (year,),
        )
        bp_cf_row = cur_pg.fetchone()
        bp_cf_by_month = {}
        if bp_cf_row:
            for i, val in enumerate(bp_cf_row):
                bp_cf_by_month[i + 1] = float(val or 0)

        # ── 5. Build cashflow lookup by (year, month) ────────────
        cf_map = {}  # (year, month) → (cash_in, cash_out)
        for period_name_ora, period_year, period_num, cash_in, cash_out in cf_rows:
            cf_map[(int(period_year), int(period_num))] = (
                float(cash_in or 0), float(cash_out or 0),
            )

        # ── 6. LOAD ───────────────────────────────────────────────
        loaded = 0
        cumulative_profit_actual = 0.0
        cumulative_profit_bp = 0.0
        cf_ending_actual = 0.0  # running ending balance

        for period_name_ora, period_year, period_num, revenue, expenses in pl_rows:
            ora_year = int(period_year)
            ora_month = int(period_num)

            # Only process matching month when filtering
            if month and ora_month != month:
                continue

            period_id = _get_period_id(cur_pg, ora_year, ora_month)
            if not period_id:
                logger.warning(f"[etl_financial] No dim_period for {ora_year}/{ora_month}")
                continue

            rev = float(revenue or 0)
            exp = float(expenses or 0)
            net_profit_actual = rev - exp
            cumulative_profit_actual += net_profit_actual

            net_profit_bp = bp_profit_by_month.get(ora_month, 0.0)
            cumulative_profit_bp += net_profit_bp

            cash_in, cash_out = cf_map.get((ora_year, ora_month), (0.0, 0.0))
            cf_ending_actual += (cash_in - cash_out)
            cf_ending_bp = bp_cf_by_month.get(ora_month, 0.0)

            cur_pg.execute(
                """INSERT INTO eis.fact_financial
                       (period_id,
                        net_profit_actual, net_profit_actual_cumulative,
                        net_profit_bp, net_profit_bp_cumulative,
                        cf_cash_in_actual, cf_cash_out_actual,
                        cf_ending_balance_actual, cf_ending_balance_bp)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (period_id) DO UPDATE SET
                       net_profit_actual            = EXCLUDED.net_profit_actual,
                       net_profit_actual_cumulative = EXCLUDED.net_profit_actual_cumulative,
                       net_profit_bp                = EXCLUDED.net_profit_bp,
                       net_profit_bp_cumulative     = EXCLUDED.net_profit_bp_cumulative,
                       cf_cash_in_actual            = EXCLUDED.cf_cash_in_actual,
                       cf_cash_out_actual           = EXCLUDED.cf_cash_out_actual,
                       cf_ending_balance_actual     = EXCLUDED.cf_ending_balance_actual,
                       cf_ending_balance_bp         = EXCLUDED.cf_ending_balance_bp""",
                (period_id,
                 net_profit_actual, cumulative_profit_actual,
                 net_profit_bp, cumulative_profit_bp,
                 cash_in, cash_out,
                 cf_ending_actual, cf_ending_bp),
            )
            loaded += 1

        pg.commit()
        logger.info(f"[etl_financial] Loaded {loaded} rows into fact_financial")
        # ──────────────────────────────────────────────────────────

        _log_end(pg, job_id, "success", records)

    except Exception as e:
        logger.error(f"[etl_financial] Failed: {e}")
        _log_end(pg, job_id, "failed", records, str(e))
        raise
    finally:
        pg.close()

    return {"status": "success", "records": records}


@celery_app.task(name="app.tasks.etl_tasks.etl_budget")
def etl_budget(year: int = None, month: int = None):
    """Extract departmental OPEX budget vs actual from Oracle GL into fact_budget."""
    year = year or datetime.now().year
    pg = _get_pg()
    job_id = _log_start(pg, "etl_budget", year, month)
    records = 0
    try:
        ora = get_oracle_connection()
        cur_ora = ora.cursor()

        period_clause, period_params = _month_filter_gl(year, month)

        # Extract expense accounts (account_type='E') grouped by period + cost center (segment2)
        # actual_flag: 'A' = actual spending, 'B' = budget (business plan)
        cur_ora.execute(f"""
            SELECT
                gb.period_name,
                gb.period_year,
                gb.period_num,
                gcc.segment2 as cost_center,
                gb.actual_flag,
                SUM(NVL(gb.period_net_dr, 0) - NVL(gb.period_net_cr, 0)) as amount
            FROM gl_balances gb
            JOIN gl_code_combinations gcc ON gb.code_combination_id = gcc.code_combination_id
            WHERE gb.actual_flag IN ('A', 'B')
              AND gcc.account_type = 'E'
              AND gb.currency_code = 'IDR'
              {period_clause}
            GROUP BY gb.period_name, gb.period_year, gb.period_num,
                     gcc.segment2, gb.actual_flag
            ORDER BY gb.period_year, gb.period_num, gcc.segment2
        """, period_params)

        rows = cur_ora.fetchall()
        records = len(rows)
        logger.info(f"[etl_budget] Extracted {records} rows from Oracle GL (year={year}, month={month})")
        ora.close()

        # ── LOAD ──────────────────────────────────────────────────
        # Map Oracle cost center segment → dept_group
        def _map_cost_center(segment):
            """Map GL segment2 (cost center code) to dept_group."""
            s = str(segment or '').strip().upper()
            # Adjust these ranges to match your actual Oracle COA cost center codes
            if s.startswith('1'):      # e.g. 1xxx = Sales & Marketing
                return 'SM'
            if s.startswith('2'):      # e.g. 2xxx = Supply & Distribution
                return 'SD'
            if s.startswith('3'):      # e.g. 3xxx = Plant Direct
                return 'Plant Direct'
            if s.startswith('4'):      # e.g. 4xxx = Plant Indirect
                return 'Plant Indirect'
            return 'Admin'

        # Aggregate per (period, dept_group, actual_flag)
        agg = defaultdict(lambda: {'A': 0.0, 'B': 0.0})
        for period_name_ora, period_year, period_num, cost_center, actual_flag, amount in rows:
            dept_group = _map_cost_center(cost_center)
            key = (int(period_year), int(period_num), dept_group)
            if actual_flag in ('A', 'B'):
                agg[key][actual_flag] += float(amount or 0)

        cur_pg = pg.cursor()
        loaded = 0
        for (ora_year, ora_month, dept_group), amounts in agg.items():
            period_id = _get_period_id(cur_pg, ora_year, ora_month)
            if not period_id:
                logger.warning(f"[etl_budget] No dim_period for {ora_year}/{ora_month}")
                continue

            cur_pg.execute(
                """INSERT INTO eis.fact_budget
                       (period_id, dept_group, bp_amount, actual_amount)
                   VALUES (%s, %s, %s, %s)
                   ON CONFLICT (period_id, dept_group) DO UPDATE SET
                       bp_amount     = EXCLUDED.bp_amount,
                       actual_amount = EXCLUDED.actual_amount""",
                (period_id, dept_group, amounts['B'], amounts['A']),
            )
            loaded += 1

        pg.commit()
        logger.info(f"[etl_budget] Loaded {loaded} rows into fact_budget")
        # ──────────────────────────────────────────────────────────

        _log_end(pg, job_id, "success", records)

    except Exception as e:
        logger.error(f"[etl_budget] Failed: {e}")
        _log_end(pg, job_id, "failed", records, str(e))
        raise
    finally:
        pg.close()

    return {"status": "success", "records": records}

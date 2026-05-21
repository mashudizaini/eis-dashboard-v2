-- ============================================================
-- EIS Dashboard — PostgreSQL Schema
-- PT CKD OTTO Pharmaceuticals
-- ============================================================

CREATE SCHEMA IF NOT EXISTS eis;
SET search_path TO eis, public;

-- ============================================================
-- 1. DIMENSION TABLES
-- ============================================================

CREATE TABLE eis.dim_period (
    id SERIAL PRIMARY KEY,
    fiscal_year INT NOT NULL,
    period_num INT NOT NULL CHECK (period_num BETWEEN 1 AND 12),
    period_name VARCHAR(20) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    working_days INT DEFAULT 22,
    is_closed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(fiscal_year, period_num)
);

CREATE TABLE eis.dim_product (
    id SERIAL PRIMARY KEY,
    product_code VARCHAR(20) NOT NULL UNIQUE,
    product_name VARCHAR(150) NOT NULL,
    business_type VARCHAR(20) NOT NULL CHECK (business_type IN ('Local', 'CMO', 'Export')),
    market VARCHAR(50) NOT NULL,
    gl_segment_code VARCHAR(30),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE eis.dim_department (
    id SERIAL PRIMARY KEY,
    dept_code VARCHAR(20) NOT NULL UNIQUE,
    dept_name VARCHAR(100) NOT NULL,
    dept_group VARCHAR(30) NOT NULL CHECK (dept_group IN ('SM', 'SD', 'Plant', 'Plant Direct', 'Plant Indirect', 'Admin')),
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE eis.dim_area (
    id SERIAL PRIMARY KEY,
    area_code VARCHAR(20) NOT NULL UNIQUE,
    area_name VARCHAR(100) NOT NULL,
    region VARCHAR(20) NOT NULL CHECK (region IN ('West', 'East')),
    sort_order INT DEFAULT 0
);

CREATE TABLE eis.dim_pipeline_product (
    id SERIAL PRIMARY KEY,
    product_name VARCHAR(150) NOT NULL,
    supplier VARCHAR(200) NOT NULL,
    country_origin VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE eis.dim_dev_stage (
    id SERIAL PRIMARY KEY,
    stage_code VARCHAR(10) NOT NULL UNIQUE,
    stage_name VARCHAR(50) NOT NULL,
    stage_order INT NOT NULL CHECK (stage_order BETWEEN 1 AND 5),
    color_hex VARCHAR(7) DEFAULT '#888888'
);

-- ============================================================
-- 2. FACT TABLES — Performance
-- ============================================================

CREATE TABLE eis.fact_sales (
    id SERIAL PRIMARY KEY,
    period_id INT NOT NULL REFERENCES eis.dim_period(id),
    product_id INT REFERENCES eis.dim_product(id),
    business_type VARCHAR(20) NOT NULL,
    market VARCHAR(50),
    bp_amount NUMERIC(18,2) DEFAULT 0,
    actual_amount NUMERIC(18,2) DEFAULT 0,
    prior_year_bp NUMERIC(18,2) DEFAULT 0,
    prior_year_actual NUMERIC(18,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(period_id, product_id, business_type, market)
);

CREATE TABLE eis.fact_sales_daily (
    id SERIAL PRIMARY KEY,
    period_id INT NOT NULL REFERENCES eis.dim_period(id),
    business_type VARCHAR(20) NOT NULL,
    day_num INT NOT NULL CHECK (day_num BETWEEN 1 AND 31),
    daily_amount NUMERIC(18,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(period_id, business_type, day_num)
);

CREATE TABLE eis.fact_cogs (
    id SERIAL PRIMARY KEY,
    period_id INT NOT NULL REFERENCES eis.dim_period(id),
    product_id INT REFERENCES eis.dim_product(id),
    sales_amount NUMERIC(18,2) DEFAULT 0,
    cogs_total NUMERIC(18,2) DEFAULT 0,
    cogs_material NUMERIC(18,2) DEFAULT 0,
    cogs_labour NUMERIC(18,2) DEFAULT 0,
    cogs_depreciation NUMERIC(18,2) DEFAULT 0,
    cogs_foh NUMERIC(18,2) DEFAULT 0,
    opex_amount NUMERIC(18,2) DEFAULT 0,
    ebit_amount NUMERIC(18,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(period_id, product_id)
);

CREATE TABLE eis.fact_area_sales (
    id SERIAL PRIMARY KEY,
    period_id INT NOT NULL REFERENCES eis.dim_period(id),
    area_id INT NOT NULL REFERENCES eis.dim_area(id),
    cumulative_amount NUMERIC(18,2) DEFAULT 0,
    monthly_amount NUMERIC(18,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(period_id, area_id)
);

CREATE TABLE eis.fact_marketing (
    id SERIAL PRIMARY KEY,
    period_id INT NOT NULL REFERENCES eis.dim_period(id),
    event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('Seminar', 'RTD')),
    event_name VARCHAR(200) NOT NULL,
    plan_amount NUMERIC(18,2) DEFAULT 0,
    actual_amount NUMERIC(18,2) DEFAULT 0,
    plan_qty INT DEFAULT 0,
    actual_qty INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. FACT TABLES — Production
-- ============================================================

CREATE TABLE eis.fact_production (
    id SERIAL PRIMARY KEY,
    period_id INT NOT NULL REFERENCES eis.dim_period(id),
    segment VARCHAR(20) NOT NULL CHECK (segment IN ('Local', 'CMO', 'Export')),
    bp_qty NUMERIC(18,2) DEFAULT 0,
    actual_qty NUMERIC(18,2) DEFAULT 0,
    batch_size NUMERIC(18,2) DEFAULT 0,
    yield_qty NUMERIC(18,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(period_id, segment)
);

CREATE TABLE eis.fact_overtime (
    id SERIAL PRIMARY KEY,
    period_id INT NOT NULL REFERENCES eis.dim_period(id),
    overtime_hours NUMERIC(10,2) DEFAULT 0,
    working_hours NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(period_id)
);

CREATE TABLE eis.fact_product_release (
    id SERIAL PRIMARY KEY,
    period_id INT NOT NULL REFERENCES eis.dim_period(id),
    target_days INT DEFAULT 16,
    actual_days INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(period_id)
);

-- ============================================================
-- 4. FACT TABLES — Business Expansion
-- ============================================================

CREATE TABLE eis.fact_pipeline_progress (
    id SERIAL PRIMARY KEY,
    pipeline_product_id INT NOT NULL REFERENCES eis.dim_pipeline_product(id),
    period_id INT NOT NULL REFERENCES eis.dim_period(id),
    stage_id INT NOT NULL REFERENCES eis.dim_dev_stage(id),
    status_text VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(pipeline_product_id, period_id)
);

-- ============================================================
-- 5. FACT TABLES — Administration
-- ============================================================

CREATE TABLE eis.fact_employee (
    id SERIAL PRIMARY KEY,
    period_id INT NOT NULL REFERENCES eis.dim_period(id),
    dept_group VARCHAR(30) NOT NULL,
    headcount INT DEFAULT 0,
    plan_headcount INT DEFAULT 0,
    resigned_cumulative INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(period_id, dept_group)
);

CREATE TABLE eis.fact_financial (
    id SERIAL PRIMARY KEY,
    period_id INT NOT NULL REFERENCES eis.dim_period(id),
    -- Net Profit
    net_profit_bp NUMERIC(18,2) DEFAULT 0,
    net_profit_actual NUMERIC(18,2) DEFAULT 0,
    net_profit_bp_cumulative NUMERIC(18,2) DEFAULT 0,
    net_profit_actual_cumulative NUMERIC(18,2) DEFAULT 0,
    -- Cashflow
    cf_beginning_balance_bp NUMERIC(18,2) DEFAULT 0,
    cf_beginning_balance_actual NUMERIC(18,2) DEFAULT 0,
    cf_cash_in_bp NUMERIC(18,2) DEFAULT 0,
    cf_cash_in_actual NUMERIC(18,2) DEFAULT 0,
    cf_cash_out_bp NUMERIC(18,2) DEFAULT 0,
    cf_cash_out_actual NUMERIC(18,2) DEFAULT 0,
    cf_ending_balance_bp NUMERIC(18,2) DEFAULT 0,
    cf_ending_balance_actual NUMERIC(18,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(period_id)
);

CREATE TABLE eis.fact_financial_ratio (
    id SERIAL PRIMARY KEY,
    period_id INT NOT NULL REFERENCES eis.dim_period(id),
    -- DSO
    dso_sales NUMERIC(18,2) DEFAULT 0,
    dso_ar_avg NUMERIC(18,2) DEFAULT 0,
    dso_days NUMERIC(10,2) DEFAULT 0,
    -- DPO
    dpo_cogs NUMERIC(18,2) DEFAULT 0,
    dpo_ap_avg NUMERIC(18,2) DEFAULT 0,
    dpo_days NUMERIC(10,2) DEFAULT 0,
    -- DIO
    dio_cogs NUMERIC(18,2) DEFAULT 0,
    dio_inv_avg NUMERIC(18,2) DEFAULT 0,
    dio_days NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(period_id)
);

CREATE TABLE eis.fact_budget (
    id SERIAL PRIMARY KEY,
    period_id INT NOT NULL REFERENCES eis.dim_period(id),
    dept_group VARCHAR(30) NOT NULL,
    bp_amount NUMERIC(18,2) DEFAULT 0,
    actual_amount NUMERIC(18,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(period_id, dept_group)
);

CREATE TABLE eis.fact_it_performance (
    id SERIAL PRIMARY KEY,
    period_id INT NOT NULL REFERENCES eis.dim_period(id),
    requests INT DEFAULT 0,
    solved INT DEFAULT 0,
    pending INT DEFAULT 0,
    performance_score NUMERIC(5,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(period_id)
);

-- ============================================================
-- 6. BUSINESS PLAN ENTRY TABLE
-- ============================================================

CREATE TABLE eis.business_plan (
    id SERIAL PRIMARY KEY,
    fiscal_year INT NOT NULL,
    plan_type VARCHAR(30) NOT NULL,
    category VARCHAR(100),
    sub_category VARCHAR(100),
    jan NUMERIC(18,2) DEFAULT 0,
    feb NUMERIC(18,2) DEFAULT 0,
    mar NUMERIC(18,2) DEFAULT 0,
    apr NUMERIC(18,2) DEFAULT 0,
    may NUMERIC(18,2) DEFAULT 0,
    jun NUMERIC(18,2) DEFAULT 0,
    jul NUMERIC(18,2) DEFAULT 0,
    aug NUMERIC(18,2) DEFAULT 0,
    sep NUMERIC(18,2) DEFAULT 0,
    oct NUMERIC(18,2) DEFAULT 0,
    nov NUMERIC(18,2) DEFAULT 0,
    "dec" NUMERIC(18,2) DEFAULT 0,
    total NUMERIC(18,2) GENERATED ALWAYS AS (jan+feb+mar+apr+may+jun+jul+aug+sep+oct+nov+"dec") STORED,
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(fiscal_year, plan_type, category, sub_category)
);

-- ============================================================
-- 7. ETL JOB LOG
-- ============================================================

CREATE TABLE eis.etl_job_log (
    id SERIAL PRIMARY KEY,
    job_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('running', 'success', 'failed', 'stopped')),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    records_processed INT DEFAULT 0,
    run_params JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. SEED DATA — Dimension Tables
-- ============================================================

-- Periods 2024-2026
INSERT INTO eis.dim_period (fiscal_year, period_num, period_name, start_date, end_date) VALUES
(2024, 1, 'January', '2024-01-01', '2024-01-31'),
(2024, 2, 'February', '2024-02-01', '2024-02-29'),
(2024, 3, 'March', '2024-03-01', '2024-03-31'),
(2024, 4, 'April', '2024-04-01', '2024-04-30'),
(2024, 5, 'May', '2024-05-01', '2024-05-31'),
(2024, 6, 'June', '2024-06-01', '2024-06-30'),
(2024, 7, 'July', '2024-07-01', '2024-07-31'),
(2024, 8, 'August', '2024-08-01', '2024-08-31'),
(2024, 9, 'September', '2024-09-01', '2024-09-30'),
(2024, 10, 'October', '2024-10-01', '2024-10-31'),
(2024, 11, 'November', '2024-11-01', '2024-11-30'),
(2024, 12, 'December', '2024-12-01', '2024-12-31'),
(2025, 1, 'January', '2025-01-01', '2025-01-31'),
(2025, 2, 'February', '2025-02-01', '2025-02-28'),
(2025, 3, 'March', '2025-03-01', '2025-03-31'),
(2025, 4, 'April', '2025-04-01', '2025-04-30'),
(2025, 5, 'May', '2025-05-01', '2025-05-31'),
(2025, 6, 'June', '2025-06-01', '2025-06-30'),
(2025, 7, 'July', '2025-07-01', '2025-07-31'),
(2025, 8, 'August', '2025-08-01', '2025-08-31'),
(2025, 9, 'September', '2025-09-01', '2025-09-30'),
(2025, 10, 'October', '2025-10-01', '2025-10-31'),
(2025, 11, 'November', '2025-11-01', '2025-11-30'),
(2025, 12, 'December', '2025-12-01', '2025-12-31'),
(2026, 1, 'January', '2026-01-01', '2026-01-31'),
(2026, 2, 'February', '2026-02-01', '2026-02-28'),
(2026, 3, 'March', '2026-03-01', '2026-03-31'),
(2026, 4, 'April', '2026-04-01', '2026-04-30'),
(2026, 5, 'May', '2026-05-01', '2026-05-31'),
(2026, 6, 'June', '2026-06-01', '2026-06-30'),
(2026, 7, 'July', '2026-07-01', '2026-07-31'),
(2026, 8, 'August', '2026-08-01', '2026-08-31'),
(2026, 9, 'September', '2026-09-01', '2026-09-30'),
(2026, 10, 'October', '2026-10-01', '2026-10-31'),
(2026, 11, 'November', '2026-11-01', '2026-11-30'),
(2026, 12, 'December', '2026-12-01', '2026-12-31')
ON CONFLICT DO NOTHING;

-- Products
INSERT INTO eis.dim_product (product_code, product_name, business_type, market) VALUES
('DOC01', 'Docetaxel 20 mg', 'Local', 'Public'),
('DOC02', 'Docetaxel 80 mg', 'Local', 'Public'),
('PAC01', 'Paclitaxel 30 mg', 'Local', 'Public'),
('PAC02', 'Paclitaxel 100 mg', 'Local', 'Public'),
('PAC03', 'Paclitaxel 300 mg', 'Local', 'Public'),
('DOX01', 'Doxorubicin 10 mg', 'Local', 'Public'),
('DOX02', 'Doxorubicin 50 mg', 'Local', 'Public'),
('CAR01', 'Carboplatin 150 mg', 'Local', 'Public'),
('CAR02', 'Carboplatin 450 mg', 'Local', 'Public'),
('OXA01', 'Oxaliplatin 50 mg', 'Local', 'Public'),
('OXA02', 'Oxaliplatin 100 mg', 'Local', 'Public'),
('EPI01', 'Epirubicin 10 mg', 'Local', 'Public'),
('EPI02', 'Epirubicin 50 mg', 'Local', 'Public'),
('GEM01', 'Gemcitabine 200 mg', 'Local', 'Public'),
('GEM02', 'Gemcitabine 1000 mg', 'Local', 'Public'),
('MET01', 'Methotrexate 50 mg', 'Local', 'Public'),
('BOR01', 'Bortezomib 3.5 mg', 'Local', 'Public'),
('PEM01', 'Pemetrexed 100 mg', 'Local', 'Public'),
('PEM02', 'Pemetrexed 500 mg', 'Local', 'Public'),
('MYR01', 'Mycophenolate mofetil 500 mg', 'Local', 'Public'),
('CAL01', 'Bicalutamide 50 mg', 'Local', 'Public'),
('CAL02', 'Bicalutamide 150 mg', 'Local', 'Public'),
('BEV01', 'Bevacizumab 100 mg', 'Local', 'Public'),
('NES01', 'Darbepoetin alfa 20 mcg', 'CMO', 'Service Agreement'),
('NES02', 'Darbepoetin alfa 30 mcg', 'CMO', 'Service Agreement'),
('NES03', 'Darbepoetin alfa 40 mcg', 'CMO', 'Service Agreement'),
('RAN01', 'Ranibizumab 10 mg', 'Export', 'Algeria')
ON CONFLICT DO NOTHING;

-- Departments
INSERT INTO eis.dim_department (dept_code, dept_name, dept_group, sort_order) VALUES
('SM', 'Sales & Marketing', 'SM', 1),
('SD', 'Supply & Distribution', 'SD', 2),
('PLANT_D', 'Plant Direct', 'Plant Direct', 3),
('PLANT_I', 'Plant Indirect', 'Plant Indirect', 4),
('ADMIN', 'Administration', 'Admin', 5)
ON CONFLICT DO NOTHING;

-- Areas
INSERT INTO eis.dim_area (area_code, area_name, region, sort_order) VALUES
('JAVA', 'Java', 'West', 1),
('BALI', 'Bali', 'East', 2),
('SUMATERA', 'Sumatera', 'West', 3),
('KALIMANTAN', 'Kalimantan', 'East', 4),
('SULAWESI', 'Sulawesi', 'East', 5)
ON CONFLICT DO NOTHING;

-- Development Stages
INSERT INTO eis.dim_dev_stage (stage_code, stage_name, stage_order, color_hex) VALUES
('MA', 'Market Analysis', 1, '#888780'),
('RS', 'Resource Supplier', 2, '#378ADD'),
('CA', 'Contract Agreement', 3, '#EF9F27'),
('REG', 'Registration', 4, '#1D9E75'),
('LP', 'Launch Preparation', 5, '#085041')
ON CONFLICT DO NOTHING;

-- Pipeline Products
INSERT INTO eis.dim_pipeline_product (product_name, supplier, country_origin) VALUES
('Bevacizumab', 'Kexing Biopharm', 'China'),
('Botulinum toxin', 'CKD Bio', 'South Korea'),
('Probiotic', 'CKD Healthcare', 'South Korea'),
('Fulvestrant', 'Dr. Reddy''s', 'India'),
('Nano-paclitaxel', 'Dr. Reddy''s', 'India'),
('Trastuzumab', 'Samsung Bioepis', 'South Korea'),
('Goserelin', 'Biozenta', 'India'),
('Etoposide', 'In-house Development', 'Indonesia'),
('Ifosfamide', 'In-house Development', 'Indonesia'),
('Eribulin', 'In-house Development', 'Indonesia'),
('Imatinib', 'Etana', 'Indonesia'),
('Nilotinib', 'Synthon', 'Netherlands'),
('Lenvatinib', 'Synthon', 'Netherlands')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 9. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_fact_sales_period ON eis.fact_sales(period_id);
CREATE INDEX IF NOT EXISTS idx_fact_sales_biz ON eis.fact_sales(business_type);
CREATE INDEX IF NOT EXISTS idx_fact_cogs_period ON eis.fact_cogs(period_id);
CREATE INDEX IF NOT EXISTS idx_fact_production_period ON eis.fact_production(period_id);
CREATE INDEX IF NOT EXISTS idx_fact_financial_period ON eis.fact_financial(period_id);
CREATE INDEX IF NOT EXISTS idx_fact_budget_period ON eis.fact_budget(period_id);
CREATE INDEX IF NOT EXISTS idx_fact_employee_period ON eis.fact_employee(period_id);
CREATE INDEX IF NOT EXISTS idx_etl_job_log_name ON eis.etl_job_log(job_name);
CREATE INDEX IF NOT EXISTS idx_business_plan_year ON eis.business_plan(fiscal_year);

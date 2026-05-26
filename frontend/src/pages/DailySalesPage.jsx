import { useEffect, useRef, useState } from 'react';
import { Upload, FileSpreadsheet, TrendingUp, Target, CheckCircle2, X } from 'lucide-react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import TopBar from '../components/layout/TopBar';
import Loading from '../components/common/Loading';
import { eisApi } from '../utils/api';

const MONTHS = [
  { key: 'january',   label: 'Januari' },
  { key: 'february',  label: 'Februari' },
  { key: 'march',     label: 'Maret' },
  { key: 'april',     label: 'April' },
  { key: 'may',       label: 'Mei' },
  { key: 'june',      label: 'Juni' },
  { key: 'july',      label: 'Juli' },
  { key: 'august',    label: 'Agustus' },
  { key: 'september', label: 'September' },
  { key: 'october',   label: 'Oktober' },
  { key: 'november',  label: 'November' },
  { key: 'december',  label: 'Desember' },
];

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const fmt = (v, digits = 0) =>
  v == null ? '-' : Number(v).toLocaleString('id-ID', { maximumFractionDigits: digits, minimumFractionDigits: digits });

export default function DailySalesPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('december');
  const fileRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await eisApi.getDailySales();
      setData(res.data.data);
    } catch (err) {
      console.error('Failed to load daily sales:', err);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await eisApi.uploadDailySales(fd);
      setData(res.data.data);
      setUploadMsg({ type: 'ok', text: `Data berhasil diupdate dari "${file.name}"` });
    } catch (err) {
      setUploadMsg({ type: 'err', text: 'Gagal upload: ' + (err.response?.data?.detail || err.message) });
    }
    setUploading(false);
    e.target.value = '';
  };

  if (loading) return <Loading />;

  const rows = data?.rows || [];
  const monthTargets = data?.month_targets || {};
  const achPct = data?.achievement_pct || 0;
  const achievementColor = achPct >= 100 ? 'text-emerald-600' : achPct >= 80 ? 'text-amber-600' : 'text-red-500';

  const chartData = rows
    .filter((r) => r[selectedMonth]?.acc != null)
    .map((r) => ({
      wd: r.wd,
      acc: r[selectedMonth].acc,
      sales: r[selectedMonth].sales,
    }));

  const monthTarget = monthTargets[selectedMonth] || 0;

  return (
    <div className="max-w-full">
      <TopBar title="Daily Sales Performance" onRefresh={load} />

      {/* ── Section 1: Upload File ──────────────────────────────── */}
      <div className="chart-container mb-6">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <h3 className="font-display font-semibold text-gray-800 mb-1 flex items-center gap-2">
              <FileSpreadsheet size={16} className="text-pharma-600" />
              Upload Data Excel
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Upload file Excel dengan worksheet <strong>Chart</strong> (kolom: WD, Target, Acc, Sales per bulan)
              dan <strong>Daily Sales Performance</strong> untuk summary.
              Format referensi: <em>EIS_Sales_Daily.xlsx</em>
            </p>
            {uploadMsg && (
              <div className={`mt-3 flex items-start gap-2 text-xs rounded-lg px-3 py-2 ${uploadMsg.type === 'err' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
                <span className="flex-1">{uploadMsg.text}</span>
                <button onClick={() => setUploadMsg('')}><X size={12} /></button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2.5 bg-pharma-700 hover:bg-pharma-800 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
            >
              {uploading
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Upload size={15} />}
              {uploading ? 'Mengupload...' : 'Pilih File (.xlsx)'}
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload} />
          </div>
        </div>
      </div>

      {/* ── Section 2: Daily Sales Performance ─────────────────── */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 px-1">
          Daily Sales Performance — {data?.year || ''} ({data?.month || ''})
        </h2>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="kpi-card flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-pharma-100 flex items-center justify-center shrink-0">
              <Target size={20} className="text-pharma-700" />
            </div>
            <div>
              <div className="text-xs text-gray-500 font-medium">Business Plan</div>
              <div className="font-display text-xl font-bold text-gray-900">{fmt(data?.business_plan, 2)} M</div>
              <div className="text-[11px] text-gray-400">IDR · As of {data?.as_of || '-'}</div>
            </div>
          </div>

          <div className="kpi-card flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
              <TrendingUp size={20} className="text-amber-700" />
            </div>
            <div>
              <div className="text-xs text-gray-500 font-medium">Expectation Closing</div>
              <div className="font-display text-xl font-bold text-gray-900">{fmt(data?.expectation_closing, 2)} M</div>
              <div className="text-[11px] text-gray-400">IDR (in Million)</div>
            </div>
          </div>

          <div className="kpi-card flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
              <CheckCircle2 size={20} className="text-emerald-700" />
            </div>
            <div>
              <div className="text-xs text-gray-500 font-medium">Achievement</div>
              <div className={`font-display text-xl font-bold ${achievementColor}`}>{fmt(achPct, 2)}%</div>
              <div className="text-[11px] text-gray-400">vs Business Plan</div>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="chart-container mb-6">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <h3 className="font-display font-semibold text-gray-800">
              Accumulated Sales per Working Day
            </h3>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-pharma-400"
            >
              {MONTHS.map((m) => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData} margin={{ right: 16, left: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="wd"
                tick={{ fontSize: 11 }}
                label={{ value: 'Working Day', position: 'insideBottomRight', offset: -4, fontSize: 10 }}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `${(v / 1000).toFixed(1)}K`}
                width={52}
              />
              <Tooltip
                formatter={(v, name) => [`${fmt(v, 2)} M IDR`, name]}
                labelFormatter={(l) => `Working Day ${l}`}
                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {monthTarget > 0 && (
                <ReferenceLine
                  y={monthTarget}
                  stroke="#1a5a73"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  label={{
                    value: `BP ${fmt(monthTarget, 0)}M`,
                    fill: '#1a5a73',
                    fontSize: 10,
                    position: 'insideTopRight',
                  }}
                />
              )}
              {/* Daily Sales → Bar (abu-abu) */}
              <Bar
                dataKey="sales"
                fill="#9ca3af"
                name="Sales"
                maxBarSize={14}
                radius={[2, 2, 0, 0]}
              />
              {/* Accumulated → Line (oranye) */}
              <Line
                type="monotone"
                dataKey="acc"
                stroke="#e07b39"
                strokeWidth={2.5}
                dot={{ r: 2.5, fill: '#e07b39', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                name="Acc Dec"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Table */}
        <div className="chart-container">
          <h3 className="font-display font-semibold text-gray-800 mb-1">
            Detail Penjualan Harian per Working Day
          </h3>
          <p className="text-xs text-gray-400 mb-4">in Million IDR · Acc = Accumulated, Sales = Daily</p>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="text-xs border-collapse" style={{ minWidth: '1100px', width: '100%' }}>
              <thead>
                <tr className="bg-pharma-950 text-white">
                  <th className="px-3 py-2.5 text-center font-semibold sticky left-0 bg-pharma-950 z-10 w-10 border-r border-pharma-700">WD</th>
                  {MONTHS_SHORT.map((m, idx) => (
                    <th key={m} colSpan={2} className="py-2.5 text-center font-semibold border-l border-pharma-700">
                      <div>{m}</div>
                      <div className="text-[10px] font-normal text-pharma-300">
                        {fmt(monthTargets[MONTHS[idx].key], 0)}M
                      </div>
                    </th>
                  ))}
                </tr>
                <tr className="bg-pharma-900 text-pharma-200 text-[10px]">
                  <th className="px-3 py-1.5 sticky left-0 bg-pharma-900 z-10 border-r border-pharma-700"></th>
                  {MONTHS_SHORT.map((m) => (
                    <>
                      <th key={`${m}-acc`} className="px-1.5 py-1.5 text-center border-l border-pharma-700 font-medium">Acc</th>
                      <th key={`${m}-s`} className="px-1.5 py-1.5 text-center font-medium text-pharma-400">Sales</th>
                    </>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr
                    key={row.wd}
                    className={`border-b border-gray-100 hover:bg-pharma-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                  >
                    <td className="px-3 py-1.5 font-mono font-bold text-pharma-800 text-center sticky left-0 bg-inherit z-10 border-r border-gray-200">
                      {row.wd}
                    </td>
                    {MONTHS.map((m) => {
                      const cell = row[m.key] || {};
                      const overTarget = cell.acc != null && monthTargets[m.key] && cell.acc >= monthTargets[m.key];
                      return (
                        <>
                          <td
                            key={`${row.wd}-${m.key}-acc`}
                            className={`px-1.5 py-1.5 text-right font-mono border-l border-gray-100 ${cell.acc == null ? 'text-gray-200' : overTarget ? 'text-emerald-600 font-semibold' : 'text-gray-700'}`}
                          >
                            {fmt(cell.acc, 0)}
                          </td>
                          <td
                            key={`${row.wd}-${m.key}-sales`}
                            className={`px-1.5 py-1.5 text-right font-mono ${cell.sales == null ? 'text-gray-200' : cell.sales < 0 ? 'text-red-400' : 'text-gray-500'}`}
                          >
                            {fmt(cell.sales, 0)}
                          </td>
                        </>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

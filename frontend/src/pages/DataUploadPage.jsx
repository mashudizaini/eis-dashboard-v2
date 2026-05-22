import { useEffect, useRef, useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, X, BarChart2, RefreshCw, Package } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine, LabelList,
} from 'recharts';
import TopBar from '../components/layout/TopBar';
import Loading from '../components/common/Loading';
import { eisApi } from '../utils/api';
import useDashboardStore from '../stores/dashboardStore';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);
const PERIODS = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i] }));

const fmt = (v, d = 1) => v == null ? '—' : Number(v).toLocaleString('id-ID', { maximumFractionDigits: d, minimumFractionDigits: d });
const fmtM = (v) => v == null ? '—' : `${(Number(v) / 1_000_000).toFixed(2)} M`;

export default function DataUploadPage() {
  const { year } = useDashboardStore();
  const [selectedYear, setSelectedYear]     = useState(year || CURRENT_YEAR);
  const [selectedPeriod, setSelectedPeriod] = useState(12);

  // Overtime state
  const [overtime, setOvertime]       = useState([]);
  const [otLoading, setOtLoading]     = useState(true);
  const [otUploading, setOtUploading] = useState(false);
  const [otMsg, setOtMsg]             = useState(null);
  const otFileRef = useRef(null);

  // COGS state
  const [cogs, setCogs]               = useState([]);
  const [cogsLoading, setCogsLoading] = useState(true);
  const [cogsUploading, setCogsUploading] = useState(false);
  const [cogsMsg, setCogsMsg]         = useState(null);
  const cogsFileRef = useRef(null);

  const loadOvertime = async () => {
    setOtLoading(true);
    try {
      const res = await eisApi.getOvertimeData(selectedYear);
      setOvertime(res.data.data || []);
    } catch (err) { console.error(err); }
    setOtLoading(false);
  };

  const loadCogs = async () => {
    setCogsLoading(true);
    try {
      const res = await eisApi.getCogsUploadData(selectedYear, selectedPeriod);
      setCogs(res.data.data || []);
    } catch (err) { console.error(err); }
    setCogsLoading(false);
  };

  useEffect(() => { loadOvertime(); }, [selectedYear]);
  useEffect(() => { loadCogs(); }, [selectedYear, selectedPeriod]);

  const handleOtUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOtUploading(true); setOtMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await eisApi.uploadOvertimeData(selectedYear, fd);
      setOvertime(res.data.data || []);
      setOtMsg({ type: 'ok', text: res.data.message });
    } catch (err) {
      setOtMsg({ type: 'err', text: 'Gagal: ' + (err.response?.data?.detail || err.message) });
    }
    setOtUploading(false); e.target.value = '';
  };

  const handleCogsUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCogsUploading(true); setCogsMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await eisApi.uploadCogsData(selectedYear, fd);
      await loadCogs();
      const skipped = res.data.skipped?.length > 0 ? ` (tidak cocok: ${res.data.skipped.join(', ')})` : '';
      setCogsMsg({ type: 'ok', text: res.data.message + skipped });
    } catch (err) {
      setCogsMsg({ type: 'err', text: 'Gagal: ' + (err.response?.data?.detail || err.message) });
    }
    setCogsUploading(false); e.target.value = '';
  };

  const YearSelector = () => (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-500 font-medium">Tahun:</label>
      <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}
        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pharma-400">
        {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );

  const MsgBanner = ({ msg, onClose }) => msg ? (
    <div className={`mt-3 flex items-start gap-2 text-xs rounded-lg px-3 py-2 ${msg.type === 'err' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
      {msg.type === 'ok' && <CheckCircle2 size={13} className="mt-0.5 shrink-0" />}
      <span className="flex-1">{msg.text}</span>
      <button onClick={onClose}><X size={12} /></button>
    </div>
  ) : null;

  return (
    <div>
      <TopBar title="Upload Data" />

      {/* ── Section 1: Overtime ───────────────────────────────── */}
      <div className="chart-container mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <h3 className="font-display font-semibold text-gray-800 mb-1 flex items-center gap-2">
              <BarChart2 size={16} className="text-pharma-600" /> Upload Data Overtime
            </h3>
            <p className="text-xs text-gray-500 mb-2">Format kolom B: label (Overtime Hour / Working Hour) · Kolom C–N: Jan–Dec</p>
            <div className="flex items-center gap-2 text-[11px] text-gray-400">
              <FileSpreadsheet size={12} /><span>Referensi: overtime_data.xlsx</span>
            </div>
            <MsgBanner msg={otMsg} onClose={() => setOtMsg(null)} />
          </div>
          <div className="flex flex-col gap-3 items-end shrink-0">
            <YearSelector />
            <button onClick={() => otFileRef.current?.click()} disabled={otUploading}
              className="flex items-center gap-2 px-4 py-2.5 bg-pharma-700 hover:bg-pharma-800 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60">
              {otUploading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Upload size={15} />}
              {otUploading ? 'Mengupload...' : 'Pilih File (.xlsx)'}
            </button>
            <input ref={otFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleOtUpload} />
          </div>
        </div>
      </div>

      {/* ── Section 2: COGS ──────────────────────────────────── */}
      <div className="chart-container mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <h3 className="font-display font-semibold text-gray-800 mb-1 flex items-center gap-2">
              <Package size={16} className="text-amber-600" /> Upload Data COGS
            </h3>
            <p className="text-xs text-gray-500 mb-1">Format: kolom B = Nama Produk, kolom C = COGS (IDR).</p>
            <p className="text-xs text-gray-400 mb-2">
              COGS ratio = COGS / Net Sales. Net Sales diambil otomatis dari Oracle OE (etl_cogs).
              COGS didistribusikan proporsional per bulan berdasarkan penjualan.
            </p>
            <div className="flex items-center gap-2 text-[11px] text-gray-400">
              <FileSpreadsheet size={12} /><span>Referensi: cogs_data.xlsx</span>
            </div>
            <MsgBanner msg={cogsMsg} onClose={() => setCogsMsg(null)} />
          </div>
          <div className="flex flex-col gap-3 items-end shrink-0">
            <YearSelector />
            <button onClick={() => cogsFileRef.current?.click()} disabled={cogsUploading}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60">
              {cogsUploading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Upload size={15} />}
              {cogsUploading ? 'Mengupload...' : 'Pilih File (.xlsx)'}
            </button>
            <input ref={cogsFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleCogsUpload} />
          </div>
        </div>
      </div>

      {/* ── COGS Preview ─────────────────────────────────────── */}
      <div className="chart-container mb-6">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h3 className="font-display font-semibold text-gray-800">
            COGS Ratio by Product — {selectedYear}
          </h3>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">s/d Periode:</label>
              <select value={selectedPeriod} onChange={(e) => setSelectedPeriod(Number(e.target.value))}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pharma-400">
                {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <button onClick={loadCogs} className="flex items-center gap-1.5 text-sm text-pharma-600 hover:text-pharma-800">
              <RefreshCw size={13} />
            </button>
          </div>
        </div>
        {cogsLoading ? (
          <div className="py-8 text-center text-gray-400 text-sm">Memuat...</div>
        ) : cogs.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-sm">
            Belum ada data COGS. Upload file dan pastikan etl_cogs sudah dijalankan.
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={Math.max(220, cogs.length * 38)}>
              <BarChart data={cogs} layout="vertical" margin={{ left: 140, right: 70 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[0, 'dataMax + 5']} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="product_name" tick={{ fontSize: 11 }} width={135} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v, name) => [`${fmt(v)}%`, name]}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                />
                <ReferenceLine x={70} stroke="#f59e0b" strokeDasharray="5 5" label={{ value: '70%', fill: '#f59e0b', fontSize: 10 }} />
                <Bar dataKey="cogs_pct" name="COGS Ratio %" radius={[0, 4, 4, 0]} barSize={24}>
                  {cogs.map((entry, i) => (
                    <Cell key={i} fill={Number(entry.cogs_pct) > 100 ? '#ef4444' : Number(entry.cogs_pct) > 70 ? '#f59e0b' : '#1a5a73'} />
                  ))}
                  <LabelList dataKey="cogs_pct" position="right" formatter={(v) => `${fmt(v, 1)}%`} style={{ fontSize: 11, fontWeight: 600, fill: '#374151' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-pharma-950 text-white">
                    <th className="px-3 py-2 text-left font-semibold">Produk</th>
                    <th className="px-3 py-2 text-right font-semibold">Net Sales (IDR)</th>
                    <th className="px-3 py-2 text-right font-semibold">COGS (IDR)</th>
                    <th className="px-3 py-2 text-right font-semibold">COGS Ratio</th>
                  </tr>
                </thead>
                <tbody>
                  {cogs.map((row, i) => (
                    <tr key={i} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                      <td className="px-3 py-2 font-medium text-gray-700">{row.product_name}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-600">{fmtM(row.net_sales)}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-600">{fmtM(row.cogs)}</td>
                      <td className={`px-3 py-2 text-right font-mono font-semibold ${
                        Number(row.cogs_pct) > 100 ? 'text-red-500' : Number(row.cogs_pct) > 70 ? 'text-amber-600' : 'text-emerald-600'
                      }`}>{fmt(row.cogs_pct)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── Overtime Preview ─────────────────────────────────── */}
      {otLoading ? <Loading /> : overtime.length === 0 ? (
        <div className="chart-container">
          <div className="text-center py-12 text-gray-400">
            <BarChart2 size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Belum ada data overtime untuk tahun {selectedYear}.</p>
            <p className="text-xs mt-1">Upload file Excel untuk menampilkan grafik.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Chart */}
          <div className="chart-container mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-gray-800">
                Plant Overtime Ratio — {selectedYear}
              </h3>
              <button
                onClick={loadOvertime}
                className="flex items-center gap-1.5 text-sm text-pharma-600 hover:text-pharma-800 transition-colors"
              >
                <RefreshCw size={13} /> Refresh
              </button>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={overtime} margin={{ right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="period_name" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(0, 3)} />
                <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 'dataMax + 3']} />
                <Tooltip
                  formatter={(v) => [`${fmt(v)}%`, 'Overtime Ratio']}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                />
                <ReferenceLine y={15} stroke="#ef4444" strokeDasharray="5 5"
                  label={{ value: 'Target 15%', position: 'insideTopRight', fontSize: 11, fill: '#ef4444' }} />
                <Bar dataKey="ratio_pct" name="Overtime %" radius={[4, 4, 0, 0]} barSize={32}>
                  {overtime.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={Number(entry.ratio_pct) <= 15 ? '#10b981' : Number(entry.ratio_pct) <= 20 ? '#f59e0b' : '#ef4444'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Table */}
          <div className="chart-container">
            <h3 className="font-display font-semibold text-gray-800 mb-4">
              Detail Data Overtime — {selectedYear}
            </h3>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-pharma-950 text-white text-xs">
                    <th className="px-4 py-2.5 text-left font-semibold">Bulan</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Overtime Hours</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Working Hours</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Total Hours</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Overtime Ratio</th>
                  </tr>
                </thead>
                <tbody>
                  {overtime.map((row, i) => {
                    const total = (row.overtime_hours || 0) + (row.working_hours || 0);
                    const isOver = Number(row.ratio_pct) > 15;
                    return (
                      <tr key={i} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                        <td className="px-4 py-2.5 font-medium text-gray-700">{row.period_name}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-gray-700">{fmt(row.overtime_hours)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-gray-700">{fmt(row.working_hours)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-gray-600">{fmt(total)}</td>
                        <td className={`px-4 py-2.5 text-right font-mono font-semibold ${isOver ? 'text-red-500' : 'text-emerald-600'}`}>
                          {fmt(row.ratio_pct)}%
                          {isOver && <span className="ml-1 text-[10px] font-normal bg-red-50 text-red-500 px-1.5 py-0.5 rounded">Over</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-pharma-50 border-t-2 border-pharma-200 text-xs font-semibold text-pharma-800">
                    <td className="px-4 py-2.5">Total</td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      {fmt(overtime.reduce((s, r) => s + (r.overtime_hours || 0), 0))}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      {fmt(overtime.reduce((s, r) => s + (r.working_hours || 0), 0))}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      {fmt(overtime.reduce((s, r) => s + (r.overtime_hours || 0) + (r.working_hours || 0), 0))}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      {(() => {
                        const tot_ot = overtime.reduce((s, r) => s + (r.overtime_hours || 0), 0);
                        const tot_wk = overtime.reduce((s, r) => s + (r.working_hours || 0), 0);
                        const tot = tot_ot + tot_wk;
                        return tot > 0 ? `${fmt(tot_ot / tot * 100)}%` : '—';
                      })()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

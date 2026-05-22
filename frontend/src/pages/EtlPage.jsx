import { useEffect, useState, Fragment } from 'react';
import {
  Play, RefreshCw, Clock, CheckCircle, XCircle,
  Loader2, X, Square, ChevronDown, ChevronUp, Database,
} from 'lucide-react';
import TopBar from '../components/layout/TopBar';
import Loading from '../components/common/Loading';
import { eisApi } from '../utils/api';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);
const MONTHS = [
  { value: '', label: 'Semua bulan' },
  { value: 1, label: 'Januari' }, { value: 2, label: 'Februari' },
  { value: 3, label: 'Maret' }, { value: 4, label: 'April' },
  { value: 5, label: 'Mei' }, { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' }, { value: 8, label: 'Agustus' },
  { value: 9, label: 'September' }, { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' }, { value: 12, label: 'Desember' },
];

const fmtNum = (v) =>
  v == null ? '—' : Number(v).toLocaleString('id-ID', { maximumFractionDigits: 2 });

function StatusBadge({ status }) {
  const cfg = {
    success: { cls: 'badge-success', icon: <CheckCircle size={11} className="mr-1" /> },
    failed:  { cls: 'badge-danger',  icon: <XCircle    size={11} className="mr-1" /> },
    stopped: { cls: 'bg-gray-100 text-gray-600 badge', icon: <Square size={11} className="mr-1" /> },
    running: { cls: 'badge-warning', icon: <Loader2    size={11} className="mr-1 animate-spin" /> },
  };
  const { cls, icon } = cfg[status] || cfg.running;
  return <span className={`badge ${cls} inline-flex items-center`}>{icon}{status}</span>;
}

function DataPreview({ jobName, runParams, onClose }) {
  const [rows, setRows] = useState(null);
  const [cols, setCols] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    const p = typeof runParams === 'string' ? JSON.parse(runParams) : runParams;
    const year = p?.year || CURRENT_YEAR;
    const month = p?.month || null;
    eisApi.getEtlJobData(jobName, year, month)
      .then((res) => {
        setRows(res.data.data || []);
        setCols(res.data.columns || []);
      })
      .catch((e) => setErr(e.response?.data?.detail || e.message))
      .finally(() => setLoading(false));
  }, [jobName, runParams]);

  const colLabel = (c) => c.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <tr>
      <td colSpan={8} className="p-0">
        <div className="bg-pharma-50 border-t border-pharma-100 px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-pharma-800 flex items-center gap-1.5">
              <Database size={13} />
              Data hasil import — <span className="font-mono">{jobName}</span>
            </span>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <ChevronUp size={15} />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
              <Loader2 size={13} className="animate-spin" /> Memuat data...
            </div>
          ) : err ? (
            <div className="text-xs text-red-500 py-2">{err}</div>
          ) : rows.length === 0 ? (
            <div className="text-xs text-gray-400 py-2">Belum ada data untuk parameter ini.</div>
          ) : (
            <div className="overflow-x-auto rounded border border-pharma-200 max-h-64">
              <table className="w-full text-[11px] border-collapse min-w-max">
                <thead className="bg-pharma-900 text-white sticky top-0 z-10">
                  <tr>
                    {cols.map((c) => (
                      <th key={c} className="px-2.5 py-1.5 text-left font-medium whitespace-nowrap">
                        {colLabel(c)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className={`border-b border-pharma-100 ${i % 2 === 0 ? 'bg-white' : 'bg-pharma-50/60'}`}>
                      {cols.map((c) => {
                        const v = row[c];
                        const isNum = typeof v === 'number';
                        const isPct = c.endsWith('_pct');
                        return (
                          <td
                            key={c}
                            className={`px-2.5 py-1.5 whitespace-nowrap font-mono ${
                              isNum ? 'text-right' : 'text-gray-700'
                            } ${isPct && v < 80 ? 'text-red-500' : isPct && v >= 100 ? 'text-emerald-600' : ''}`}
                          >
                            {v == null ? '—' : isPct ? `${fmtNum(v)}%` : isNum ? fmtNum(v) : String(v)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="text-[10px] text-gray-400 mt-2">
            {rows?.length} baris ditampilkan · klik row lain untuk menutup
          </div>
        </div>
      </td>
    </tr>
  );
}

export default function EtlPage() {
  const [jobs, setJobs] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState('');
  const [stopping, setStopping] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [modal, setModal] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [jRes, sRes] = await Promise.all([
        eisApi.getEtlStatus(),
        eisApi.getEtlSchedule(),
      ]);
      setJobs(jRes.data.data || []);
      setSchedule(sRes.data.data || []);
    } catch (err) {
      console.error('Failed to load ETL:', err);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // Auto-refresh every 15s if any job is running
  useEffect(() => {
    const hasRunning = jobs.some((j) => j.status === 'running');
    if (!hasRunning) return;
    const t = setInterval(loadData, 15000);
    return () => clearInterval(t);
  }, [jobs]);

  const openModal = (jobName) => setModal({ job: jobName, year: CURRENT_YEAR, month: '' });

  const handleTrigger = async () => {
    const { job, year, month } = modal;
    setModal(null);
    setTriggering(job);
    try {
      await eisApi.triggerEtl(job, { year, month: month || null });
      setTimeout(loadData, 2000);
    } catch (err) {
      alert('Gagal: ' + (err.response?.data?.detail || err.message));
    }
    setTriggering('');
  };

  const handleStop = async (jobName, e) => {
    e.stopPropagation();
    if (!confirm(`Hentikan job "${jobName}" yang sedang berjalan?`)) return;
    setStopping(jobName);
    try {
      await eisApi.stopEtl(jobName);
      await loadData();
    } catch (err) {
      alert('Gagal stop: ' + (err.response?.data?.detail || err.message));
    }
    setStopping('');
  };

  const toggleExpand = (id) => setExpandedId((prev) => (prev === id ? null : id));

  const parseParams = (raw) => {
    if (!raw) return '—';
    const p = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return p.month ? `${p.year}/${String(p.month).padStart(2, '0')}` : `${p.year}`;
  };

  if (loading) return <Loading />;

  return (
    <div>
      <TopBar title="ETL Management" />

      {/* Run Parameter Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-80 p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-gray-800">
                Run <span className="font-mono text-pharma-600">{modal.job}</span>
              </h4>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tahun</label>
                <select
                  value={modal.year}
                  onChange={(e) => setModal({ ...modal, year: Number(e.target.value) })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pharma-500"
                >
                  {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Bulan <span className="text-gray-400 font-normal">(kosong = semua bulan)</span>
                </label>
                <select
                  value={modal.month}
                  onChange={(e) => setModal({ ...modal, month: e.target.value ? Number(e.target.value) : '' })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pharma-500"
                >
                  {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <p className="text-[11px] text-gray-400">
                Pilih bulan tertentu agar proses lebih cepat saat dijalankan di jam kerja.
              </p>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setModal(null)}
                className="flex-1 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleTrigger}
                className="flex-1 flex items-center justify-center gap-1.5 bg-pharma-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-pharma-700 transition-colors"
              >
                <Play size={13} /> Jalankan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule */}
      <div className="chart-container mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-gray-800">ETL Schedule</h3>
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 text-sm text-pharma-600 hover:text-pharma-800 transition-colors"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {schedule.map((s) => (
            <div key={s.job} className="flex items-center justify-between bg-gray-50 rounded-lg p-3 border border-gray-100">
              <div>
                <div className="text-sm font-medium text-gray-800">{s.job}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  <Clock size={10} className="inline mr-1" />
                  {s.frequency} — {s.schedule}
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">{s.source}</div>
              </div>
              <button
                onClick={() => openModal(s.job)}
                disabled={triggering === s.job}
                className="flex items-center gap-1 bg-pharma-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-pharma-700 transition-colors disabled:opacity-50"
              >
                {triggering === s.job
                  ? <Loader2 size={12} className="animate-spin" />
                  : <Play size={12} />}
                Run
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Job History */}
      <div className="chart-container">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-gray-800">
            Recent Job History
            <span className="ml-2 text-xs font-normal text-gray-400">(10 terakhir · klik baris untuk lihat data)</span>
          </h3>
        </div>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-2.5 px-3 font-medium text-gray-600 text-xs">Job</th>
                <th className="text-left py-2.5 px-3 font-medium text-gray-600 text-xs">Status</th>
                <th className="text-left py-2.5 px-3 font-medium text-gray-600 text-xs">Started</th>
                <th className="text-left py-2.5 px-3 font-medium text-gray-600 text-xs">Duration</th>
                <th className="text-right py-2.5 px-3 font-medium text-gray-600 text-xs">Records</th>
                <th className="text-left py-2.5 px-3 font-medium text-gray-600 text-xs">Parameter</th>
                <th className="text-left py-2.5 px-3 font-medium text-gray-600 text-xs">Error</th>
                <th className="py-2.5 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-gray-400 text-sm">
                    Belum ada job yang dijalankan
                  </td>
                </tr>
              ) : (
                jobs.map((j) => (
                  <Fragment key={j.id}>
                    <tr
                      onClick={() => toggleExpand(j.id)}
                      className={`border-b border-gray-100 cursor-pointer transition-colors ${
                        expandedId === j.id ? 'bg-pharma-50' : 'hover:bg-gray-50/60'
                      }`}
                    >
                      <td className="py-2.5 px-3 font-mono text-xs font-semibold text-pharma-800">
                        <span className="flex items-center gap-1">
                          {expandedId === j.id
                            ? <ChevronUp size={12} className="text-pharma-500" />
                            : <ChevronDown size={12} className="text-gray-400" />}
                          {j.job_name}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <StatusBadge status={j.status} />
                      </td>
                      <td className="py-2.5 px-3 text-xs text-gray-500">
                        {j.started_at ? new Date(j.started_at).toLocaleString('id-ID') : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-gray-500">
                        {j.duration_secs != null ? `${j.duration_secs}s` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-xs">
                        {j.records_processed || 0}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-gray-500">{parseParams(j.run_params)}</td>
                      <td className="py-2.5 px-3 text-xs text-red-500 max-w-[160px] truncate" title={j.error_message}>
                        {j.error_message || '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        {j.status === 'running' && (
                          <button
                            onClick={(e) => handleStop(j.job_name, e)}
                            disabled={stopping === j.job_name}
                            title="Hentikan job"
                            className="flex items-center gap-1 text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-1 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                          >
                            {stopping === j.job_name
                              ? <Loader2 size={11} className="animate-spin" />
                              : <Square size={11} />}
                            Stop
                          </button>
                        )}
                      </td>
                    </tr>

                    {expandedId === j.id && (
                      <DataPreview
                        jobName={j.job_name}
                        runParams={j.run_params}
                        onClose={() => setExpandedId(null)}
                      />
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

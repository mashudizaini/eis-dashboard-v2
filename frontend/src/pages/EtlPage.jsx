import { useEffect, useState } from 'react';
import { Play, RefreshCw, Clock, CheckCircle, XCircle, Loader2, X } from 'lucide-react';
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

export default function EtlPage() {
  const [jobs, setJobs] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState('');

  // Modal state
  const [modal, setModal] = useState(null); // { job, year, month }

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

  const openModal = (jobName) => {
    setModal({ job: jobName, year: CURRENT_YEAR, month: '' });
  };

  const handleTrigger = async () => {
    const { job, year, month } = modal;
    setModal(null);
    setTriggering(job);
    try {
      await eisApi.triggerEtl(job, { year, month: month || null });
      setTimeout(loadData, 2000);
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.detail || err.message));
    }
    setTriggering('');
  };

  if (loading) return <Loading />;

  return (
    <div>
      <TopBar title="ETL management" />

      {/* Run Parameter Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-80 p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-gray-800">Run <span className="font-mono text-pharma-600">{modal.job}</span></h4>
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
                  {YEARS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Bulan <span className="text-gray-400 font-normal">(opsional — kosong = semua bulan)</span>
                </label>
                <select
                  value={modal.month}
                  onChange={(e) => setModal({ ...modal, month: e.target.value ? Number(e.target.value) : '' })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pharma-500"
                >
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
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
                <Play size={13} />
                Jalankan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule */}
      <div className="chart-container mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-gray-800">ETL schedule</h3>
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 text-sm text-pharma-600 hover:text-pharma-800 transition-colors"
          >
            <RefreshCw size={14} />
            Refresh
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
                {triggering === s.job ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                Run
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Job History */}
      <div className="chart-container">
        <h3 className="font-display font-semibold text-gray-800 mb-4">Recent job history</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-2 px-3 font-medium text-gray-600">Job</th>
                <th className="text-left py-2 px-3 font-medium text-gray-600">Status</th>
                <th className="text-left py-2 px-3 font-medium text-gray-600">Started</th>
                <th className="text-left py-2 px-3 font-medium text-gray-600">Duration</th>
                <th className="text-right py-2 px-3 font-medium text-gray-600">Records</th>
                <th className="text-left py-2 px-3 font-medium text-gray-600">Parameter</th>
                <th className="text-left py-2 px-3 font-medium text-gray-600">Error</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 ? (
                <tr><td colSpan={7} className="py-10 text-center text-gray-400">No jobs executed yet</td></tr>
              ) : (
                jobs.map((j) => (
                  <tr key={j.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="py-2 px-3 font-mono text-xs font-medium text-gray-800">{j.job_name}</td>
                    <td className="py-2 px-3">
                      <span className={`badge ${
                        j.status === 'success' ? 'badge-success' :
                        j.status === 'failed' ? 'badge-danger' : 'badge-warning'
                      }`}>
                        {j.status === 'success' ? <CheckCircle size={11} className="mr-1" /> :
                         j.status === 'failed' ? <XCircle size={11} className="mr-1" /> :
                         <Loader2 size={11} className="mr-1 animate-spin" />}
                        {j.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-xs text-gray-500">
                      {j.started_at ? new Date(j.started_at).toLocaleString('id-ID') : '—'}
                    </td>
                    <td className="py-2 px-3 text-xs text-gray-500">
                      {j.duration_secs != null ? `${j.duration_secs}s` : '—'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{j.records_processed || 0}</td>
                    <td className="py-2 px-3 text-xs text-gray-500">
                      {j.run_params
                        ? (() => {
                            const p = typeof j.run_params === 'string' ? JSON.parse(j.run_params) : j.run_params;
                            return p.month ? `${p.year}/${String(p.month).padStart(2, '0')}` : `${p.year}`;
                          })()
                        : '—'}
                    </td>
                    <td className="py-2 px-3 text-xs text-red-500 max-w-[200px] truncate" title={j.error_message}>
                      {j.error_message || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import { Calendar, Filter, RefreshCw } from 'lucide-react';
import useDashboardStore from '../../stores/dashboardStore';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const YEARS = [2024, 2025, 2026];

export default function TopBar({ title, showSegment = false, onRefresh, refreshing = false }) {
  const { year, period, segment, setYear, setPeriod, setSegment } = useDashboardStore();

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
      <h1 className="font-display text-2xl font-semibold text-pharma-900">{title}</h1>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-3 py-1.5 shadow-sm">
          <Calendar size={15} className="text-pharma-500" />
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="bg-transparent text-sm font-medium text-gray-700 outline-none cursor-pointer"
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-3 py-1.5 shadow-sm">
          <Filter size={15} className="text-pharma-500" />
          <select
            value={period}
            onChange={(e) => setPeriod(Number(e.target.value))}
            className="bg-transparent text-sm font-medium text-gray-700 outline-none cursor-pointer"
          >
            {MONTHS.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        {showSegment && (
          <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-1 shadow-sm">
            {['all', 'Local', 'CMO', 'Export'].map((s) => (
              <button
                key={s}
                onClick={() => setSegment(s)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  segment === s
                    ? 'bg-pharma-700 text-white'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {s === 'all' ? 'All' : s}
              </button>
            ))}
          </div>
        )}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={refreshing}
            title="Refresh data"
            className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-sm text-sm text-pharma-600 hover:text-pharma-800 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        )}
      </div>
    </div>
  );
}

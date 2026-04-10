import { useEffect, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';
import TopBar from '../components/layout/TopBar';
import Loading from '../components/common/Loading';
import { eisApi } from '../utils/api';
import useDashboardStore from '../stores/dashboardStore';

export default function PerformancePage() {
  const { year, period, segment } = useDashboardStore();
  const [monthly, setMonthly] = useState([]);
  const [achievement, setAchievement] = useState([]);
  const [ebit, setEbit] = useState([]);
  const [area, setArea] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const [mRes, aRes, eRes, arRes] = await Promise.all([
        eisApi.getMonthlySales(year, segment),
        eisApi.getSalesAchievement(year, segment),
        eisApi.getEbitProduct(year, period),
        eisApi.getAreaSales(year, period),
      ]);
      setMonthly(mRes.data.data || []);
      setAchievement(aRes.data.data || []);
      setEbit((eRes.data.data || []).slice(0, 15));
      setArea(arRes.data.data || []);
    } catch (err) {
      console.error('Failed to load performance:', err);
    }
    isRefresh ? setRefreshing(false) : setLoading(false);
  };

  useEffect(() => { load(); }, [year, period, segment]);

  if (loading) return <Loading />;

  const latestAch = achievement.length > 0 ? achievement[achievement.length - 1] : null;

  return (
    <div>
      <TopBar title="Performance dashboard" showSegment onRefresh={() => load(true)} refreshing={refreshing} />

      {/* Achievement gauge */}
      {latestAch && (
        <div className="kpi-card mb-6 flex items-center gap-6">
          <div className="relative w-28 h-28">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="42" fill="none"
                stroke={Number(latestAch.achievement_pct) >= 80 ? '#10b981' : Number(latestAch.achievement_pct) >= 60 ? '#f59e0b' : '#ef4444'}
                strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${Number(latestAch.achievement_pct) * 2.64} 264`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-xl font-bold text-gray-900">{Number(latestAch.achievement_pct).toFixed(1)}%</span>
              <span className="text-[10px] text-gray-400">YTD</span>
            </div>
          </div>
          <div>
            <div className="font-display text-lg font-semibold text-gray-800">
              {segment === 'all' ? 'Company' : segment} sales achievement
            </div>
            <div className="text-sm text-gray-500 mt-1">
              Actual: {Number(latestAch.actual_cumulative || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })} M IDR
              {' / '}
              BP: {Number(latestAch.bp_cumulative || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })} M IDR
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Monthly Sales */}
        <div className="chart-container">
          <h3 className="font-display font-semibold text-gray-800 mb-4">Monthly sales: BP vs actual</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthly} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="period_name" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(0, 3)} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="bp_amount" name="Business Plan" fill="#1a5a73" radius={[3, 3, 0, 0]} />
              <Bar dataKey="actual_amount" name="Actual" fill="#d4a843" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Achievement Trend */}
        <div className="chart-container">
          <h3 className="font-display font-semibold text-gray-800 mb-4">Cumulative achievement trend</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={achievement}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="period_name" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(0, 3)} />
              <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 120]} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Line type="monotone" dataKey="achievement_pct" stroke="#1a5a73" strokeWidth={2.5} dot={{ r: 3 }} name="Achievement %" />
              <Line type="monotone" dataKey={() => 100} stroke="#ef4444" strokeWidth={1} strokeDasharray="5 5" dot={false} name="Target 100%" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* EBIT by Product */}
        <div className="chart-container">
          <h3 className="font-display font-semibold text-gray-800 mb-4">EBIT by product (top 15)</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={ebit} layout="vertical" margin={{ left: 120 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 11 }} unit="%" />
              <YAxis type="category" dataKey="product_name" tick={{ fontSize: 11 }} width={115} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Bar dataKey="ebit_pct" name="EBIT %" radius={[0, 4, 4, 0]}>
                {ebit.map((entry, i) => (
                  <Cell key={i} fill={Number(entry.ebit_pct) >= 0 ? '#10b981' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Area Sales */}
        <div className="chart-container">
          <h3 className="font-display font-semibold text-gray-800 mb-4">Area sales performance</h3>
          {area.length > 0 ? (
            <div className="space-y-3">
              {area.map((a) => (
                <div key={a.area_name} className="flex items-center gap-3">
                  <div className="w-24 text-sm font-medium text-gray-700">{a.area_name}</div>
                  <div className="flex-1 h-7 bg-gray-100 rounded-full overflow-hidden relative">
                    <div
                      className="h-full bg-pharma-500 rounded-full transition-all duration-700"
                      style={{ width: `${Number(a.portion_pct)}%` }}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-600">
                      {Number(a.cumulative_amount || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })} M
                    </span>
                  </div>
                  <div className="w-14 text-right text-sm font-mono font-medium text-pharma-700">
                    {Number(a.portion_pct).toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-400 py-10 text-sm">No data available</div>
          )}
        </div>
      </div>
    </div>
  );
}

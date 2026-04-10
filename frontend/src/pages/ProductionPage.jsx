import { useEffect, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import TopBar from '../components/layout/TopBar';
import Loading from '../components/common/Loading';
import { eisApi } from '../utils/api';
import useDashboardStore from '../stores/dashboardStore';

export default function ProductionPage() {
  const { year, period } = useDashboardStore();
  const [yieldData, setYieldData] = useState([]);
  const [overtime, setOvertime] = useState([]);
  const [cogs, setCogs] = useState([]);
  const [release, setRelease] = useState([]);
  const [dio, setDio] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const [yRes, oRes, cRes, rRes, dRes] = await Promise.all([
        eisApi.getYieldProduction(year),
        eisApi.getOvertime(year),
        eisApi.getCogsRatio(year, period),
        eisApi.getReleaseTime(year),
        eisApi.getDio(year),
      ]);
      setYieldData(yRes.data.data || []);
      setOvertime(oRes.data.data || []);
      setCogs((cRes.data.data || []).slice(0, 14));
      setRelease(rRes.data.data || []);
      setDio(dRes.data.data || []);
    } catch (err) {
      console.error('Failed to load production:', err);
    }
    isRefresh ? setRefreshing(false) : setLoading(false);
  };

  useEffect(() => { load(); }, [year, period]);

  if (loading) return <Loading />;

  const latestYield = yieldData.length > 0 ? yieldData[yieldData.length - 1] : null;

  return (
    <div>
      <TopBar title="Production dashboard" onRefresh={() => load(true)} refreshing={refreshing} />

      {/* Yield gauge + DIO card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="kpi-card text-center">
          <div className="text-xs text-gray-500 font-medium mb-2">Current yield</div>
          <div className={`font-display text-3xl font-bold ${
            Number(latestYield?.yield_pct || 0) >= 95 ? 'text-emerald-600' :
            Number(latestYield?.yield_pct || 0) >= 90 ? 'text-amber-600' : 'text-red-600'
          }`}>
            {Number(latestYield?.yield_pct || 0).toFixed(1)}%
          </div>
          <div className="text-[11px] text-gray-400 mt-1">Target: 95%</div>
        </div>
        <div className="kpi-card text-center">
          <div className="text-xs text-gray-500 font-medium mb-2">Days inventory (DIO)</div>
          <div className="font-display text-3xl font-bold text-pharma-700">
            {dio.length > 0 ? Number(dio[dio.length - 1].dio_days).toFixed(0) : '—'}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">days</div>
        </div>
        <div className="kpi-card text-center">
          <div className="text-xs text-gray-500 font-medium mb-2">FG release time</div>
          <div className={`font-display text-3xl font-bold ${
            release.length > 0 && Number(release[release.length - 1]?.actual_days) <= 16 ? 'text-emerald-600' : 'text-amber-600'
          }`}>
            {release.length > 0 ? release[release.length - 1].actual_days : '—'}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">days (target: 16)</div>
        </div>
        <div className="kpi-card text-center">
          <div className="text-xs text-gray-500 font-medium mb-2">Overtime ratio</div>
          <div className={`font-display text-3xl font-bold ${
            overtime.length > 0 && Number(overtime[overtime.length - 1]?.ratio_pct) <= 15 ? 'text-emerald-600' : 'text-amber-600'
          }`}>
            {overtime.length > 0 ? Number(overtime[overtime.length - 1].ratio_pct).toFixed(1) : '—'}%
          </div>
          <div className="text-[11px] text-gray-400 mt-1">Target: &lt;15%</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Yield Trend */}
        <div className="chart-container">
          <h3 className="font-display font-semibold text-gray-800 mb-4">Yield production trend</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={yieldData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="period_name" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(0, 3)} />
              <YAxis tick={{ fontSize: 11 }} unit="%" domain={[80, 100]} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <ReferenceLine y={95} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'Target 95%', position: 'right', fontSize: 11, fill: '#ef4444' }} />
              <Line type="monotone" dataKey="yield_pct" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4, fill: '#10b981' }} name="Yield %" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Overtime Trend */}
        <div className="chart-container">
          <h3 className="font-display font-semibold text-gray-800 mb-4">Plant overtime ratio</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={overtime}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="period_name" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(0, 3)} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <ReferenceLine y={15} stroke="#ef4444" strokeDasharray="5 5" label={{ value: '15%', position: 'right', fontSize: 11, fill: '#ef4444' }} />
              <Bar dataKey="ratio_pct" name="Overtime %" radius={[4, 4, 0, 0]}>
                {overtime.map((entry, i) => (
                  <Cell key={i} fill={Number(entry.ratio_pct) <= 15 ? '#10b981' : Number(entry.ratio_pct) <= 20 ? '#f59e0b' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* COGS Ratio */}
        <div className="chart-container">
          <h3 className="font-display font-semibold text-gray-800 mb-4">COGS ratio by product</h3>
          <ResponsiveContainer width="100%" height={380}>
            <BarChart data={cogs} layout="vertical" margin={{ left: 130 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="product_name" tick={{ fontSize: 10 }} width={125} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Bar dataKey="cogs_rate" name="COGS Ratio" radius={[0, 4, 4, 0]}>
                {cogs.map((entry, i) => (
                  <Cell key={i} fill={Number(entry.cogs_rate) > 1 ? '#ef4444' : Number(entry.cogs_rate) > 0.7 ? '#f59e0b' : '#1a5a73'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* DIO Trend */}
        <div className="chart-container">
          <h3 className="font-display font-semibold text-gray-800 mb-4">Days inventory outstanding (DIO)</h3>
          <ResponsiveContainer width="100%" height={380}>
            <LineChart data={dio}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="period_name" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(0, 3)} />
              <YAxis tick={{ fontSize: 11 }} unit=" d" />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <ReferenceLine y={150} stroke="#f59e0b" strokeDasharray="5 5" />
              <Line type="monotone" dataKey="dio_days" stroke="#d4a843" strokeWidth={2.5} dot={{ r: 4 }} name="DIO (days)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

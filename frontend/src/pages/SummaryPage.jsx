import { useEffect, useState } from 'react';
import { DollarSign, Activity, Landmark, Wallet } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import TopBar from '../components/layout/TopBar';
import KpiCard from '../components/common/KpiCard';
import Loading from '../components/common/Loading';
import { eisApi } from '../utils/api';
import useDashboardStore from '../stores/dashboardStore';

const COLORS = ['#1a5a73', '#d4a843', '#ef6c4a', '#10b981'];

export default function SummaryPage() {
  const { year, period } = useDashboardStore();
  const [kpi, setKpi] = useState(null);
  const [closing, setClosing] = useState([]);
  const [nwc, setNwc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const [kpiRes, closingRes, nwcRes] = await Promise.all([
        eisApi.getKpiCards(year, period),
        eisApi.getClosingEstimation(year, period),
        eisApi.getNwc(year, period),
      ]);
      setKpi(kpiRes.data.data);
      setClosing(closingRes.data.data || []);
      setNwc(nwcRes.data.data);
    } catch (err) {
      console.error('Failed to load summary:', err);
    }
    isRefresh ? setRefreshing(false) : setLoading(false);
  };

  useEffect(() => { load(); }, [year, period]);

  if (loading) return <Loading />;

  return (
    <div>
      <TopBar title="Executive Information Summary" onRefresh={() => load(true)} refreshing={refreshing} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          title="Sales Achievement" value={kpi?.sales_achievement || 0} unit="%"
          icon={DollarSign} color="pharma"
        />
        <KpiCard
          title="Production Yield" value={kpi?.yield_pct || 0} unit="%"
          target={95} icon={Activity} color="emerald"
        />
        <KpiCard
          title="Net Profit Achievement" value={kpi?.net_profit_achievement || 0} unit="%"
          icon={Landmark} color="amber"
        />
        <KpiCard
          title="Cashflow Achievement" value={kpi?.cashflow_achievement || 0} unit="%"
          icon={Wallet} color="coral"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Sales Closing Estimation */}
        <div className="chart-container">
          <h3 className="font-display font-semibold text-gray-800 mb-4">Sales closing estimation</h3>
          {closing.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={closing} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="business_type" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip
                  formatter={(v) => `${Number(v).toLocaleString('id-ID', { maximumFractionDigits: 0 })} M IDR`}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="bp_total" name="Business Plan" fill="#1a5a73" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual_total" name="Actual" fill="#d4a843" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center text-gray-400 py-10 text-sm">No data available</div>
          )}
        </div>

        {/* NWC */}
        <div className="chart-container">
          <h3 className="font-display font-semibold text-gray-800 mb-4">Net working capital</h3>
          {nwc ? (
            <div className="space-y-4">
              <div className="text-center">
                <div className="font-display text-4xl font-bold text-pharma-700">
                  {Number(nwc.nwc_days).toFixed(1)}
                </div>
                <div className="text-sm text-gray-500 mt-1">days ({Number(nwc.nwc_months).toFixed(1)} months)</div>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4">
                {[
                  { label: 'DSO', value: nwc.dso_days, color: 'bg-pharma-100 text-pharma-800' },
                  { label: 'DIO', value: nwc.dio_days, color: 'bg-amber-100 text-amber-800' },
                  { label: 'DPO', value: nwc.dpo_days, color: 'bg-emerald-100 text-emerald-800' },
                ].map((item) => (
                  <div key={item.label} className={`rounded-lg p-3 text-center ${item.color}`}>
                    <div className="text-xs font-medium opacity-70">{item.label}</div>
                    <div className="text-xl font-bold mt-1">{Number(item.value).toFixed(1)}</div>
                    <div className="text-[10px] opacity-60">days</div>
                  </div>
                ))}
              </div>
              <div className="text-center text-xs text-gray-400 mt-2">
                NWC = DSO + DIO − DPO
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-400 py-10 text-sm">No data available</div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { Users, Landmark, PieChart as PieIcon, Wallet } from 'lucide-react';
import TopBar from '../components/layout/TopBar';
import Loading from '../components/common/Loading';
import { eisApi } from '../utils/api';
import useDashboardStore from '../stores/dashboardStore';

const TABS = [
  { key: 'personnel', label: 'Personnel', icon: Users },
  { key: 'financial', label: 'Financial', icon: Landmark },
  { key: 'ratios', label: 'Ratios', icon: PieIcon },
  { key: 'budget', label: 'Budget', icon: Wallet },
];

export default function AdministrationPage() {
  const { year, period } = useDashboardStore();
  const [tab, setTab] = useState('personnel');
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const [hRes, tRes, pRes, cRes, rRes, bRes] = await Promise.all([
        eisApi.getHeadcount(year),
        eisApi.getTurnover(year),
        eisApi.getProfit(year),
        eisApi.getCashflow(year),
        eisApi.getRatios(year),
        eisApi.getBudget(year),
      ]);
      setData({
        headcount: hRes.data.data || [],
        turnover: tRes.data.data || [],
        profit: pRes.data.data || [],
        cashflow: cRes.data.data || [],
        ratios: rRes.data.data || [],
        budget: bRes.data.data || [],
      });
    } catch (err) {
      console.error('Failed to load admin:', err);
    }
    isRefresh ? setRefreshing(false) : setLoading(false);
  };

  useEffect(() => { load(); }, [year]);

  if (loading) return <Loading />;

  // Aggregate headcount by period for chart
  const headcountByMonth = {};
  (data.headcount || []).forEach((r) => {
    if (!headcountByMonth[r.period_num]) {
      headcountByMonth[r.period_num] = { period_name: r.period_name, period_num: r.period_num, total: 0 };
    }
    headcountByMonth[r.period_num][r.dept_group] = r.headcount;
    headcountByMonth[r.period_num].total += r.headcount;
    headcountByMonth[r.period_num].plan = r.plan_headcount;
  });
  const headcountChart = Object.values(headcountByMonth).sort((a, b) => a.period_num - b.period_num);

  // Aggregate budget by period
  const budgetByMonth = {};
  (data.budget || []).forEach((r) => {
    if (!budgetByMonth[r.period_num]) {
      budgetByMonth[r.period_num] = { period_name: r.period_name, bp: 0, actual: 0 };
    }
    budgetByMonth[r.period_num].bp += Number(r.bp_amount || 0);
    budgetByMonth[r.period_num].actual += Number(r.actual_amount || 0);
  });
  const budgetChart = Object.values(budgetByMonth);

  return (
    <div>
      <TopBar title="Administration dashboard" onRefresh={() => load(true)} refreshing={refreshing} />

      {/* Tab Selector */}
      <div className="flex gap-1 bg-white rounded-xl border border-gray-200 p-1 mb-6 shadow-sm w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key ? 'bg-pharma-700 text-white' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* PERSONNEL TAB */}
      {tab === 'personnel' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="chart-container">
            <h3 className="font-display font-semibold text-gray-800 mb-4">Employee headcount</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={headcountChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="period_name" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(0, 3)} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="SM" stackId="a" fill="#1a5a73" name="S&M" />
                <Bar dataKey="SD" stackId="a" fill="#47a7c7" name="SD" />
                <Bar dataKey="Plant Direct" stackId="a" fill="#10b981" name="Plant Direct" />
                <Bar dataKey="Plant Indirect" stackId="a" fill="#6ee7b7" name="Plant Indirect" />
                <Bar dataKey="Admin" stackId="a" fill="#d4a843" name="Admin" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-container">
            <h3 className="font-display font-semibold text-gray-800 mb-4">Turnover rate</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.turnover}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="period_name" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(0, 3)} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <ReferenceLine y={15} stroke="#f59e0b" strokeDasharray="5 5" />
                <ReferenceLine y={20} stroke="#ef4444" strokeDasharray="5 5" />
                <Line type="monotone" dataKey="turnover_pct" stroke="#ef6c4a" strokeWidth={2.5} dot={{ r: 4 }} name="Turnover %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* FINANCIAL TAB */}
      {tab === 'financial' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="chart-container">
            <h3 className="font-display font-semibold text-gray-800 mb-4">Monthly net profit</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.profit}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="period_name" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(0, 3)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <ReferenceLine y={0} stroke="#94a3b8" />
                <Bar dataKey="net_profit_actual" name="Net Profit" radius={[4, 4, 0, 0]}>
                  {(data.profit || []).map((entry, i) => (
                    <Cell key={i} fill={Number(entry.net_profit_actual) >= 0 ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-container">
            <h3 className="font-display font-semibold text-gray-800 mb-4">Cashflow: plan vs actual</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.cashflow}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="period_name" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(0, 3)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="cf_ending_balance_bp" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 5" name="Plan" dot={false} />
                <Line type="monotone" dataKey="cf_ending_balance_actual" stroke="#1a5a73" strokeWidth={2.5} dot={{ r: 3 }} name="Actual" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* RATIOS TAB */}
      {tab === 'ratios' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="chart-container">
            <h3 className="font-display font-semibold text-gray-800 mb-4">DSO & DPO trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.ratios}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="period_name" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(0, 3)} />
                <YAxis tick={{ fontSize: 11 }} unit=" d" />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="dso_days" stroke="#1a5a73" strokeWidth={2} dot={{ r: 3 }} name="DSO" />
                <Line type="monotone" dataKey="dpo_days" stroke="#d4a843" strokeWidth={2} dot={{ r: 3 }} name="DPO" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-container">
            <h3 className="font-display font-semibold text-gray-800 mb-4">Net working capital trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.ratios}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="period_name" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(0, 3)} />
                <YAxis tick={{ fontSize: 11 }} unit=" d" />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Line type="monotone" dataKey="nwc_days" stroke="#ef6c4a" strokeWidth={2.5} dot={{ r: 4 }} name="NWC (days)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* BUDGET TAB */}
      {tab === 'budget' && (
        <div className="chart-container">
          <h3 className="font-display font-semibold text-gray-800 mb-4">Monthly budget: plan vs actual</h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={budgetChart} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="period_name" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(0, 3)} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="bp" name="Business Plan" fill="#1a5a73" radius={[4, 4, 0, 0]} />
              <Bar dataKey="actual" name="Actual" fill="#d4a843" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

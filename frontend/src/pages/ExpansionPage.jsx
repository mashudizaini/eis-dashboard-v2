import { useEffect, useState } from 'react';
import TopBar from '../components/layout/TopBar';
import Loading from '../components/common/Loading';
import { eisApi } from '../utils/api';
import useDashboardStore from '../stores/dashboardStore';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const STAGE_COLORS = {
  1: { bg: 'bg-gray-200', text: 'text-gray-700', label: 'Market Analysis' },
  2: { bg: 'bg-blue-200', text: 'text-blue-800', label: 'Resource Supplier' },
  3: { bg: 'bg-amber-200', text: 'text-amber-800', label: 'Contract Agreement' },
  4: { bg: 'bg-emerald-200', text: 'text-emerald-800', label: 'Registration' },
  5: { bg: 'bg-emerald-600', text: 'text-white', label: 'Launch Preparation' },
};

export default function ExpansionPage() {
  const { year, period } = useDashboardStore();
  const [pipeline, setPipeline] = useState([]);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const [pRes, sRes] = await Promise.all([
        eisApi.getPipeline(year),
        eisApi.getPipelineSummary(year, period),
      ]);
      setPipeline(pRes.data.data || []);
      setSummary(sRes.data.data || []);
    } catch (err) {
      console.error('Failed to load expansion:', err);
    }
    isRefresh ? setRefreshing(false) : setLoading(false);
  };

  useEffect(() => { load(); }, [year, period]);

  if (loading) return <Loading />;

  return (
    <div>
      <TopBar title="Business expansion dashboard" onRefresh={() => load(true)} refreshing={refreshing} />

      {/* Stage Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {Object.entries(STAGE_COLORS).map(([order, style]) => {
          const count = summary.find((s) => s.stage_order === Number(order))?.product_count || 0;
          return (
            <div key={order} className={`rounded-xl p-4 ${style.bg} ${style.text}`}>
              <div className="text-xs font-medium opacity-75">{style.label}</div>
              <div className="text-3xl font-display font-bold mt-1">{count}</div>
              <div className="text-[11px] opacity-60 mt-0.5">products</div>
            </div>
          );
        })}
      </div>

      {/* Pipeline Gantt */}
      <div className="chart-container overflow-x-auto">
        <h3 className="font-display font-semibold text-gray-800 mb-4">Business development progress</h3>
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 font-medium text-gray-600 w-40">Product</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600 w-44">Supplier</th>
              {MONTHS_SHORT.map((m, i) => (
                <th
                  key={i}
                  className={`text-center py-2 px-1 font-medium text-gray-500 w-16 ${
                    i + 1 === period ? 'bg-pharma-50 text-pharma-700 rounded-t-lg' : ''
                  }`}
                >
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pipeline.map((product, idx) => (
              <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50/50">
                <td className="py-2 px-3 font-medium text-gray-800">{product.product_name}</td>
                <td className="py-2 px-3 text-gray-500 text-xs">
                  {product.supplier}
                  <span className="text-gray-400 ml-1">({product.country_origin})</span>
                </td>
                {MONTHS_SHORT.map((_, monthIdx) => {
                  const monthData = product.months?.[monthIdx + 1];
                  if (!monthData) {
                    return (
                      <td key={monthIdx} className={`py-1.5 px-0.5 ${monthIdx + 1 === period ? 'bg-pharma-50/50' : ''}`}>
                        <div className="h-7 rounded bg-gray-50" />
                      </td>
                    );
                  }
                  const stage = STAGE_COLORS[monthData.stage_order] || STAGE_COLORS[1];
                  return (
                    <td key={monthIdx} className={`py-1.5 px-0.5 ${monthIdx + 1 === period ? 'bg-pharma-50/50' : ''}`}>
                      <div
                        className={`h-7 rounded ${stage.bg} ${stage.text} flex items-center justify-center text-[9px] font-medium leading-tight`}
                        title={`${monthData.stage_name}${monthData.status_text ? ': ' + monthData.status_text : ''}`}
                      >
                        {monthData.stage_order}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-gray-100">
          {Object.entries(STAGE_COLORS).map(([order, style]) => (
            <div key={order} className="flex items-center gap-1.5">
              <div className={`w-5 h-5 rounded ${style.bg} flex items-center justify-center text-[10px] font-bold ${style.text}`}>
                {order}
              </div>
              <span className="text-xs text-gray-500">{style.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

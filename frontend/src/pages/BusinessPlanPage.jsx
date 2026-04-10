import { useEffect, useState } from 'react';
import { Plus, Trash2, Save, FileSpreadsheet } from 'lucide-react';
import TopBar from '../components/layout/TopBar';
import Loading from '../components/common/Loading';
import { eisApi } from '../utils/api';
import useDashboardStore from '../stores/dashboardStore';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec_val'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function BusinessPlanPage() {
  const { year } = useDashboardStore();
  const [plans, setPlans] = useState([]);
  const [types, setTypes] = useState([]);
  const [selectedType, setSelectedType] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fiscal_year: year,
    plan_type: '',
    category: '',
    sub_category: '',
    jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
    jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec_val: 0,
  });
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [tRes, pRes] = await Promise.all([
          eisApi.getBpTypes(),
          eisApi.getBpList(year, selectedType || undefined),
        ]);
        setTypes(tRes.data.data || []);
        setPlans(pRes.data.data || []);
      } catch (err) {
        console.error('Failed to load BP:', err);
      }
      setLoading(false);
    };
    load();
  }, [year, selectedType]);

  const handleSave = async () => {
    if (!form.plan_type || !form.category) return;
    setSaving(true);
    try {
      await eisApi.saveBp({ ...form, fiscal_year: year });
      const res = await eisApi.getBpList(year, selectedType || undefined);
      setPlans(res.data.data || []);
      setShowForm(false);
      setForm({ ...form, category: '', sub_category: '', jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec_val: 0 });
    } catch (err) {
      alert('Failed to save: ' + (err.response?.data?.detail || err.message));
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this entry?')) return;
    try {
      await eisApi.deleteBp(id);
      setPlans(plans.filter((p) => p.id !== id));
    } catch (err) {
      alert('Failed to delete');
    }
  };

  const total = MONTHS.reduce((s, m) => s + Number(form[m] || 0), 0);

  if (loading) return <Loading />;

  return (
    <div>
      <TopBar title="Business plan entry" />

      {/* Filter & Add */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <FileSpreadsheet size={18} className="text-pharma-500" />
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm shadow-sm"
          >
            <option value="">All Types</option>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-pharma-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-pharma-800 transition-colors"
        >
          <Plus size={16} />
          Add entry
        </button>
      </div>

      {/* Entry Form */}
      {showForm && (
        <div className="chart-container mb-6">
          <h3 className="font-display font-semibold text-gray-800 mb-4">New business plan entry</h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
            <select
              value={form.plan_type}
              onChange={(e) => setForm({ ...form, plan_type: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Select type...</option>
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input
              type="text" placeholder="Category (e.g. Local Public)"
              value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="text" placeholder="Sub-category (optional)"
              value={form.sub_category} onChange={(e) => setForm({ ...form, sub_category: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
            <div className="flex items-center gap-2 text-sm text-gray-500">
              Total: <span className="font-mono font-bold text-pharma-700">{total.toLocaleString('id-ID', { maximumFractionDigits: 2 })}</span>
            </div>
          </div>
          <div className="grid grid-cols-6 sm:grid-cols-12 gap-2 mb-4">
            {MONTHS.map((m, i) => (
              <div key={m}>
                <label className="text-[10px] text-gray-400 block mb-1">{MONTH_LABELS[i]}</label>
                <input
                  type="number" step="0.01" value={form[m]}
                  onChange={(e) => setForm({ ...form, [m]: Number(e.target.value) || 0 })}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-mono text-right"
                />
              </div>
            ))}
          </div>
          <button
            onClick={handleSave} disabled={saving || !form.plan_type || !form.category}
            className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      )}

      {/* Data Table */}
      <div className="chart-container overflow-x-auto">
        <table className="w-full min-w-[1000px] text-sm">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-2 px-2 font-medium text-gray-600">Type</th>
              <th className="text-left py-2 px-2 font-medium text-gray-600">Category</th>
              <th className="text-left py-2 px-2 font-medium text-gray-600">Sub</th>
              {MONTH_LABELS.map((m) => (
                <th key={m} className="text-right py-2 px-1 font-medium text-gray-500 w-16">{m}</th>
              ))}
              <th className="text-right py-2 px-2 font-medium text-gray-600">Total</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {plans.length === 0 ? (
              <tr><td colSpan={16} className="py-10 text-center text-gray-400">No entries yet. Click "Add entry" to start.</td></tr>
            ) : (
              plans.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                  <td className="py-2 px-2 font-medium text-pharma-700">{p.plan_type}</td>
                  <td className="py-2 px-2 text-gray-700">{p.category}</td>
                  <td className="py-2 px-2 text-gray-500 text-xs">{p.sub_category || '—'}</td>
                  {['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].map((m) => (
                    <td key={m} className="py-2 px-1 text-right font-mono text-xs text-gray-600">
                      {Number(p[m] || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                    </td>
                  ))}
                  <td className="py-2 px-2 text-right font-mono text-xs font-bold text-gray-800">
                    {Number(p.total || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="py-2 px-1">
                    <button onClick={() => handleDelete(p.id)} className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

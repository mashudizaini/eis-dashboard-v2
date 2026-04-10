import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function KpiCard({ title, value, unit, target, icon: Icon, color = 'pharma' }) {
  const numValue = parseFloat(value) || 0;
  const numTarget = parseFloat(target);
  const hasTarget = !isNaN(numTarget) && numTarget > 0;
  const achievement = hasTarget ? (numValue / numTarget * 100) : null;

  const colorMap = {
    pharma: { bg: 'bg-pharma-50', icon: 'text-pharma-600', ring: 'ring-pharma-200' },
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', ring: 'ring-emerald-200' },
    amber: { bg: 'bg-amber-50', icon: 'text-amber-600', ring: 'ring-amber-200' },
    coral: { bg: 'bg-orange-50', icon: 'text-orange-600', ring: 'ring-orange-200' },
  };
  const c = colorMap[color] || colorMap.pharma;

  return (
    <div className="kpi-card group">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg ${c.bg} flex items-center justify-center ring-1 ${c.ring}`}>
          {Icon && <Icon size={20} className={c.icon} />}
        </div>
        {achievement !== null && (
          <span
            className={`badge ${
              achievement >= 90 ? 'badge-success' : achievement >= 70 ? 'badge-warning' : 'badge-danger'
            }`}
          >
            {achievement >= 100 ? <TrendingUp size={12} /> : achievement >= 90 ? <Minus size={12} /> : <TrendingDown size={12} />}
            <span className="ml-1">{achievement.toFixed(1)}%</span>
          </span>
        )}
      </div>
      <div className="text-[13px] text-gray-500 font-medium mb-1">{title}</div>
      <div className="font-display text-2xl font-bold text-gray-900">
        {typeof value === 'number' ? value.toLocaleString('id-ID', { maximumFractionDigits: 1 }) : value}
        {unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </div>
      {hasTarget && (
        <div className="mt-2">
          <div className="flex justify-between text-[11px] text-gray-400 mb-1">
            <span>vs BP</span>
            <span>{numTarget.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                achievement >= 90 ? 'bg-emerald-500' : achievement >= 70 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(achievement, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

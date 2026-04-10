import { NavLink } from 'react-router-dom';
import logoOnly from '../../assets/LOGO-ONLY.png';
import {
  LayoutDashboard, TrendingUp, Factory, Rocket, Building2,
  FileSpreadsheet, Settings, LogOut, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import useAuthStore from '../../stores/authStore';

const NAV_ITEMS = [
  { path: '/', label: 'Summary', icon: LayoutDashboard },
  { path: '/performance', label: 'Performance', icon: TrendingUp },
  { path: '/production', label: 'Production', icon: Factory },
  { path: '/expansion', label: 'Business Expansion', icon: Rocket },
  { path: '/administration', label: 'Administration', icon: Building2 },
  { path: '/business-plan', label: 'Business Plan Entry', icon: FileSpreadsheet },
  { path: '/etl', label: 'ETL Management', icon: Settings },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuthStore();

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-pharma-950 text-white flex flex-col z-40 transition-all duration-300 ${
        collapsed ? 'w-[68px]' : 'w-[260px]'
      }`}
    >
      {/* Logo */}
      <div className="px-4 py-5 border-b border-pharma-800 flex items-center gap-3">
        <img src={logoOnly} alt="Logo" className="w-9 h-9 object-contain shrink-0" />
        {!collapsed && (
          <div className="overflow-hidden">
            <div className="font-display font-semibold text-sm leading-tight">EIS Dashboard</div>
            <div className="text-[11px] text-pharma-400 leading-tight">PT CKD OTTO Pharma</div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto scrollbar-thin">
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className={({ isActive }) =>
              `nav-item ${isActive ? 'nav-item-active' : 'nav-item-inactive'}`
            }
            title={collapsed ? label : undefined}
          >
            <Icon size={18} className="shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User & Collapse */}
      <div className="border-t border-pharma-800 p-3 space-y-2">
        {!collapsed && user && (
          <div className="px-2 py-1.5">
            <div className="text-sm font-medium truncate">{user.name}</div>
            <div className="text-[11px] text-pharma-400 truncate">{user.email}</div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={logout}
            className="nav-item nav-item-inactive flex-1 justify-center text-red-300 hover:text-red-200 hover:bg-red-900/30"
            title="Logout"
          >
            <LogOut size={18} />
            {!collapsed && <span>Logout</span>}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 rounded-lg hover:bg-pharma-800 text-pharma-400 hover:text-white transition-colors"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      </div>
    </aside>
  );
}

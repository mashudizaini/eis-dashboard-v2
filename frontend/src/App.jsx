import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import useAuthStore from './stores/authStore';
import Sidebar from './components/layout/Sidebar';
import SummaryPage from './pages/SummaryPage';
import PerformancePage from './pages/PerformancePage';
import ProductionPage from './pages/ProductionPage';
import ExpansionPage from './pages/ExpansionPage';
import AdministrationPage from './pages/AdministrationPage';
import BusinessPlanPage from './pages/BusinessPlanPage';
import EtlPage from './pages/EtlPage';
import DailySalesPage from './pages/DailySalesPage';

function AuthGate({ children }) {
  const { init, authenticated, loading } = useAuthStore();

  useEffect(() => {
    init();
  }, [init]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-pharma-950 to-pharma-800">
        <div className="w-16 h-16 rounded-2xl bg-accent-gold flex items-center justify-center font-display font-bold text-pharma-950 text-2xl mb-4 shadow-lg">
          EIS
        </div>
        <div className="w-8 h-8 border-2 border-pharma-400 border-t-accent-gold rounded-full animate-spin mb-3" />
        <p className="text-pharma-300 text-sm">Connecting to authentication...</p>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-pharma-950 to-pharma-800">
        <div className="text-white text-center">
          <p className="text-lg mb-4">Authentication required</p>
          <button
            onClick={() => useAuthStore.getState().keycloak.login()}
            className="bg-accent-gold text-pharma-950 px-6 py-2 rounded-lg font-semibold hover:bg-yellow-400 transition-colors"
          >
            Sign in with Keycloak
          </button>
        </div>
      </div>
    );
  }

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthGate>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 ml-[260px] p-6 transition-all duration-300">
            <Routes>
              <Route path="/" element={<SummaryPage />} />
              <Route path="/daily-sales" element={<DailySalesPage />} />
              <Route path="/performance" element={<PerformancePage />} />
              <Route path="/production" element={<ProductionPage />} />
              <Route path="/expansion" element={<ExpansionPage />} />
              <Route path="/administration" element={<AdministrationPage />} />
              <Route path="/business-plan" element={<BusinessPlanPage />} />
              <Route path="/etl" element={<EtlPage />} />
            </Routes>
          </main>
        </div>
      </AuthGate>
    </BrowserRouter>
  );
}

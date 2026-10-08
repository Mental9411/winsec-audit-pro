import { useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';

import Landing from './pages/Landing';
import ScanScreen from './pages/ScanScreen';
import Dashboard from './pages/Dashboard';
import AuditModules from './pages/AuditModules';
import LiveTerminal from './pages/LiveTerminal';
import AIAssistant from './pages/AIAssistant';
import Reports from './pages/Reports';
import SearchPage from './pages/SearchPage';
import SettingsPage from './pages/SettingsPage';

const TITLES = {
  '/': 'Windows Security Audit Pro',
  '/dashboard': 'Dashboard',
  '/scan': 'Live Security Audit',
  '/modules': 'Audit Modules',
  '/terminal': 'Live Terminal',
  '/ai': 'AI Security Assistant',
  '/reports': 'Reports',
  '/search': 'Global Search',
  '/settings': 'Settings',
};

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const title = TITLES[location.pathname] || 'Windows Security Audit Pro';

  return (
    <div className="min-h-screen flex">
      <div className="cyber-bg" />
      <div className="cyber-grid" />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar onMenuClick={() => setSidebarOpen(true)} title={title} />
        <main className="flex-1 p-4 lg:p-8 max-w-[1500px] w-full mx-auto">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/scan" element={<ScanScreen />} />
            <Route path="/modules" element={<AuditModules />} />
            <Route path="/terminal" element={<LiveTerminal />} />
            <Route path="/ai" element={<AIAssistant />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

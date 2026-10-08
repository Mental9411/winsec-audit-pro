import { NavLink } from 'react-router-dom';
import {
  Home, LayoutDashboard, ScanLine, ListChecks, Terminal, Bot, FileText,
  Search, Settings, ShieldCheck,
} from 'lucide-react';

const NAV_GROUPS = [
  { label: 'Overview', items: [
    { to: '/', label: 'Landing', icon: Home },
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ]},
  { label: 'Audit', items: [
    { to: '/scan', label: 'Live Scan', icon: ScanLine },
    { to: '/modules', label: 'Audit Modules', icon: ListChecks },
    { to: '/terminal', label: 'Live Terminal', icon: Terminal },
    { to: '/search', label: 'Global Search', icon: Search },
  ]},
  { label: 'Insights', items: [
    { to: '/ai', label: 'AI Assistant', icon: Bot },
    { to: '/reports', label: 'Reports', icon: FileText },
  ]},
  { label: 'System', items: [
    { to: '/settings', label: 'Settings', icon: Settings },
  ]},
];

export default function Sidebar({ open, onClose }) {
  return (
    <>
      {open && <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={onClose} />}
      <aside className={`fixed lg:sticky top-0 left-0 h-screen w-64 shrink-0 z-40 transition-transform duration-300
        glass-panel border-r border-white/5 flex flex-col
        ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#00FF88] to-[#00C8FF] flex items-center justify-center shadow-[0_0_18px_rgba(0,255,136,0.4)]">
            <ShieldCheck size={18} className="text-[#06120c]" />
          </div>
          <div>
            <div className="font-mono font-bold text-sm tracking-wider text-white leading-tight">WIN SEC AUDIT<span className="text-glow-green">.</span></div>
            <div className="font-mono text-[10px] tracking-[0.2em] text-[#5C6A85]">PRO EDITION</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-2">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-5">
              <div className="px-3 mb-1.5 font-mono text-[10px] tracking-[0.2em] text-[#4A5670] uppercase">{group.label}</div>
              <div className="space-y-0.5">
                {group.items.map(({ to, label, icon: Icon }) => (
                  <NavLink key={to} to={to} end={to === '/'} onClick={onClose}
                    className={({ isActive }) => `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                      ${isActive ? 'nav-active' : 'text-[#9AA6BC] hover:bg-white/5 hover:text-white'}`}>
                    <Icon size={16} />
                    {label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-white/5">
          <div className="flex items-center gap-2 font-mono text-[11px] text-[#5C6A85]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00FF88] pulse-glow" />
            v1.0.0 &middot; read-only audit engine
          </div>
        </div>
      </aside>
    </>
  );
}

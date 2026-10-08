import { useEffect, useState } from 'react';
import { Menu, Wifi, WifiOff, Bell } from 'lucide-react';
import { api } from '../lib/api';
import { wsClient } from '../lib/ws';

export default function Topbar({ onMenuClick, title }) {
  const [online, setOnline] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    let mounted = true;
    api.health().then(() => mounted && setOnline(true)).catch(() => mounted && setOnline(false));
    const off = wsClient.on('notification', (payload) => {
      setNotifications((prev) => [{ ...payload, id: Date.now() + Math.random() }, ...prev].slice(0, 20));
    });
    return () => { mounted = false; off(); };
  }, []);

  const critCount = notifications.filter((n) => n.severity === 'critical' || n.severity === 'high').length;

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 px-4 lg:px-8 py-4 glass border-b border-white/5 rounded-none">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="lg:hidden btn-ghost !p-2"><Menu size={18} /></button>
        <h1 className="font-mono text-base lg:text-lg font-semibold tracking-wide text-white">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative">
          <button onClick={() => setShowPanel((s) => !s)} className="btn-ghost !p-2 relative">
            <Bell size={16} />
            {critCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#FF3860] text-[9px] flex items-center justify-center font-mono">{critCount}</span>}
          </button>
          {showPanel && (
            <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto glass rounded-xl p-3 z-50">
              <div className="font-mono text-xs text-[#7C8AA6] uppercase tracking-wider mb-2">Notifications</div>
              {notifications.length === 0 ? (
                <div className="text-[#4A5670] text-sm font-mono py-4 text-center">No notifications yet.</div>
              ) : notifications.map((n) => (
                <div key={n.id} className="p-2.5 mb-1.5 rounded-lg bg-white/[0.03] border border-white/10">
                  <div className={`font-mono text-xs ${n.severity === 'critical' ? 'text-glow-red' : 'text-glow-orange'}`}>{n.title}</div>
                  <div className="font-mono text-[10px] text-[#5C6A85]">{n.module}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className={`flex items-center gap-1.5 font-mono text-xs px-2.5 py-1.5 rounded-full border
          ${online ? 'border-[#00FF88]/30 text-glow-green' : 'border-[#FF3860]/30 text-[#FF6B8B]'}`}>
          {online ? <Wifi size={13} /> : <WifiOff size={13} />}
          {online === null ? 'checking…' : online ? 'API online' : 'API offline'}
        </div>
      </div>
    </header>
  );
}

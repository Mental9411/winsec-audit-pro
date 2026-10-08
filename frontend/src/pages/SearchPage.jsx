import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import GlassCard from '../components/GlassCard';
import { api } from '../lib/api';

export default function SearchPage() {
  const [scan, setScan] = useState(null);
  const [query, setQuery] = useState('');

  useEffect(() => { api.latestScan().then((res) => setScan(res.scan)); }, []);

  const results = useMemo(() => {
    if (!scan || !query.trim()) return null;
    const q = query.toLowerCase();
    const r = scan.results || {};

    const processes = (r.processes?.data?.processes || []).filter((p) => p.name.toLowerCase().includes(q) || String(p.pid).includes(q));
    const ports = (r.open_ports?.data?.ports || []).filter((p) => p.local_address.includes(q) || p.foreign_address.includes(q) || String(p.pid).includes(q));
    const users = (r.users?.data?.usernames || []).filter((u) => u.toLowerCase().includes(q));
    const software = (r.software?.data?.software || []).filter((s) => s.name.toLowerCase().includes(q) || s.vendor.toLowerCase().includes(q));

    return { processes, ports, users, software };
  }, [scan, query]);

  return (
    <div className="space-y-6">
      <GlassCard accent="blue">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5C6A85]" />
          <input className="input-cyber !pl-9" placeholder="Search processes, ports, users, software…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </GlassCard>

      {!query.trim() ? (
        <div className="text-[#4A5670] font-mono text-sm text-center py-12">Type to search across your latest scan results.</div>
      ) : !results ? (
        <div className="text-[#4A5670] font-mono text-sm text-center py-12">No scan data available yet.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ResultBlock title="Processes" accent="green" items={results.processes.map((p) => `${p.name} (PID ${p.pid})`)} />
          <ResultBlock title="Open Ports" accent="orange" items={results.ports.map((p) => `${p.protocol} ${p.local_address} → ${p.foreign_address} [${p.state}]`)} />
          <ResultBlock title="Users" accent="purple" items={results.users} />
          <ResultBlock title="Software" accent="blue" items={results.software.map((s) => `${s.name} ${s.version} (${s.vendor})`)} />
        </div>
      )}
    </div>
  );
}

function ResultBlock({ title, accent, items }) {
  return (
    <GlassCard title={`${title} (${items.length})`} accent={accent}>
      {items.length === 0 ? (
        <div className="text-[#4A5670] font-mono text-xs py-4 text-center">No matches</div>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {items.map((it, i) => <div key={i} className="font-mono text-xs text-[#C9D3E3] p-2 rounded bg-white/[0.03] border border-white/5">{it}</div>)}
        </div>
      )}
    </GlassCard>
  );
}

import { useEffect, useMemo, useState } from 'react';
import {
  Users, ShieldHalf, Wifi, Cpu, CalendarClock, Rocket, ShieldAlert, Bug,
  KeyRound, FolderOpen, Package, Network, Info, AlertTriangle, Skull,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import GlassCard from '../components/GlassCard';
import DataTable from '../components/DataTable';
import SeverityBadge from '../components/SeverityBadge';
import { api } from '../lib/api';

const TABS = [
  { key: 'users', label: 'User Accounts', icon: Users },
  { key: 'admin_group', label: 'Admin Group', icon: ShieldHalf },
  { key: 'open_ports', label: 'Open Ports', icon: Wifi },
  { key: 'processes', label: 'Processes', icon: Cpu },
  { key: 'scheduled_tasks', label: 'Scheduled Tasks', icon: CalendarClock },
  { key: 'startup', label: 'Startup Programs', icon: Rocket },
  { key: 'firewall', label: 'Firewall', icon: ShieldAlert },
  { key: 'defender', label: 'Defender', icon: Bug },
  { key: 'password_policy', label: 'Password Policy', icon: KeyRound },
  { key: 'shares', label: 'Shared Folders', icon: FolderOpen },
  { key: 'software', label: 'Installed Software', icon: Package },
  { key: 'arp_table', label: 'ARP Table', icon: Network },
  { key: 'system_info', label: 'System Info', icon: Info },
];

const PIE_COLORS = ['#00FF88', '#00C8FF', '#8B5CF6', '#FF8A2B', '#FF3860', '#7C8AA6'];

export default function AuditModules() {
  const [scan, setScan] = useState(null);
  const [active, setActive] = useState('users');
  const [error, setError] = useState('');

  const load = () => api.latestScan().then((res) => setScan(res.scan)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const findingsByModule = useMemo(() => {
    const map = {};
    (scan?.findings || []).forEach((f) => { (map[f.module] ||= []).push(f); });
    return map;
  }, [scan]);

  if (error) return <GlassCard accent="red"><div className="text-[#FF6B8B] font-mono text-sm">{error}</div></GlassCard>;
  if (!scan) return <div className="text-[#5C6A85] font-mono text-sm">Loading latest scan…</div>;

  const moduleResult = scan.results[active] || {};
  const moduleFindings = findingsByModule[active] || [];

  return (
    <div className="space-y-6">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {TABS.map(({ key, label, icon: Icon }) => {
          const count = findingsByModule[key]?.length || 0;
          return (
            <button key={key} onClick={() => setActive(key)}
              className={`shrink-0 flex items-center gap-1.5 font-mono text-xs px-3 py-2 rounded-lg border transition-colors
                ${active === key ? 'border-[#00FF88]/50 text-glow-green bg-[#00FF88]/10' : 'border-white/10 text-[#9AA6BC] hover:border-white/25'}`}>
              <Icon size={14} /> {label}
              {count > 0 && <span className="ml-1 px-1.5 rounded-full bg-white/10 text-[10px]">{count}</span>}
            </button>
          );
        })}
      </div>

      {!moduleResult.available && (
        <div className="glass rounded-xl p-4 flex items-start gap-3 border border-[#FFB020]/30">
          <AlertTriangle className="text-[#FFB020] mt-0.5" size={18} />
          <div className="text-sm text-[#C9D3E3] font-mono leading-relaxed">
            {moduleResult.error || 'This module is unavailable on the current host.'}
          </div>
        </div>
      )}

      {moduleResult.available && (
        <ModuleBody moduleKey={active} data={moduleResult.data} findings={moduleFindings} onAction={load} />
      )}
    </div>
  );
}

function FindingsList({ findings }) {
  if (!findings.length) return null;
  return (
    <GlassCard title={`Findings (${findings.length})`} accent="orange">
      <div className="space-y-2 max-h-56 overflow-y-auto">
        {findings.map((f, i) => (
          <div key={i} className="p-2.5 rounded-lg bg-white/[0.03] border border-white/10">
            <div className="flex items-center gap-2 mb-1"><SeverityBadge severity={f.severity} /><span className="font-mono text-sm text-white">{f.title}</span></div>
            <div className="font-mono text-xs text-[#7C8AA6]">{f.description}</div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

function ModuleBody({ moduleKey, data, findings, onAction }) {
  switch (moduleKey) {
    case 'users': return <UsersView data={data} findings={findings} />;
    case 'admin_group': return <AdminGroupView data={data} findings={findings} />;
    case 'open_ports': return <PortsView data={data} findings={findings} />;
    case 'processes': return <ProcessesView data={data} findings={findings} onAction={onAction} />;
    case 'scheduled_tasks': return <ScheduledTasksView data={data} findings={findings} />;
    case 'startup': return <StartupView data={data} findings={findings} onAction={onAction} />;
    case 'firewall': return <FirewallView data={data} findings={findings} />;
    case 'defender': return <DefenderView data={data} findings={findings} />;
    case 'password_policy': return <PasswordPolicyView data={data} findings={findings} />;
    case 'shares': return <SharesView data={data} findings={findings} />;
    case 'software': return <SoftwareView data={data} findings={findings} />;
    case 'arp_table': return <ArpView data={data} findings={findings} />;
    case 'system_info': return <SystemInfoView data={data} />;
    default: return null;
  }
}

function UsersView({ data, findings }) {
  const rows = (data.usernames || []).map((u) => ({ username: u, ...(data.details?.[u] || {}) }));
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <GlassCard title="Accounts" icon={Users} accent="green" className="lg:col-span-2">
        <DataTable
          columns={[
            { key: 'username', label: 'Username' },
            { key: 'account_active', label: 'Active' },
            { key: 'password_required', label: 'Password Req.' },
            { key: 'last_logon', label: 'Last Logon' },
          ]}
          rows={rows}
          searchPlaceholder="Search users…"
        />
      </GlassCard>
      <div className="space-y-4">
        <GlassCard title="Summary" accent="blue">
          <div className="font-mono text-sm text-[#C9D3E3]">Total accounts: <span className="text-glow-blue">{data.total}</span></div>
        </GlassCard>
        <FindingsList findings={findings} />
      </div>
    </div>
  );
}

function AdminGroupView({ data, findings }) {
  const rows = (data.members || []).map((m) => ({ member: m }));
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <GlassCard title="Administrator Members" icon={ShieldHalf} accent="green" className="lg:col-span-2">
        <DataTable columns={[{ key: 'member', label: 'Account' }]} rows={rows} searchPlaceholder="Search members…" />
      </GlassCard>
      <FindingsList findings={findings} />
    </div>
  );
}

function PortsView({ data, findings }) {
  const rows = data.ports || [];
  const topPorts = useMemo(() => {
    const counts = {};
    rows.forEach((p) => { const port = p.local_address?.split(':').pop(); if (port) counts[port] = (counts[port] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([port, count]) => ({ port, count }));
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard title="Top Local Ports" accent="orange" className="lg:col-span-1">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topPorts} layout="vertical">
                <XAxis type="number" tick={{ fill: '#7C8AA6', fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="port" tick={{ fill: '#7C8AA6', fontSize: 10 }} width={50} />
                <Tooltip contentStyle={{ background: '#0d1420', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" fill="#FF8A2B" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
        <FindingsList findings={findings} />
      </div>
      <GlassCard title={`Open Ports (${data.total})`} icon={Wifi} accent="blue">
        <DataTable
          columns={[
            { key: 'protocol', label: 'Proto' },
            { key: 'local_address', label: 'Local Address' },
            { key: 'foreign_address', label: 'Foreign Address' },
            { key: 'state', label: 'State' },
            { key: 'pid', label: 'PID' },
          ]}
          rows={rows}
          searchPlaceholder="Search ports…"
        />
      </GlassCard>
    </div>
  );
}

function ProcessesView({ data, findings, onAction }) {
  const rows = data.processes || [];
  const [killing, setKilling] = useState(null);
  const [confirmPid, setConfirmPid] = useState(null);
  const [msg, setMsg] = useState('');

  const topMem = useMemo(() => [...rows].sort((a, b) => b.mem_kb - a.mem_kb).slice(0, 8).map((p) => ({ name: p.name, mem: Math.round(p.mem_kb / 1024) })), [rows]);

  const doKill = async (pid) => {
    setKilling(pid); setMsg('');
    try {
      await api.killProcess(Number(pid), true);
      setMsg(`Process ${pid} terminated.`);
      onAction?.();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setKilling(null);
      setConfirmPid(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard title="Top Memory Usage (MB)" accent="purple">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topMem} layout="vertical">
                <XAxis type="number" tick={{ fill: '#7C8AA6', fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#7C8AA6', fontSize: 9 }} width={90} />
                <Tooltip contentStyle={{ background: '#0d1420', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="mem" fill="#8B5CF6" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
        <FindingsList findings={findings} />
      </div>

      {msg && <div className="font-mono text-xs text-glow-green">{msg}</div>}

      <GlassCard title={`Running Processes (${data.total})`} icon={Cpu} accent="green">
        <DataTable
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'pid', label: 'PID' },
            { key: 'mem_kb', label: 'Mem (KB)' },
            { key: 'status', label: 'Status' },
            { key: 'user', label: 'User' },
            {
              key: 'kill', label: 'Action', render: (row) => (
                confirmPid === row.pid ? (
                  <span className="flex items-center gap-1.5">
                    <button className="btn-danger !py-1 !px-2 text-[10px]" disabled={killing === row.pid} onClick={() => doKill(row.pid)}>Confirm</button>
                    <button className="btn-ghost !py-1 !px-2 text-[10px]" onClick={() => setConfirmPid(null)}>Cancel</button>
                  </span>
                ) : (
                  <button className="btn-ghost !py-1 !px-2 text-[10px] flex items-center gap-1" onClick={() => setConfirmPid(row.pid)}>
                    <Skull size={11} /> Kill
                  </button>
                )
              ),
            },
          ]}
          rows={rows}
          searchPlaceholder="Search processes…"
        />
      </GlassCard>
    </div>
  );
}

function ScheduledTasksView({ data, findings }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <GlassCard title={`Scheduled Tasks (${data.total})`} icon={CalendarClock} accent="blue" className="lg:col-span-2">
        <DataTable
          columns={[
            { key: 'task_name', label: 'Task' },
            { key: 'author', label: 'Author' },
            { key: 'status', label: 'Status' },
            { key: 'next_run', label: 'Next Run' },
          ]}
          rows={data.tasks || []}
          searchPlaceholder="Search tasks…"
        />
      </GlassCard>
      <FindingsList findings={findings} />
    </div>
  );
}

function StartupView({ data, findings, onAction }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <GlassCard title={`Startup Programs (${data.total})`} icon={Rocket} accent="green" className="lg:col-span-2">
        <DataTable
          columns={[
            { key: 'caption', label: 'Program' },
            { key: 'command', label: 'Command' },
            { key: 'location', label: 'Location' },
            { key: 'user', label: 'User' },
          ]}
          rows={data.items || []}
          searchPlaceholder="Search startup items…"
        />
      </GlassCard>
      <FindingsList findings={findings} />
    </div>
  );
}

function FirewallView({ data, findings }) {
  const profiles = data.profiles || {};
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {Object.entries(profiles).map(([name, p]) => (
        <GlassCard key={name} title={`${name} profile`} icon={ShieldAlert} accent={p.state === 'ON' ? 'green' : 'red'}>
          <div className={`text-2xl font-mono font-bold ${p.state === 'ON' ? 'text-glow-green' : 'text-glow-red'}`}>{p.state}</div>
          {p.policy && <div className="font-mono text-xs text-[#7C8AA6] mt-2">{p.policy}</div>}
        </GlassCard>
      ))}
      <div className="lg:col-span-3"><FindingsList findings={findings} /></div>
    </div>
  );
}

function DefenderView({ data, findings }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <GlassCard title="Microsoft Defender" icon={Bug} accent={data.running ? 'green' : 'red'}>
        <div className={`text-3xl font-mono font-bold ${data.running ? 'text-glow-green' : 'text-glow-red'}`}>{data.state}</div>
        <div className="font-mono text-xs text-[#7C8AA6] mt-2">{data.running ? 'Real-time protection active' : 'Protection is not running - investigate immediately'}</div>
      </GlassCard>
      <div className="lg:col-span-2"><FindingsList findings={findings} /></div>
    </div>
  );
}

function PasswordPolicyView({ data, findings }) {
  const items = [
    ['Minimum length', data.min_password_length],
    ['Maximum age (days)', data.max_password_age],
    ['Minimum age (days)', data.min_password_age],
    ['Password history', data.password_history],
    ['Lockout threshold', data.lockout_threshold],
    ['Lockout duration (min)', data.lockout_duration],
  ];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <GlassCard title="Password Policy" icon={KeyRound} accent="purple" className="lg:col-span-2">
        <div className="grid grid-cols-2 gap-3">
          {items.map(([label, value]) => (
            <div key={label} className="p-3 rounded-lg bg-white/[0.03] border border-white/10">
              <div className="font-mono text-[10px] text-[#7C8AA6] uppercase tracking-wider mb-1">{label}</div>
              <div className="font-mono text-lg text-white">{value}</div>
            </div>
          ))}
        </div>
      </GlassCard>
      <FindingsList findings={findings} />
    </div>
  );
}

function SharesView({ data, findings }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <GlassCard title={`Shared Folders (${data.total})`} icon={FolderOpen} accent="blue" className="lg:col-span-2">
        <DataTable
          columns={[
            { key: 'name', label: 'Share' },
            { key: 'resource', label: 'Resource' },
            { key: 'remark', label: 'Remark' },
            { key: 'is_admin_share', label: 'Admin Share', render: (r) => (r.is_admin_share ? 'Yes' : 'No') },
          ]}
          rows={data.shares || []}
          searchPlaceholder="Search shares…"
        />
      </GlassCard>
      <FindingsList findings={findings} />
    </div>
  );
}

function SoftwareView({ data, findings }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <GlassCard title={`Installed Software (${data.total})`} icon={Package} accent="green" className="lg:col-span-2">
        <DataTable
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'vendor', label: 'Vendor' },
            { key: 'version', label: 'Version' },
          ]}
          rows={data.software || []}
          searchPlaceholder="Search software…"
        />
      </GlassCard>
      <FindingsList findings={findings} />
    </div>
  );
}

function ArpView({ data, findings }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <GlassCard title={`ARP Table (${data.total})`} icon={Network} accent="orange" className="lg:col-span-2">
        <DataTable
          columns={[
            { key: 'interface', label: 'Interface' },
            { key: 'ip', label: 'IP Address' },
            { key: 'mac', label: 'MAC Address' },
            { key: 'type', label: 'Type' },
          ]}
          rows={data.entries || []}
          searchPlaceholder="Search ARP entries…"
        />
      </GlassCard>
      <FindingsList findings={findings} />
    </div>
  );
}

function SystemInfoView({ data }) {
  const items = [
    ['Hostname', data.hostname], ['OS Name', data.os_name], ['OS Version', data.os_version],
    ['Architecture', data.architecture], ['Domain', data.domain], ['Boot Time', data.boot_time],
    ['BIOS Version', data.bios_version], ['Total RAM', data.total_ram],
  ];
  return (
    <GlassCard title="System Information" icon={Info} accent="blue">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map(([label, value]) => (
          <div key={label} className="p-3 rounded-lg bg-white/[0.03] border border-white/10">
            <div className="font-mono text-[10px] text-[#7C8AA6] uppercase tracking-wider mb-1">{label}</div>
            <div className="font-mono text-sm text-white break-words">{value || 'Unknown'}</div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

import { useEffect, useState } from 'react';
import { Users, Wifi, Cpu, ShieldAlert, KeyRound, Rocket, Activity, ListTree } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import GlassCard from '../components/GlassCard';
import ScoreGauge from '../components/ScoreGauge';
import { api } from '../lib/api';

const SEVERITY_COLORS = { critical: '#FF3860', high: '#FF8A2B', medium: '#FFB020', low: '#00C8FF', info: '#7C8AA6' };

function StatusCard({ label, value, sub, icon: Icon, accent, ok }) {
  const colorMap = { green: '#00FF88', blue: '#00C8FF', orange: '#FF8A2B', purple: '#8B5CF6', red: '#FF3860' };
  const color = ok === false ? colorMap.red : colorMap[accent];
  return (
    <GlassCard className="relative overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-mono text-[11px] tracking-widest text-[#7C8AA6] uppercase mb-1">{label}</div>
          <div className="text-xl font-bold font-mono" style={{ color }}>{value}</div>
          {sub && <div className="text-[11px] font-mono text-[#5C6A85] mt-0.5">{sub}</div>}
        </div>
        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center" style={{ color }}>
          <Icon size={18} />
        </div>
      </div>
    </GlassCard>
  );
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null);

  useEffect(() => { api.dashboardSummary().then(setSummary).catch(() => {}); }, []);

  if (!summary) return <div className="text-[#5C6A85] font-mono text-sm">Loading dashboard…</div>;

  if (!summary.has_scan) {
    return (
      <GlassCard title="No Scan Data" accent="orange">
        <div className="text-[#7C8AA6] font-mono text-sm py-8 text-center">
          Run a scan from the Landing page or Live Scan screen to populate the dashboard.
        </div>
      </GlassCard>
    );
  }

  const pieData = Object.entries(summary.counts).map(([severity, count]) => ({ name: severity, value: count })).filter((d) => d.value > 0);
  const moduleFindingData = Object.entries(summary.modules).map(([mod, data]) => ({ name: mod.replace('_', ' '), findings: data.finding_count }));

  const firewallProfiles = summary.firewall?.profiles || {};
  const defenderRunning = summary.defender?.running;
  const userCount = summary.users?.total ?? '—';
  const portCount = summary.open_ports?.total ?? '—';
  const processCount = summary.processes?.total ?? '—';
  const startupCount = summary.startup?.total ?? '—';
  const minPwLen = summary.password_policy?.min_password_length ?? '—';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard title="Overall Security Score" accent="green" className="flex flex-col items-center justify-center">
          <ScoreGauge score={summary.overall_score} label={summary.overall_label} />
          <div className="font-mono text-[11px] text-[#5C6A85] mt-3">Last scan: {new Date(summary.finished_at * 1000).toLocaleString()}</div>
        </GlassCard>

        <GlassCard title="Findings by Severity" accent="blue" className="lg:col-span-2">
          <div className="h-56 flex items-center">
            <ResponsiveContainer width="60%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {pieData.map((d) => <Cell key={d.name} fill={SEVERITY_COLORS[d.name]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#0d1420', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5">
              {Object.entries(summary.counts).map(([sev, count]) => (
                <div key={sev} className="flex items-center gap-2 font-mono text-xs">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: SEVERITY_COLORS[sev] }} />
                  <span className="text-[#C9D3E3] capitalize w-16">{sev}</span>
                  <span className="text-white font-semibold">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusCard label="Firewall" icon={ShieldAlert} accent="green"
          ok={!Object.values(firewallProfiles).some((p) => p.state === 'OFF')}
          value={Object.values(firewallProfiles).some((p) => p.state === 'OFF') ? 'AT RISK' : 'PROTECTED'}
          sub={Object.entries(firewallProfiles).map(([k, v]) => `${k}: ${v.state}`).join(' · ')} />
        <StatusCard label="Defender" icon={ShieldAlert} accent="blue" ok={defenderRunning}
          value={defenderRunning ? 'RUNNING' : 'STOPPED'} />
        <StatusCard label="Users" icon={Users} accent="purple" value={userCount} sub="local accounts" />
        <StatusCard label="Open Ports" icon={Wifi} accent="orange" value={portCount} sub="listening" />
        <StatusCard label="Processes" icon={Cpu} accent="green" value={processCount} sub="running now" />
        <StatusCard label="Startup Programs" icon={Rocket} accent="blue" value={startupCount} />
        <StatusCard label="Min Password Length" icon={KeyRound} accent="purple"
          ok={Number(minPwLen) >= 8} value={minPwLen} sub="characters" />
        <StatusCard label="Total Findings" icon={Activity} accent="red" value={summary.counts.critical + summary.counts.high + summary.counts.medium + summary.counts.low + summary.counts.info} />
      </div>

      <GlassCard title="Findings per Module" icon={ListTree} accent="purple">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={moduleFindingData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fill: '#7C8AA6', fontSize: 10, fontFamily: 'JetBrains Mono' }} interval={0} angle={-30} textAnchor="end" height={70} />
              <YAxis tick={{ fill: '#7C8AA6', fontSize: 10, fontFamily: 'JetBrains Mono' }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#0d1420', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="findings" fill="#8B5CF6" radius={[6, 6, 0, 0]} maxBarSize={34} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>
    </div>
  );
}

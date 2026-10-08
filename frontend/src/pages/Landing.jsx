import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, ScanLine, Zap, FileText, Bot, Activity, History } from 'lucide-react';
import GlassCard from '../components/GlassCard';
import ScoreGauge from '../components/ScoreGauge';
import { api } from '../lib/api';

export default function Landing() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);

  useEffect(() => { api.dashboardSummary().then(setSummary).catch(() => {}); }, []);

  const actions = [
    { label: 'Start Security Audit', icon: ScanLine, accent: 'btn-neon', onClick: () => navigate('/scan?type=full') },
    { label: 'Quick Scan', icon: Zap, accent: 'btn-ghost', onClick: () => navigate('/scan?type=quick') },
    { label: 'Deep Scan', icon: ShieldCheck, accent: 'btn-ghost', onClick: () => navigate('/scan?type=deep') },
    { label: 'Generate Report', icon: FileText, accent: 'btn-ghost', onClick: () => navigate('/reports') },
    { label: 'AI Assistant', icon: Bot, accent: 'btn-ghost', onClick: () => navigate('/ai') },
    { label: 'System Health', icon: Activity, accent: 'btn-ghost', onClick: () => navigate('/dashboard') },
  ];

  return (
    <div className="space-y-10">
      <div className="text-center pt-6 pb-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="mx-auto w-24 h-24 rounded-3xl bg-gradient-to-br from-[#00FF88] via-[#00C8FF] to-[#8B5CF6] flex items-center justify-center shadow-[0_0_60px_rgba(0,255,136,0.35)] mb-6"
        >
          <ShieldCheck size={44} className="text-[#06120c]" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="font-mono text-3xl lg:text-5xl font-bold tracking-tight text-white"
        >
          Windows Security <span className="text-glow-green">Audit</span> <span className="text-glow-blue">Pro</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          className="text-[#7C8AA6] mt-3 max-w-xl mx-auto"
        >
          Read-only Windows security auditing, risk scoring, and AI-assisted remediation —
          in the spirit of Defender Security Center, Wazuh, and CrowdStrike.
        </motion.p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {actions.map(({ label, icon: Icon, accent, onClick }) => (
          <button key={label} onClick={onClick} className={`${accent} flex flex-col items-center gap-2 !py-4`}>
            <Icon size={20} />
            <span className="text-xs text-center leading-tight">{label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard title="System Health" icon={Activity} accent="green" className="flex flex-col items-center justify-center">
          {summary?.has_scan ? (
            <ScoreGauge score={summary.overall_score} label={summary.overall_label} />
          ) : (
            <div className="text-[#4A5670] font-mono text-sm text-center py-8">
              No scan yet — run your first audit to see your security score.
            </div>
          )}
        </GlassCard>

        <GlassCard title="Recent Reports" icon={History} accent="blue" className="lg:col-span-2">
          {summary?.recent_scans?.length ? (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {summary.recent_scans.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.03] border border-white/10 font-mono text-xs">
                  <div>
                    <div className="text-white">{s.scan_type} scan</div>
                    <div className="text-[#5C6A85]">{new Date(s.started_at * 1000).toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={s.status === 'completed' ? 'text-glow-green' : s.status === 'failed' ? 'text-glow-red' : 'text-glow-orange'}>{s.status}</span>
                    {s.overall_score != null && <span className="text-[#7C8AA6]">{s.overall_score}/100</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[#4A5670] font-mono text-sm text-center py-8">No scans recorded yet.</div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}

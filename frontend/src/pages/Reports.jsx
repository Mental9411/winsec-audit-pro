import { useEffect, useState } from 'react';
import { FileText, FileJson, FileSpreadsheet, FileCode } from 'lucide-react';
import GlassCard from '../components/GlassCard';
import { api } from '../lib/api';

const FORMATS = [
  { key: 'pdf', label: 'PDF', icon: FileText },
  { key: 'html', label: 'HTML', icon: FileCode },
  { key: 'json', label: 'JSON', icon: FileJson },
  { key: 'csv', label: 'CSV', icon: FileSpreadsheet },
];

export default function Reports() {
  const [scans, setScans] = useState([]);

  useEffect(() => { api.scanHistory(100).then((res) => setScans(res.items)); }, []);

  return (
    <GlassCard title="Scan Reports" icon={FileText} accent="green">
      {scans.length === 0 ? (
        <div className="text-[#4A5670] font-mono text-sm py-12 text-center">No scans recorded yet — run an audit first.</div>
      ) : (
        <div className="space-y-2">
          {scans.map((s) => (
            <div key={s.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/10">
              <div className="font-mono text-xs">
                <div className="text-white text-sm">{s.scan_type.toUpperCase()} scan &middot; <span className="text-[#7C8AA6]">{s.id}</span></div>
                <div className="text-[#5C6A85] mt-0.5">
                  {new Date(s.started_at * 1000).toLocaleString()} &middot;
                  <span className={s.status === 'completed' ? ' text-glow-green' : s.status === 'failed' ? ' text-glow-red' : ' text-glow-orange'}> {s.status}</span>
                  {s.overall_score != null && <> &middot; score {s.overall_score}/100 ({s.overall_label})</>}
                </div>
              </div>
              {s.status === 'completed' && (
                <div className="flex gap-1.5 flex-wrap">
                  {FORMATS.map(({ key, label, icon: Icon }) => (
                    <a key={key} href={api.reportUrl(s.id, key)} className="btn-ghost !py-1.5 !px-2.5 text-[11px] flex items-center gap-1">
                      <Icon size={12} /> {label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}

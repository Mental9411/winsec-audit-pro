import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Play, Square, CheckCircle2, XCircle, Loader2, Radar } from 'lucide-react';
import GlassCard from '../components/GlassCard';
import { api } from '../lib/api';
import { wsClient } from '../lib/ws';

export default function ScanScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const initialType = params.get('type') || 'quick';

  const [scanType, setScanType] = useState(initialType);
  const [scanId, setScanId] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | running | completed | failed
  const [moduleStates, setModuleStates] = useState({}); // module -> {status, label, findingCount}
  const [progress, setProgress] = useState(0);
  const [lines, setLines] = useState([]);
  const [startedAt, setStartedAt] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState(null);
  const termRef = useRef(null);

  useEffect(() => {
    const offStarted = wsClient.on('scan:started', (p) => {
      setModuleStates({});
      setProgress(0);
      setStatus('running');
    });
    const offModStart = wsClient.on('module:start', (p) => {
      setModuleStates((prev) => ({ ...prev, [p.module]: { status: 'running', label: p.label } }));
    });
    const offModDone = wsClient.on('module:done', (p) => {
      setModuleStates((prev) => ({ ...prev, [p.module]: { ...prev[p.module], status: p.status, findingCount: p.finding_count, error: p.error } }));
      setProgress(p.progress);
    });
    const offTerminal = wsClient.on('terminal', (p) => setLines((prev) => [...prev.slice(-400), p.line]));
    const offCompleted = wsClient.on('scan:completed', (p) => {
      setStatus('completed');
      setResult(p);
    });
    const offCancelled = wsClient.on('scan:cancelled', () => setStatus('idle'));

    return () => { offStarted(); offModStart(); offModDone(); offTerminal(); offCompleted(); offCancelled(); };
  }, []);

  useEffect(() => {
    if (status !== 'running' || !startedAt) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [status, startedAt]);

  useEffect(() => { termRef.current?.scrollTo({ top: termRef.current.scrollHeight }); }, [lines]);

  const start = async () => {
    setLines([]);
    setResult(null);
    setStartedAt(Date.now());
    setElapsed(0);
    try {
      const res = await api.startScan(scanType);
      setScanId(res.scan_id);
      setStatus('running');
      const initial = {};
      res.modules.forEach((m) => { initial[m] = { status: 'pending', label: m }; });
      setModuleStates(initial);
    } catch (e) {
      setLines((prev) => [...prev, `[!] Failed to start scan: ${e.message}`]);
    }
  };

  const cancel = async () => {
    if (!scanId) return;
    await api.cancelScan(scanId);
  };

  const remainingEstimate = (() => {
    const total = Object.keys(moduleStates).length || 1;
    const done = Object.values(moduleStates).filter((m) => m.status === 'completed' || m.status === 'error').length;
    if (done === 0 || elapsed === 0) return '—';
    const perModule = elapsed / done;
    const remaining = Math.max(0, Math.round(perModule * (total - done)));
    return `${remaining}s`;
  })();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <select className="input-cyber !w-auto" value={scanType} onChange={(e) => setScanType(e.target.value)} disabled={status === 'running'}>
          <option value="quick">Quick Scan</option>
          <option value="deep">Deep Scan</option>
          <option value="full">Full Audit</option>
        </select>
        <button onClick={start} disabled={status === 'running'} className="btn-neon flex items-center gap-2">
          <Play size={15} /> Start Scan
        </button>
        <button onClick={cancel} disabled={status !== 'running'} className="btn-danger flex items-center gap-2">
          <Square size={15} /> Cancel
        </button>
        {status === 'completed' && result && (
          <button onClick={() => navigate('/dashboard')} className="btn-orange ml-auto">View Dashboard →</button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <GlassCard title="Scan Radar" icon={Radar} accent="green" className="flex flex-col items-center justify-center">
          <div className="relative w-40 h-40">
            <svg viewBox="0 0 200 200" className="w-full h-full">
              <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(0,255,136,0.15)" strokeWidth="1" />
              <circle cx="100" cy="100" r="60" fill="none" stroke="rgba(0,255,136,0.15)" strokeWidth="1" />
              <circle cx="100" cy="100" r="30" fill="none" stroke="rgba(0,255,136,0.15)" strokeWidth="1" />
              <line x1="100" y1="10" x2="100" y2="190" stroke="rgba(0,255,136,0.1)" />
              <line x1="10" y1="100" x2="190" y2="100" stroke="rgba(0,255,136,0.1)" />
              {status === 'running' && (
                <g className="radar-sweep" style={{ transformOrigin: '100px 100px' }}>
                  <path d="M100,100 L100,10 A90,90 0 0,1 163,37 Z" fill="rgba(0,255,136,0.18)" />
                </g>
              )}
              <circle cx="100" cy="100" r="4" fill="#00FF88" />
            </svg>
            {status === 'running' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-[#00FF88] radar-ping absolute" />
              </div>
            )}
          </div>
          <div className="mt-4 font-mono text-xs text-[#7C8AA6] text-center">
            <div>Elapsed: <span className="text-glow-green">{elapsed}s</span></div>
            <div>ETA: <span className="text-glow-blue">{status === 'running' ? remainingEstimate : '—'}</span></div>
          </div>
        </GlassCard>

        <GlassCard title="Module Progress" accent="blue" className="xl:col-span-2">
          <div className="progress-track mb-3">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
            {Object.entries(moduleStates).map(([mod, s]) => (
              <div key={mod} className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.03] border border-white/10 font-mono text-xs">
                <span className={s.status === 'completed' ? 'text-glow-green' : s.status === 'error' ? 'text-[#FF6B8B]' : 'text-[#C9D3E3]'}>{s.label || mod}</span>
                {s.status === 'running' && <Loader2 size={13} className="animate-spin text-glow-blue" />}
                {s.status === 'completed' && <CheckCircle2 size={13} className="text-glow-green" />}
                {s.status === 'error' && <XCircle size={13} className="text-[#FF6B8B]" />}
                {s.status === 'pending' && <span className="w-2 h-2 rounded-full bg-white/20" />}
              </div>
            ))}
            {Object.keys(moduleStates).length === 0 && (
              <div className="text-[#4A5670] font-mono text-sm col-span-2 text-center py-6">Select a scan type and press Start Scan.</div>
            )}
          </div>
        </GlassCard>
      </div>

      <GlassCard title="Terminal Output" accent="purple">
        <div className="terminal">
          <div className="terminal-header">
            <span className="terminal-dot bg-[#FF5F56]" /><span className="terminal-dot bg-[#FFBD2E]" /><span className="terminal-dot bg-[#27C93F]" />
            <span className="ml-2 text-[#5C6A85] text-xs">winsec-audit@localhost:~$</span>
          </div>
          <div ref={termRef} className="p-4 h-64 overflow-y-auto">
            {lines.length === 0 ? <div className="text-[#4A5670]">Waiting for scan output…</div> :
              lines.map((l, i) => <div key={i} className="text-[#B7F5CE] whitespace-pre-wrap break-all">{l}</div>)}
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Terminal as TerminalIcon, Trash2, Download, Wifi, WifiOff } from 'lucide-react';
import GlassCard from '../components/GlassCard';
import { wsClient } from '../lib/ws';

export default function LiveTerminal() {
  // Seed from any backlog already broadcast before this page mounted (e.g.
  // a scan that ran while the user was on a different page) instead of
  // starting blank every time - that's what made this look "not working."
  const [lines, setLines] = useState(() => {
    const backlog = wsClient.getHistory('terminal').map((p) => p.line);
    return backlog.length > 0 ? backlog : ['[+] Windows Security Audit Pro live terminal ready.'];
  });
  const [connected, setConnected] = useState(wsClient.connected);
  const termRef = useRef(null);

  useEffect(() => {
    const offLine = wsClient.on('terminal', (p) => setLines((prev) => [...prev.slice(-1000), p.line]));
    const offStatus = wsClient.onStatus(setConnected);
    return () => { offLine(); offStatus(); };
  }, []);

  useEffect(() => { termRef.current?.scrollTo({ top: termRef.current.scrollHeight }); }, [lines]);

  const clear = () => setLines([]);
  const download = () => {
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `winsec-terminal-${Date.now()}.log`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <GlassCard title="Live Terminal" icon={TerminalIcon} accent="green"
      right={
        <span className={`flex items-center gap-1.5 font-mono text-[11px] px-2 py-0.5 rounded-full border
          ${connected ? 'border-[#00FF88]/30 text-glow-green' : 'border-[#FF3860]/30 text-[#FF6B8B]'}`}>
          {connected ? <Wifi size={11} /> : <WifiOff size={11} />}
          {connected ? 'live' : 'reconnecting…'}
        </span>
      }>
      <div className="terminal">
        <div className="terminal-header justify-between">
          <div className="flex items-center gap-2">
            <span className="terminal-dot bg-[#FF5F56]" /><span className="terminal-dot bg-[#FFBD2E]" /><span className="terminal-dot bg-[#27C93F]" />
            <span className="ml-2 text-[#5C6A85] text-xs">administrator@winsec-audit:~$</span>
          </div>
          <div className="flex gap-2">
            <button onClick={download} className="btn-ghost !py-1 !px-2 text-xs flex items-center gap-1"><Download size={12} /> Export</button>
            <button onClick={clear} className="btn-ghost !py-1 !px-2 text-xs flex items-center gap-1"><Trash2 size={12} /> Clear</button>
          </div>
        </div>
        <div ref={termRef} className="p-4 h-[560px] overflow-y-auto">
          {lines.map((l, i) => <div key={i} className="text-[#B7F5CE] whitespace-pre-wrap break-all">{l}</div>)}
          <span className="caret text-glow-green">▍</span>
        </div>
      </div>
    </GlassCard>
  );
}

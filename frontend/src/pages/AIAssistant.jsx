import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Send, User, Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import GlassCard from '../components/GlassCard';
import { api } from '../lib/api';

const SUGGESTIONS = [
  'Explain why port 445 is open and whether it is a risk',
  'Explain the weaknesses in my current password policy',
  'Recommend hardening steps for this system',
  'Generate a PowerShell remediation script for the critical findings',
  'Write an executive summary of this scan for management',
  'Explain the MITRE ATT&CK techniques relevant to my open findings',
];

export default function AIAssistant() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi, I'm your AI Security Assistant. I have context on your latest scan — ask me to explain a finding, suggest hardening steps, or generate a remediation script." },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages]);
  useEffect(() => { api.aiStatus().then(setStatus).catch(() => {}); }, []);

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setError('');
    const next = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const res = await api.aiChat(next.filter((m) => m.role !== 'system'));
      setMessages((prev) => [...prev, { role: 'assistant', content: res.reply }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {status && !status.available && (
        <div className="lg:col-span-4 glass rounded-xl p-4 flex items-start gap-3 border border-[#FFB020]/30">
          <AlertTriangle className="text-[#FFB020] mt-0.5 shrink-0" size={18} />
          <div className="text-sm text-[#C9D3E3] font-mono leading-relaxed">
            <strong className="text-[#FFB020]">AI provider not reachable:</strong> {status.message}{' '}
            <Link to="/settings" className="text-glow-blue underline underline-offset-2">Configure it in Settings →</Link>
          </div>
        </div>
      )}
      <div className="lg:col-span-3">
        <GlassCard title="AI Security Assistant" icon={Bot} accent="blue" className="flex flex-col h-[640px]">
          <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-1 mb-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${m.role === 'user' ? 'bg-[#00C8FF]/20 text-glow-blue' : 'bg-[#00FF88]/20 text-glow-green'}`}>
                  {m.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                </div>
                <div className={`max-w-[80%] p-3 rounded-xl text-sm font-mono whitespace-pre-wrap leading-relaxed
                  ${m.role === 'user' ? 'bg-[#00C8FF]/10 border border-[#00C8FF]/20 text-[#E7ECF5]' : 'bg-white/[0.03] border border-white/10 text-[#C9D3E3]'}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-[#7C8AA6] font-mono text-xs pl-9">
                <Loader2 size={13} className="animate-spin" /> Thinking…
              </div>
            )}
          </div>

          {error && <div className="text-xs font-mono text-[#FF6B8B] mb-2">{error}</div>}

          <div className="flex gap-2">
            <input
              className="input-cyber flex-1"
              placeholder="Ask about a finding, request a script, or ask for a summary…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
            />
            <button onClick={() => send()} disabled={!input.trim() || loading} className="btn-neon flex items-center gap-2 shrink-0">
              <Send size={15} />
            </button>
          </div>
        </GlassCard>
      </div>

      <GlassCard title="Suggestions" icon={Sparkles} accent="purple">
        <div className="space-y-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => send(s)} className="w-full text-left font-mono text-xs p-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-[#9AA6BC] hover:border-[#8B5CF6]/40 hover:text-white transition-colors">
              {s}
            </button>
          ))}
        </div>
        <p className="text-[10px] font-mono text-[#5C6A85] mt-4 leading-relaxed">
          Configure your AI provider (local Ollama, OpenAI-compatible, or Anthropic) in Settings.
          No API key ships with this app.
        </p>
      </GlassCard>
    </div>
  );
}

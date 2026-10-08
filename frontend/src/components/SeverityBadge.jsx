const SEVERITY_STYLES = {
  critical: { bg: 'bg-[#FF3860]/15', text: 'text-[#FF6B8B]', border: 'border-[#FF3860]/40', dot: 'bg-[#FF3860]' },
  high: { bg: 'bg-[#FF8A2B]/15', text: 'text-[#FF8A2B]', border: 'border-[#FF8A2B]/40', dot: 'bg-[#FF8A2B]' },
  medium: { bg: 'bg-[#FFB020]/15', text: 'text-[#FFB020]', border: 'border-[#FFB020]/40', dot: 'bg-[#FFB020]' },
  low: { bg: 'bg-[#00C8FF]/15', text: 'text-[#00C8FF]', border: 'border-[#00C8FF]/40', dot: 'bg-[#00C8FF]' },
  info: { bg: 'bg-[#7C8AA6]/15', text: 'text-[#9AA6BC]', border: 'border-[#7C8AA6]/40', dot: 'bg-[#7C8AA6]' },
};

export default function SeverityBadge({ severity, className = '' }) {
  const s = SEVERITY_STYLES[severity] || SEVERITY_STYLES.info;
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${s.bg} ${s.text} ${s.border} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {severity}
    </span>
  );
}

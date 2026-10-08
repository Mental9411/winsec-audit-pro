export default function ScoreGauge({ score = 0, label = '', size = 180 }) {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const offset = circumference * (1 - pct);

  const color = score >= 85 ? '#00FF88' : score >= 70 ? '#00C8FF' : score >= 50 ? '#FFB020' : score >= 30 ? '#FF8A2B' : '#FF3860';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth="12"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.5s ease', filter: `drop-shadow(0 0 8px ${color}80)` }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-mono text-4xl font-bold" style={{ color }}>{Math.round(score)}</span>
        <span className="font-mono text-[10px] text-[#7C8AA6] uppercase tracking-widest">{label || 'Score'}</span>
      </div>
    </div>
  );
}

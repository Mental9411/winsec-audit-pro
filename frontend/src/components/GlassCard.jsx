import { motion } from 'framer-motion';

const ACCENTS = {
  green: 'text-glow-green',
  blue: 'text-glow-blue',
  orange: 'text-glow-orange',
  purple: 'text-glow-purple',
  red: 'text-glow-red',
};

export default function GlassCard({ children, className = '', title, icon: Icon, accent = 'green', right, ...props }) {
  const accentColor = ACCENTS[accent];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={`glass rounded-2xl p-5 ${className}`}
      {...props}
    >
      {(title || right) && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {Icon && <Icon size={18} className={accentColor} />}
            {title && <h3 className={`font-mono text-sm tracking-wider uppercase ${accentColor}`}>{title}</h3>}
          </div>
          {right}
        </div>
      )}
      {children}
    </motion.div>
  );
}

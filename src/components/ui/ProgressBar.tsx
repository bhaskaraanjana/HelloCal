import React from 'react';

interface ProgressBarProps {
  label: string;
  value: number;
  max: number;
  color: string;
  glowColor: string;
  unit?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  label,
  value,
  max,
  color,
  glowColor,
  unit = 'g'
}) => {
  const percentage = Math.min(Math.round((value / (max || 1)) * 100), 120); // allow slight overflow visuals (up to 120%)
  const displayPercentage = Math.round((value / (max || 1)) * 100);

  return (
    <div style={{ marginBottom: '1rem', width: '100%' }}>
      {/* Labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', fontFamily: 'var(--font-display)', fontSize: '0.9rem' }}>
        <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
        <span style={{ marginLeft: 'auto', color: 'var(--text-primary)', fontWeight: 600 }}>
          {Math.round(value)}{unit} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>/ {max}{unit}</span>
        </span>
      </div>
      
      {/* Bar Track */}
      <div style={{
        height: '8px',
        width: '100%',
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: '99px',
        border: '1px solid var(--border-glass)',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {/* Animated Neon Fill */}
        <div style={{
          height: '100%',
          width: '100%',
          transform: `scaleX(${Math.max(percentage, 0) / 100})`,
          transformOrigin: 'left',
          backgroundColor: color,
          boxShadow: `0 0 10px ${glowColor}`,
          borderRadius: '99px',
          transition: 'transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
        }} />
      </div>
      
      {/* Over-budget warning */}
      {displayPercentage > 100 && (
        <div style={{
          textAlign: 'right',
          fontSize: '0.75rem',
          color: 'var(--accent-amber)',
          marginTop: '0.2rem',
          fontFamily: 'var(--font-display)'
        }}>
          Over budget by {displayPercentage - 100}%
        </div>
      )}
    </div>
  );
};
export default ProgressBar;

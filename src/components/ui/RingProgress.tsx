import React from 'react';

interface RingProgressProps {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  glowColor?: string;
  children?: React.ReactNode;
}

export const RingProgress: React.FC<RingProgressProps> = ({
  value,
  max,
  size = 200,
  strokeWidth = 14,
  color = 'var(--accent-purple)',
  glowColor = 'var(--accent-purple-glow)',
  children
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = Math.min(Math.max(value / (max || 1), 0), 1);
  const strokeDashoffset = circumference - percentage * circumference;

  // Over-budget state: shift the ring to a warning color and pulse it.
  const isOver = value > (max || 1);
  const ringColor = isOver ? 'var(--accent-rose)' : color;
  const ringGlow = isOver ? 'var(--accent-rose-glow)' : glowColor;

  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}>
        {/* Background Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="rgba(255, 255, 255, 0.04)"
          strokeWidth={strokeWidth}
        />
        {/* Glowing/Underlay Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={ringColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{
            filter: `drop-shadow(0 0 6px ${ringGlow})`,
            opacity: 0.8,
            transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
            animation: isOver ? 'ringPulseWarning 1.6s ease-in-out infinite' : undefined
          }}
        />
        {/* Foreground Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={ringColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        />
      </svg>
      {children && (
        <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          {children}
        </div>
      )}
    </div>
  );
};
export default RingProgress;

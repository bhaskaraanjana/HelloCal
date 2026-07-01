import React from 'react';

interface AnalyticsSparklineProps {
  values: number[];
  color?: string;
  height?: number;
  className?: string;
}

export const AnalyticsSparkline: React.FC<AnalyticsSparklineProps> = ({
  values,
  color = 'var(--accent-purple)',
  height = 36,
  className = '',
}) => {
  const width = 120;
  const max = Math.max(...values, 1);
  const points = values
    .map((v, i) => {
      const x = values.length <= 1 ? width / 2 : (i / (values.length - 1)) * width;
      const y = height - (v / max) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      className={`analytics-sparkline ${className}`.trim()}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {values.length > 1 && (
        <polygon
          points={`0,${height} ${points} ${width},${height}`}
          fill="url(#spark-fill)"
        />
      )}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

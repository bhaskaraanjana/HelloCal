import React from 'react';
import type { PeriodDelta } from '../../services/analyticsInsights';

interface StatItem {
  label: string;
  value: string;
  meta?: string;
  delta?: PeriodDelta;
  accent?: string;
}

interface AnalyticsStatStripProps {
  items: StatItem[];
}

export const AnalyticsStatStrip: React.FC<AnalyticsStatStripProps> = ({ items }) => (
  <div className="analytics-stat-strip glass-card motion-enter">
    {items.map((item) => (
      <div key={item.label} className="analytics-stat-strip-item">
        <span className="analytics-stat-strip-label">{item.label}</span>
        <span className="analytics-stat-strip-value" style={item.accent ? { color: item.accent } : undefined}>
          {item.value}
        </span>
        {item.delta && (
          <span className={`analytics-summary-delta analytics-summary-delta--${item.delta.tone}`}>
            {item.delta.text}
          </span>
        )}
        {item.meta && <span className="analytics-stat-strip-meta">{item.meta}</span>}
      </div>
    ))}
  </div>
);

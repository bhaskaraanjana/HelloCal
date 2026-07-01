import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { AnalyticsSparkline } from './AnalyticsSparkline';

interface AnalyticsSummaryCardProps {
  icon: LucideIcon;
  iconStyle: React.CSSProperties;
  kicker: string;
  value: React.ReactNode;
  meta?: string;
  delta?: { text: string; tone: 'up' | 'down' | 'flat' };
  sparkline?: number[];
  sparkColor?: string;
  ringPercent?: number;
  ringColor?: string;
  delay?: number;
}

export const AnalyticsSummaryCard: React.FC<AnalyticsSummaryCardProps> = ({
  icon: Icon,
  iconStyle,
  kicker,
  value,
  meta,
  delta,
  sparkline,
  sparkColor,
  ringPercent,
  ringColor = 'var(--accent-teal)',
  delay = 0,
}) => (
  <div
    className="glass-card analytics-summary-card motion-enter"
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className="analytics-summary-icon" style={iconStyle}>
      {ringPercent != null ? (
        <div
          className="analytics-summary-ring"
          style={{
            background: `conic-gradient(${ringColor} ${ringPercent * 3.6}deg, rgba(255,255,255,0.06) 0)`,
          }}
          aria-hidden
        >
          <span>{ringPercent}%</span>
        </div>
      ) : (
        <Icon size={22} aria-hidden />
      )}
    </div>
    <div className="analytics-summary-body">
      <span className="analytics-summary-kicker">{kicker}</span>
      <span className="analytics-summary-value">{value}</span>
      {delta && (
        <span className={`analytics-summary-delta analytics-summary-delta--${delta.tone}`}>
          {delta.text}
        </span>
      )}
      {meta && <span className="analytics-summary-meta">{meta}</span>}
      {sparkline && sparkline.length > 0 && (
        <AnalyticsSparkline values={sparkline} color={sparkColor} />
      )}
    </div>
  </div>
);

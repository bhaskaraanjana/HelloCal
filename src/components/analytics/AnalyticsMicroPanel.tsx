import React, { useMemo, useState } from 'react';
import type { CustomMicro } from '../../types/nutrition';
import { ChevronDown } from 'lucide-react';

const PREVIEW_COUNT = 5;

interface MicroAvg {
  micro: CustomMicro;
  avg: number;
}

interface AnalyticsMicroPanelProps {
  items: MicroAvg[];
  summaryLabel: string;
}

function microScore(micro: CustomMicro, avg: number): number {
  const target = micro.dailyLimit || 1;
  const pct = avg / target;
  if (micro.isLimit && avg > target) return 1000 + pct;
  if (!micro.isLimit && avg < target * 0.85) return 500 + (1 - pct);
  return pct;
}

function formatMicroValue(value: number, unit: string): string {
  if (unit === 'mg') return `${Math.round(value)}`;
  if (unit === 'mcg') return `${Math.round(value * 10) / 10}`;
  return `${Math.round(value * 10) / 10}`;
}

export const AnalyticsMicroPanel: React.FC<AnalyticsMicroPanelProps> = ({ items, summaryLabel }) => {
  const [expanded, setExpanded] = useState(false);

  const sorted = useMemo(
    () => [...items].sort((a, b) => microScore(b.micro, b.avg) - microScore(a.micro, a.avg)),
    [items]
  );

  if (sorted.length === 0) {
    return (
      <div className="analytics-chart-empty analytics-chart-empty--compact">
        <span>No micronutrients tracked.</span>
        <span className="analytics-summary-meta">Add micros in Dashboard settings.</span>
      </div>
    );
  }

  const visible = expanded ? sorted : sorted.slice(0, PREVIEW_COUNT);
  const hiddenCount = Math.max(0, sorted.length - PREVIEW_COUNT);

  return (
    <div className="analytics-micro-panel">
      <p className="analytics-micro-panel-intro">
        Daily averages for {summaryLabel.toLowerCase()}. We show the most notable first.
      </p>
      <ul className="analytics-micro-compact-list">
        {visible.map(({ micro, avg }) => {
          const target = micro.dailyLimit || 1;
          const pct = Math.min((avg / target) * 100, 100);
          const over = micro.isLimit && avg > target;
          const fill = over ? 'var(--accent-rose)' : micro.color;
          return (
            <li key={micro.id} className="analytics-micro-compact-row">
              <span className="analytics-micro-compact-name">
                {micro.emoji} {micro.name}
              </span>
              <span className="analytics-micro-compact-value">
                {formatMicroValue(avg, micro.unit)}
                {micro.unit}
                <span className="analytics-micro-compact-target">
                  {' '}
                  / {target}
                  {micro.unit}
                </span>
              </span>
              <div className="analytics-micro-compact-track" aria-hidden>
                <div
                  className="analytics-micro-compact-fill"
                  style={{ width: `${pct}%`, background: fill }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      {hiddenCount > 0 && (
        <button
          type="button"
          className="analytics-micro-expand-btn"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          <ChevronDown size={14} aria-hidden className={expanded ? 'is-flipped' : ''} />
          {expanded ? 'Show fewer' : `Show all ${sorted.length} micros`}
        </button>
      )}
    </div>
  );
};

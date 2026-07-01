import React from 'react';
import type { HeatmapCell } from '../../services/analyticsInsights';

interface AnalyticsHeatmapProps {
  cells: HeatmapCell[];
  onSelectDay?: (dayTs: number) => void;
}

const LEVEL_CLASS: Record<HeatmapCell['level'], string> = {
  0: 'analytics-heatmap-cell--0',
  1: 'analytics-heatmap-cell--1',
  2: 'analytics-heatmap-cell--2',
  3: 'analytics-heatmap-cell--3',
};

export const AnalyticsHeatmap: React.FC<AnalyticsHeatmapProps> = ({ cells, onSelectDay }) => (
  <div className="analytics-heatmap" role="img" aria-label="Daily calorie adherence heatmap">
    {cells.map((cell) => {
      const label = cell.date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      const title = `${label}: ${cell.calories} kcal`;
      return (
        <button
          key={cell.date.getTime()}
          type="button"
          className={`analytics-heatmap-cell ${LEVEL_CLASS[cell.level]}`}
          title={title}
          aria-label={title}
          onClick={() => onSelectDay?.(cell.date.getTime())}
        />
      );
    })}
  </div>
);

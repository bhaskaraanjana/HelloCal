import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import type { DayOfWeekBucket } from '../../services/analyticsInsights';
import { baseChartOptions } from '../../services/analyticsChartTheme';
import { resolveCssColor } from '../../services/trackingCatalog';

interface AnalyticsDayOfWeekProps {
  buckets: DayOfWeekBucket[];
  calorieGoal: number;
}

export const AnalyticsDayOfWeek: React.FC<AnalyticsDayOfWeekProps> = ({ buckets, calorieGoal }) => {
  const chartData = useMemo(
    () => ({
      labels: buckets.map((b) => b.label),
      datasets: [
        {
          label: 'Avg kcal',
          data: buckets.map((b) => b.avg),
          backgroundColor: buckets.map((b) => {
            if (b.avg <= 0) return 'rgba(255,255,255,0.06)';
            const diff = Math.abs(b.avg - calorieGoal);
            if (diff <= 150) return 'rgba(16, 185, 129, 0.55)';
            if (diff <= 300) return 'rgba(245, 158, 11, 0.5)';
            return 'rgba(139, 92, 246, 0.45)';
          }),
          borderColor: resolveCssColor('var(--accent-purple)'),
          borderWidth: 1.5,
          borderRadius: 6,
          barThickness: 22,
        },
      ],
    }),
    [buckets, calorieGoal]
  );

  return (
    <div className="analytics-chart-canvas analytics-chart-canvas--short">
      <Bar data={chartData} options={baseChartOptions()} />
    </div>
  );
};

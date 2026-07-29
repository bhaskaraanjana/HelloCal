import type { ChartOptions, Plugin } from 'chart.js';
import { resolveCssColor } from './trackingCatalog';

export const ANALYTICS_CHART_ANIMATION = {
  duration: 750,
  easing: 'easeOutQuart' as const,
};

export function analyticsTooltip() {
  return {
    backgroundColor: 'rgba(19, 21, 32, 0.96)',
    titleColor: '#f8fafc',
    bodyColor: '#aab6c7',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    padding: 12,
    cornerRadius: 10,
    titleFont: { family: 'Outfit', size: 12, weight: 'bold' as const },
    bodyFont: { family: 'Outfit', size: 11 },
  };
}

export function analyticsLegend() {
  return {
    position: 'top' as const,
    labels: {
      color: '#aab6c7',
      font: { family: 'Outfit', size: 11 },
      boxWidth: 10,
      boxHeight: 10,
      usePointStyle: true,
      pointStyle: 'circle' as const,
    },
  };
}

export function analyticsScales(xTickRotation = 0) {
  return {
    x: {
      grid: { display: false },
      ticks: {
        color: '#aab6c7',
        font: { family: 'Outfit', size: 10 },
        maxRotation: xTickRotation,
        minRotation: xTickRotation,
        autoSkip: true,
      },
    },
    y: {
      grid: { color: 'rgba(255, 255, 255, 0.045)' },
      border: { display: false },
      ticks: { color: '#aab6c7', font: { family: 'Outfit', size: 11 }, padding: 6 },
    },
  };
}

export function baseChartOptions(xTickRotation = 0): ChartOptions<'bar'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: ANALYTICS_CHART_ANIMATION,
    plugins: {
      legend: analyticsLegend(),
      tooltip: analyticsTooltip(),
    },
    scales: analyticsScales(xTickRotation),
  } as ChartOptions<'bar'>;
}

export interface DoughnutCenterText {
  primary: string;
  secondary?: string;
}

export function doughnutCenterTextPlugin(center: DoughnutCenterText): Plugin<'doughnut'> {
  return {
    id: `doughnut-center-${center.primary}`,
    beforeDraw(chart) {
      const { ctx, chartArea } = chart;
      if (!chartArea) return;
      const x = (chartArea.left + chartArea.right) / 2;
      const y = (chartArea.top + chartArea.bottom) / 2;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f8fafc';
      ctx.font = '800 1.35rem Outfit, system-ui, sans-serif';
      ctx.fillText(center.primary, x, y - (center.secondary ? 8 : 0));
      if (center.secondary) {
        ctx.fillStyle = '#8b9cb3';
        ctx.font = '600 0.68rem Outfit, system-ui, sans-serif';
        ctx.fillText(center.secondary, x, y + 14);
      }
      ctx.restore();
    },
  };
}

export function purpleBarGradient(): CanvasGradient | string {
  return 'rgba(139, 92, 246, 0.55)';
}

export function goalLineDataset(values: number[], label: string) {
  return {
    label,
    data: values,
    type: 'line' as const,
    borderColor: 'rgba(255, 255, 255, 0.55)',
    borderWidth: 2,
    borderDash: [5, 4],
    pointBackgroundColor: resolveCssColor('var(--accent-purple)'),
    pointBorderColor: '#fff',
    pointRadius: 3,
    pointHoverRadius: 5,
    fill: false,
    tension: 0.25,
  };
}

export function priorPeriodDataset(values: number[], label: string) {
  return {
    label,
    data: values,
    type: 'line' as const,
    borderColor: 'rgba(148, 163, 184, 0.45)',
    borderWidth: 2,
    borderDash: [2, 3],
    pointBackgroundColor: 'rgba(148, 163, 184, 0.45)',
    pointBorderColor: 'transparent',
    pointRadius: 0,
    pointHoverRadius: 0,
    fill: false,
    tension: 0.3,
  };
}

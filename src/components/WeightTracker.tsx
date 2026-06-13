import React, { useMemo, useRef, useState } from 'react';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Filler,
} from 'chart.js';
import type { ChartOptions, TooltipItem } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Scale, TrendingDown, TrendingUp, Trash2, Plus } from 'lucide-react';
import { kgToLb, lbToKg } from '../services/nutritionMath';
import type { BodyMetric } from '../types/nutrition';

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler);

interface WeightTrackerProps {
  metrics: BodyMetric[];
  preferredUnit: 'kg' | 'lb';
  onAddMetric: (weightKg: number, unit: 'kg' | 'lb', extra?: { bodyFat?: number; waist?: number }) => void;
  onDeleteMetric: (id: string) => void;
}

const ACCENT_PURPLE = '#8b5cf6';

/** Convert a canonical kg weight into the user's preferred display unit. */
const toDisplay = (kg: number, unit: 'kg' | 'lb'): number =>
  unit === 'lb' ? kgToLb(kg) : kg;

export const WeightTracker: React.FC<WeightTrackerProps> = ({
  metrics,
  preferredUnit,
  onAddMetric,
  onDeleteMetric,
}) => {
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [waist, setWaist] = useState('');
  const chartRef = useRef<ChartJS<'line'>>(null);

  // Sort ascending by timestamp for the chart / chronological stats.
  const sorted = useMemo(
    () => [...metrics].sort((a, b) => a.timestamp - b.timestamp),
    [metrics]
  );

  const hasData = sorted.length > 0;

  const first = hasData ? sorted[0] : null;
  const latest = hasData ? sorted[sorted.length - 1] : null;

  const latestDisplay = latest ? toDisplay(latest.weight, preferredUnit) : 0;
  const firstDisplay = first ? toDisplay(first.weight, preferredUnit) : 0;
  const changeDisplay = latestDisplay - firstDisplay; // negative = loss
  const isLoss = changeDisplay < 0;
  const isFlat = Math.abs(changeDisplay) < 0.05;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(weight);
    if (!Number.isFinite(parsed) || parsed <= 0) return;

    const weightKg = preferredUnit === 'lb' ? lbToKg(parsed) : parsed;

    const extra: { bodyFat?: number; waist?: number } = {};
    const bf = parseFloat(bodyFat);
    if (Number.isFinite(bf) && bf > 0) extra.bodyFat = bf;
    const w = parseFloat(waist);
    if (Number.isFinite(w) && w > 0) extra.waist = w;

    const hasExtra = extra.bodyFat !== undefined || extra.waist !== undefined;
    onAddMetric(weightKg, preferredUnit, hasExtra ? extra : undefined);

    setWeight('');
    setBodyFat('');
    setWaist('');
  };

  // Build the gradient fill lazily so it tracks the canvas context.
  const chartData = useMemo(() => {
    const labels = sorted.map((m) =>
      new Date(m.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    );
    const values = sorted.map((m) => Number(toDisplay(m.weight, preferredUnit).toFixed(1)));

    return {
      labels,
      datasets: [
        {
          label: `Weight (${preferredUnit})`,
          data: values,
          borderColor: ACCENT_PURPLE,
          borderWidth: 2.5,
          tension: 0.4,
          fill: true,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: ACCENT_PURPLE,
          pointBorderColor: 'rgba(255,255,255,0.85)',
          pointBorderWidth: 1,
          backgroundColor: (ctx: { chart: ChartJS }) => {
            const { chartArea, ctx: c } = ctx.chart;
            if (!chartArea) return 'rgba(139, 92, 246, 0.12)';
            const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, 'rgba(139, 92, 246, 0.35)');
            gradient.addColorStop(1, 'rgba(139, 92, 246, 0.0)');
            return gradient;
          },
        },
      ],
    };
  }, [sorted, preferredUnit]);

  const chartOptions = useMemo<ChartOptions<'line'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' as const },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(19, 21, 32, 0.95)',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          titleColor: '#e2e8f0',
          bodyColor: '#e2e8f0',
          padding: 10,
          cornerRadius: 10,
          displayColors: false,
          callbacks: {
            label: (item: TooltipItem<'line'>) => `${item.parsed.y} ${preferredUnit}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.05)', drawTicks: false },
          border: { display: false },
          ticks: { color: '#64748b', font: { size: 11 }, maxRotation: 0, autoSkipPadding: 16 },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)', drawTicks: false },
          border: { display: false },
          ticks: { color: '#64748b', font: { size: 11 } },
        },
      },
    }),
    [preferredUnit]
  );

  const recent = useMemo(() => [...sorted].reverse().slice(0, 5), [sorted]);

  return (
    <div
      className="glass-card"
      style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '38px',
            height: '38px',
            borderRadius: '12px',
            background: 'rgba(139, 92, 246, 0.12)',
            color: 'var(--accent-purple)',
            flexShrink: 0,
          }}
        >
          <Scale size={20} />
        </div>
        <div>
          <h3
            style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontSize: '1.1rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
            }}
          >
            Body Weight
          </h3>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Track your trend over time
          </p>
        </div>
      </div>

      {/* Add weight inline form */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.6rem',
          alignItems: 'flex-end',
        }}
      >
        <div className="input-group" style={{ flex: '1 1 130px', minWidth: 0, marginBottom: 0 }}>
          <label className="input-label" htmlFor="wt-weight">
            Weight ({preferredUnit})
          </label>
          <input
            id="wt-weight"
            className="input-field"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            placeholder={preferredUnit === 'lb' ? 'e.g. 165' : 'e.g. 75'}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            required
          />
        </div>

        <div className="input-group" style={{ flex: '1 1 100px', minWidth: 0, marginBottom: 0 }}>
          <label className="input-label" htmlFor="wt-bodyfat">
            Body Fat %
          </label>
          <input
            id="wt-bodyfat"
            className="input-field"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            max="100"
            placeholder="opt."
            value={bodyFat}
            onChange={(e) => setBodyFat(e.target.value)}
          />
        </div>

        <div className="input-group" style={{ flex: '1 1 100px', minWidth: 0, marginBottom: 0 }}>
          <label className="input-label" htmlFor="wt-waist">
            Waist (cm)
          </label>
          <input
            id="wt-waist"
            className="input-field"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            placeholder="opt."
            value={waist}
            onChange={(e) => setWaist(e.target.value)}
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}
        >
          <Plus size={16} />
          Log
        </button>
      </form>

      {hasData ? (
        <>
          {/* Stats row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.75rem',
            }}
          >
            <Stat
              label="Latest"
              value={`${latestDisplay.toFixed(1)} ${preferredUnit}`}
              color="var(--text-primary)"
            />
            <Stat
              label="Change"
              color={isFlat ? 'var(--text-secondary)' : isLoss ? 'var(--accent-teal)' : 'var(--accent-amber)'}
              icon={
                isFlat ? null : isLoss ? (
                  <TrendingDown size={15} />
                ) : (
                  <TrendingUp size={15} />
                )
              }
              value={`${isLoss ? '' : '+'}${changeDisplay.toFixed(1)} ${preferredUnit}`}
            />
            <Stat label="Entries" value={`${sorted.length}`} color="var(--text-primary)" />
          </div>

          {/* Trend chart */}
          <div style={{ height: '220px', width: '100%' }}>
            <Line ref={chartRef} data={chartData} options={chartOptions} />
          </div>

          {/* Recent entries */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <span
              style={{
                fontSize: '0.78rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
              }}
            >
              Recent Entries
            </span>
            {recent.map((m) => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-glass)',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    fontSize: '0.95rem',
                  }}
                >
                  {toDisplay(m.weight, preferredUnit).toFixed(1)} {preferredUnit}
                </span>
                {m.bodyFat !== undefined && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {m.bodyFat}% bf
                  </span>
                )}
                {m.waist !== undefined && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {m.waist}cm waist
                  </span>
                )}
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: '0.78rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {new Date(m.timestamp).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                <button
                  type="button"
                  className="btn-icon"
                  aria-label="Delete weight entry"
                  onClick={() => onDeleteMetric(m.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-rose)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.3rem',
                    flexShrink: 0,
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </>
      ) : (
        /* Empty state */
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            gap: '0.6rem',
            padding: '2.5rem 1rem',
            borderRadius: '16px',
            border: '1px dashed var(--border-glass)',
            background: 'rgba(255,255,255,0.015)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              background: 'rgba(139, 92, 246, 0.12)',
              color: 'var(--accent-purple)',
            }}
          >
            <Scale size={26} />
          </div>
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            No weigh-ins yet
          </p>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '260px' }}>
            Log your first weight above to start charting your trend over time.
          </p>
        </div>
      )}
    </div>
  );
};

interface StatProps {
  label: string;
  value: string;
  color: string;
  icon?: React.ReactNode;
}

const Stat: React.FC<StatProps> = ({ label, value, color, icon = null }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '0.2rem',
      padding: '0.75rem',
      borderRadius: '14px',
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid var(--border-glass)',
    }}
  >
    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {label}
    </span>
    <span
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.3rem',
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: '1.05rem',
        color,
      }}
    >
      {icon}
      {value}
    </span>
  </div>
);

export default WeightTracker;

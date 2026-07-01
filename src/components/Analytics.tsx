import React, { useMemo, useCallback } from 'react';
import type { MealLog, UserGoals, AppSettings, WaterLog, Supplement } from '../types/nutrition';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { Chart as ChartJS, registerables } from 'chart.js';
import type { ChartEvent, ActiveElement } from 'chart.js';
import {
  BarChart3,
  PieChart,
  Activity,
  Droplets,
  GitCompare,
  Sparkles,
} from 'lucide-react';
import { computeDailyTotals, sumFieldKeyBetween } from '../services/dailyTotals';
import { isDataBackedMicroField } from '../services/nutrientValue';
import {
  MACRO_CALORIES_PER_GRAM,
  MACRO_TRACKING_ROWS,
  resolveCssColor,
  type MacroGoalKey,
} from '../services/trackingCatalog';
import {
  ANALYTICS_PERIOD_OPTIONS,
  ANALYTICS_PERIOD_STORAGE_KEY,
  buildDaySeries,
  type AnalyticsPeriod,
  chartSeriesFromDaily,
  parseStoredAnalyticsPeriod,
  resolveAnalyticsWindow,
  serializeAnalyticsPeriod,
} from '../services/analyticsRange';
import {
  CALORIE_GOAL_TOLERANCE,
  average,
  buildAnalyticsInsights,
  buildHeatmapCells,
  calorieBarBorderColor,
  calorieBarSemanticColor,
  dailyWaterSeries,
  dayOfWeekCalorieAverages,
  daysWithMealLogs,
  formatPeriodDelta,
  hydrationGoalMetDays,
  macroOnPlanDays,
  supplementCheckInDays,
} from '../services/analyticsInsights';
import {
  analyticsLegend,
  analyticsTooltip,
  baseChartOptions,
  doughnutCenterTextPlugin,
  goalLineDataset,
  priorPeriodDataset,
} from '../services/analyticsChartTheme';
import { computeStreak } from '../services/insights';
import { AnalyticsInsightsBar } from './analytics/AnalyticsInsightsBar';
import { AnalyticsHeatmap } from './analytics/AnalyticsHeatmap';
import { AnalyticsDayOfWeek } from './analytics/AnalyticsDayOfWeek';
import { AnalyticsViewTabs, type AnalyticsView } from './analytics/AnalyticsViewTabs';
import { AnalyticsStatStrip } from './analytics/AnalyticsStatStrip';
import { AnalyticsMicroPanel } from './analytics/AnalyticsMicroPanel';

ChartJS.register(...registerables);

const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface AnalyticsProps {
  logs: MealLog[];
  goals: UserGoals;
  appSettings: AppSettings;
  waterLogs?: WaterLog[];
  supplements?: Supplement[];
  onNavigateToDay?: (dayStartTs: number) => void;
}

const periodSummaryLabel = (period: AnalyticsPeriod, dayCount: number): string => {
  if (period === 'all') return `All time (${dayCount} days)`;
  return `Last ${period} days`;
};

const macroGramsForDay = (logs: MealLog[], goalKey: MacroGoalKey, dayTs: number): number => {
  if (goalKey === 'protein' || goalKey === 'carbs' || goalKey === 'fat') {
    const totals = computeDailyTotals(logs, [], dayTs);
    if (goalKey === 'protein') return Math.round(totals.consumedProtein);
    if (goalKey === 'carbs') return Math.round(totals.consumedCarbs);
    return Math.round(totals.consumedFat);
  }
  return Math.round(
    sumFieldKeyBetween(
      logs,
      goalKey,
      (() => {
        const s = new Date(dayTs);
        s.setHours(0, 0, 0, 0);
        return s.getTime();
      })(),
      (() => {
        const s = new Date(dayTs);
        s.setHours(0, 0, 0, 0);
        return s.getTime() + MS_PER_DAY;
      })()
    )
  );
};

const macroPeriodGrams = (logs: MealLog[], goalKey: MacroGoalKey, start: number, end: number): number => {
  if (goalKey === 'protein' || goalKey === 'carbs' || goalKey === 'fat') {
    let total = 0;
    for (const log of logs) {
      if (log.timestamp < start || log.timestamp >= end) continue;
      for (const item of log.items) {
        total += Number(item[goalKey]) || 0;
      }
    }
    return total;
  }
  return sumFieldKeyBetween(logs, goalKey, start, end);
};

const macroVisible = (appSettings: AppSettings, visibleKey: MacroGoalKey): boolean => {
  if (visibleKey === 'protein') return appSettings.visibleMacros.protein;
  if (visibleKey === 'carbs') return appSettings.visibleMacros.carbs;
  if (visibleKey === 'fat') return appSettings.visibleMacros.fat;
  return !!appSettings.visibleMacros[visibleKey];
};

export const Analytics: React.FC<AnalyticsProps> = ({
  logs,
  goals,
  appSettings,
  waterLogs = [],
  supplements = [],
  onNavigateToDay,
}) => {
  const [period, setPeriod] = React.useState<AnalyticsPeriod>(() => {
    try {
      return parseStoredAnalyticsPeriod(localStorage.getItem(ANALYTICS_PERIOD_STORAGE_KEY));
    } catch {
      return 7;
    }
  });
  const [comparePrior, setComparePrior] = React.useState(false);
  const [view, setView] = React.useState<AnalyticsView>('overview');

  const selectPeriod = (next: AnalyticsPeriod) => {
    setPeriod(next);
    try {
      localStorage.setItem(ANALYTICS_PERIOD_STORAGE_KEY, serializeAnalyticsPeriod(next));
    } catch {
      /* ignore */
    }
  };

  const rangeWindow = useMemo(() => resolveAnalyticsWindow(logs, period), [logs, period]);

  const priorDays = useMemo(() => {
    const priorStart = new Date(rangeWindow.startOfPeriod - rangeWindow.dayCount * MS_PER_DAY);
    return buildDaySeries(priorStart, rangeWindow.dayCount);
  }, [rangeWindow.startOfPeriod, rangeWindow.dayCount]);

  const visibleMacroRows = useMemo(
    () => MACRO_TRACKING_ROWS.filter((row) => macroVisible(appSettings, row.visibleKey)),
    [appSettings]
  );
  const visibleMacroKeys = useMemo(
    () => visibleMacroRows.map((r) => r.goalKey),
    [visibleMacroRows]
  );

  const visibleMicros = useMemo(
    () => (appSettings.customMicros ?? []).filter((m) => !m.hidden),
    [appSettings.customMicros]
  );

  const dailyCalories = useMemo(() => {
    return rangeWindow.days.map((day) => computeDailyTotals(logs, [], day.getTime()).consumedCalories);
  }, [logs, rangeWindow.days]);

  const priorDailyCalories = useMemo(() => {
    return priorDays.map((day) => computeDailyTotals(logs, [], day.getTime()).consumedCalories);
  }, [logs, priorDays]);

  const dailyMacroSeries = useMemo(() => {
    const series: Partial<Record<MacroGoalKey, number[]>> = {};
    for (const row of visibleMacroRows) {
      series[row.goalKey] = rangeWindow.days.map((day) =>
        macroGramsForDay(logs, row.goalKey, day.getTime())
      );
    }
    return series;
  }, [logs, rangeWindow.days, visibleMacroRows]);

  const calorieChart = useMemo(
    () => chartSeriesFromDaily(rangeWindow, dailyCalories),
    [rangeWindow, dailyCalories]
  );

  const baseCalorieGoal = goals.calories || 2000;
  const hydrationGoal = goals.hydration || 2000;

  const dailyGoals = useMemo(
    () => rangeWindow.days.map(() => baseCalorieGoal),
    [rangeWindow.days, baseCalorieGoal]
  );
  const goalChart = useMemo(
    () => chartSeriesFromDaily(rangeWindow, dailyGoals),
    [rangeWindow, dailyGoals]
  );

  const priorCalorieChart = useMemo(
    () =>
      chartSeriesFromDaily(
        { ...rangeWindow, days: priorDays, bucketMode: rangeWindow.bucketMode },
        priorDailyCalories
      ),
    [rangeWindow, priorDays, priorDailyCalories]
  );

  const weeklyCalorieAvg = Math.round(average(dailyCalories));
  const priorWeeklyCalorieAvg = Math.round(average(priorDailyCalories));
  const calorieDelta = formatPeriodDelta(weeklyCalorieAvg, priorWeeklyCalorieAvg);

  let consistentDays = 0;
  dailyCalories.forEach((consumed) => {
    if (consumed > 0 && Math.abs(consumed - baseCalorieGoal) <= CALORIE_GOAL_TOLERANCE) {
      consistentDays++;
    }
  });
  const consistencyIndex = Math.round((consistentDays / rangeWindow.dayCount) * 100);

  const onPlanDays = useMemo(
    () => macroOnPlanDays(logs, goals, rangeWindow.days, visibleMacroKeys),
    [logs, goals, rangeWindow.days, visibleMacroKeys]
  );

  const dailyWater = useMemo(
    () => dailyWaterSeries(waterLogs, rangeWindow.days),
    [waterLogs, rangeWindow.days]
  );
  const waterAvg = Math.round(average(dailyWater));
  const priorWaterAvg = Math.round(
    average(dailyWaterSeries(waterLogs, priorDays))
  );
  const hydrationMet = hydrationGoalMetDays(dailyWater, hydrationGoal);
  const loggingStreak = computeStreak(logs);
  const loggedDays = daysWithMealLogs(logs, rangeWindow.startOfPeriod, rangeWindow.endOfPeriod);
  const suppCheckIns = supplementCheckInDays(
    supplements,
    rangeWindow.startOfPeriod,
    rangeWindow.endOfPeriod
  );

  const macroDoughnutSlices = useMemo(() => {
    return visibleMacroRows
      .map((row) => {
        const grams = macroPeriodGrams(logs, row.goalKey, rangeWindow.startOfPeriod, rangeWindow.endOfPeriod);
        const calories = grams * MACRO_CALORIES_PER_GRAM[row.goalKey];
        return {
          label: row.name,
          calories,
          color: resolveCssColor(row.color),
        };
      })
      .filter((slice) => slice.calories > 0);
  }, [logs, visibleMacroRows, rangeWindow.startOfPeriod, rangeWindow.endOfPeriod]);

  const totalMacroCals = macroDoughnutSlices.reduce((sum, s) => sum + s.calories, 0);
  const hasMacroSplitData = totalMacroCals > 0;

  const microAverages = useMemo(() => {
    return visibleMicros
      .filter((micro) => isDataBackedMicroField(micro.fieldKey))
      .map((micro) => {
        const total = sumFieldKeyBetween(
          logs,
          micro.fieldKey,
          rangeWindow.startOfPeriod,
          rangeWindow.endOfPeriod
        );
        return { micro, avg: total / rangeWindow.dayCount };
      });
  }, [logs, visibleMicros, rangeWindow.startOfPeriod, rangeWindow.endOfPeriod, rangeWindow.dayCount]);

  const insights = useMemo(
    () =>
      buildAnalyticsInsights({
        logs,
        goals,
        window: rangeWindow,
        dailyCalories,
        priorDailyCalories,
        visibleMacroKeys,
        visibleMicros,
        waterLogs,
        supplements,
      }),
    [
      logs,
      goals,
      rangeWindow,
      dailyCalories,
      priorDailyCalories,
      visibleMacroKeys,
      visibleMicros,
      waterLogs,
      supplements,
    ]
  );

  const heatmapCells = useMemo(
    () => buildHeatmapCells(rangeWindow.days, dailyCalories, baseCalorieGoal),
    [rangeWindow.days, dailyCalories, baseCalorieGoal]
  );

  const dowBuckets = useMemo(
    () => dayOfWeekCalorieAverages(rangeWindow.days, dailyCalories),
    [rangeWindow.days, dailyCalories]
  );

  const waterChart = useMemo(
    () => chartSeriesFromDaily(rangeWindow, dailyWater),
    [rangeWindow, dailyWater]
  );

  const chartLabels = useMemo(() => {
    if (visibleMacroRows.length === 0) return calorieChart.labels;
    const firstKey = visibleMacroRows[0].goalKey;
    const daily = dailyMacroSeries[firstKey] ?? dailyCalories.map(() => 0);
    return chartSeriesFromDaily(rangeWindow, daily).labels;
  }, [visibleMacroRows, dailyMacroSeries, rangeWindow, calorieChart.labels, dailyCalories]);

  const xTickRotation = rangeWindow.bucketMode === 'weekly' ? 0 : rangeWindow.dayCount > 14 ? 40 : 0;

  const resolveChartDayTs = useCallback(
    (index: number): number | null => {
      if (rangeWindow.bucketMode === 'weekly') {
        const day = rangeWindow.days[index * 7];
        return day?.getTime() ?? null;
      }
      return rangeWindow.days[index]?.getTime() ?? null;
    },
    [rangeWindow]
  );

  const handleCalorieChartClick = useCallback(
    (_event: ChartEvent, elements: ActiveElement[]) => {
      if (!onNavigateToDay || elements.length === 0) return;
      const idx = elements[0].index;
      const ts = resolveChartDayTs(idx);
      if (ts != null) onNavigateToDay(ts);
    },
    [onNavigateToDay, resolveChartDayTs]
  );

  const semanticBarColors = calorieChart.values.map((v) =>
    calorieBarSemanticColor(
      rangeWindow.bucketMode === 'weekly' ? v / Math.min(7, rangeWindow.dayCount) : v,
      baseCalorieGoal
    )
  );
  const semanticBarBorders = calorieChart.values.map((v) =>
    calorieBarBorderColor(
      rangeWindow.bucketMode === 'weekly' ? v / Math.min(7, rangeWindow.dayCount) : v,
      baseCalorieGoal
    )
  );

  const calorieDatasets = [
    {
      label: rangeWindow.bucketMode === 'weekly' ? 'Consumed (week total)' : 'Consumed kcal',
      data: calorieChart.values,
      backgroundColor: semanticBarColors,
      borderColor: semanticBarBorders,
      borderWidth: 2,
      borderRadius: 8,
      hoverBackgroundColor: semanticBarColors.map((c) => c.replace(/[\d.]+\)$/, '0.85)')),
      barThickness: rangeWindow.bucketMode === 'weekly' ? 28 : 18,
    },
    goalLineDataset(goalChart.values, rangeWindow.bucketMode === 'weekly' ? 'Goal (week total)' : 'Daily goal kcal'),
  ];
  if (comparePrior) {
    calorieDatasets.push(
      priorPeriodDataset(
        priorCalorieChart.values,
        rangeWindow.bucketMode === 'weekly' ? 'Prior period (week total)' : 'Prior period avg'
      )
    );
  }

  const calorieChartData = {
    labels: calorieChart.labels,
    datasets: calorieDatasets as any[],
  };

  const calorieChartOptions = {
    ...baseChartOptions(xTickRotation),
    onClick: handleCalorieChartClick,
    plugins: {
      legend: analyticsLegend(),
      tooltip: {
        ...analyticsTooltip(),
        callbacks: onNavigateToDay
          ? {
              afterBody: () => 'Tap a bar to open that day in Timeline',
            }
          : undefined,
      },
    },
    scales: {
      ...baseChartOptions(xTickRotation).scales,
      x: {
        ...baseChartOptions(xTickRotation).scales?.x,
        ticks: {
          ...(baseChartOptions(xTickRotation).scales?.x as { ticks?: object })?.ticks,
          maxTicksLimit: rangeWindow.bucketMode === 'weekly' ? 14 : 12,
        },
      },
    },
  } as const;

  const stackedMacroChartData = {
    labels: chartLabels,
    datasets: visibleMacroRows.map((row) => {
      const daily = dailyMacroSeries[row.goalKey] ?? [];
      const chart = chartSeriesFromDaily(rangeWindow, daily);
      return {
        label: `${row.emoji} ${row.name} (${row.unit})`,
        data: chart.values,
        backgroundColor: row.chartFill,
        borderColor: resolveCssColor(row.color),
        borderWidth: 1.5,
        borderRadius: 4,
      };
    }),
  };

  const doughnutCenter = {
    primary: hasMacroSplitData ? `${Math.round(totalMacroCals).toLocaleString()}` : '—',
    secondary: hasMacroSplitData ? 'kcal from macros' : 'No data',
  };

  const doughnutChartData = {
    labels: hasMacroSplitData ? macroDoughnutSlices.map((s) => s.label) : ['No data'],
    datasets: [
      {
        data: hasMacroSplitData ? macroDoughnutSlices.map((s) => s.calories) : [1],
        backgroundColor: hasMacroSplitData
          ? macroDoughnutSlices.map((s) => s.color)
          : ['rgba(255,255,255,0.06)'],
        borderColor: resolveCssColor('var(--bg-secondary)'),
        borderWidth: 3,
        hoverOffset: 8,
      },
    ],
  };

  const doughnutChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    animation: { duration: 750, easing: 'easeOutQuart' as const },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: '#aab6c7',
          font: { family: 'Outfit', size: 11 },
          padding: 10,
          usePointStyle: true,
          pointStyle: 'circle' as const,
        },
      },
      tooltip: {
        enabled: hasMacroSplitData,
        ...analyticsTooltip(),
        callbacks: {
          label: (context: { raw: unknown; label?: string }) => {
            const val = Number(context.raw) || 0;
            const pct = totalMacroCals > 0 ? Math.round((val / totalMacroCals) * 100) : 0;
            return ` ${context.label ?? ''}: ${Math.round(val)} kcal (${pct}%)`;
          },
        },
      },
    },
  } as const;

  const waterLineData = {
    labels: waterChart.labels,
    datasets: [
      {
        label: 'Water (ml)',
        data: waterChart.values,
        borderColor: resolveCssColor('var(--hydration-color)'),
        backgroundColor: 'rgba(56, 189, 248, 0.12)',
        fill: true,
        tension: 0.35,
        pointRadius: 2,
        pointHoverRadius: 5,
        borderWidth: 2.5,
      },
      {
        label: 'Goal (ml)',
        data: waterChart.labels.map(() => hydrationGoal),
        borderColor: 'rgba(255,255,255,0.35)',
        borderDash: [4, 4],
        pointRadius: 0,
        fill: false,
        borderWidth: 1.5,
      },
    ],
  };

  const summaryLabel = periodSummaryLabel(period, rangeWindow.dayCount);
  const macroPeriodLabel =
    rangeWindow.bucketMode === 'weekly'
      ? `${summaryLabel} · weekly buckets`
      : summaryLabel;

  const dragHint = onNavigateToDay ? ' · tap chart or heatmap for Timeline' : '';

  const statStripItems = [
    {
      label: 'Avg calories',
      value: `${weeklyCalorieAvg} kcal/day`,
      meta: summaryLabel,
      delta: calorieDelta,
    },
    {
      label: 'On target',
      value: `${consistencyIndex}%`,
      meta: `${consistentDays}/${rangeWindow.dayCount} days ±${CALORIE_GOAL_TOLERANCE} kcal`,
      accent: 'var(--accent-teal)',
    },
    {
      label: 'Hydration',
      value: `${waterAvg} ml/day`,
      meta: `Goal met ${hydrationMet}/${rangeWindow.dayCount} days · ${loggingStreak}d streak`,
      delta: formatPeriodDelta(waterAvg, priorWaterAvg),
      accent: 'var(--hydration-color)',
    },
  ];

  return (
    <div className="analytics-page">
      <header className="analytics-toolbar glass-card motion-enter">
        <div className="analytics-toolbar-copy">
          <h2 className="analytics-title">Analytics</h2>
          <p className="analytics-range-label">
            {rangeWindow.rangeLabel}
            {dragHint}
          </p>
        </div>
        <AnalyticsViewTabs view={view} onChange={setView} />
        <div className="analytics-toolbar-actions">
          <div className="analytics-period-bar" role="group" aria-label="Analytics time range">
            {ANALYTICS_PERIOD_OPTIONS.map((opt) => (
              <button
                key={String(opt.value)}
                type="button"
                className={`analytics-period-btn${period === opt.value ? ' is-active' : ''}`}
                aria-pressed={period === opt.value}
                onClick={() => selectPeriod(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <AnalyticsInsightsBar insights={insights} previewCount={2} />

      <AnalyticsStatStrip items={statStripItems} />

      {view === 'overview' ? (
        <div
          id="analytics-panel-overview"
          role="tabpanel"
          aria-labelledby="analytics-tab-overview"
          className="analytics-view-panel"
        >
          <div className="glass-card analytics-chart-card analytics-chart-card--hero motion-enter">
            <div className="analytics-chart-title-row">
              <h3 className="analytics-chart-title">
                <BarChart3 size={18} color="var(--accent-purple)" />
                Calories vs goal
              </h3>
              <button
                type="button"
                className={`analytics-compare-btn analytics-compare-btn--chart${comparePrior ? ' is-active' : ''}`}
                aria-pressed={comparePrior}
                title={`Overlay the previous ${rangeWindow.dayCount} days as a dashed line on this chart`}
                onClick={() => setComparePrior((v) => !v)}
              >
                <GitCompare size={14} aria-hidden />
                vs prior period
              </button>
            </div>
            <p className="analytics-chart-subtitle">
              Green on target · amber close · rose far
              {comparePrior ? ' · dashed line = previous period' : ''}
            </p>
            <div className="analytics-chart-canvas analytics-chart-canvas--hero">
              <Bar data={calorieChartData} options={calorieChartOptions as any} />
            </div>
          </div>

          <div className="glass-card analytics-chart-card analytics-chart-card--heatmap motion-enter">
            <h3 className="analytics-chart-title">
              <Activity size={18} color="var(--accent-teal)" />
              Daily adherence
            </h3>
            <p className="analytics-chart-subtitle">
              {onNavigateToDay ? 'Tap a day to open Timeline' : 'How close each day was to goal'}
            </p>
            <AnalyticsHeatmap cells={heatmapCells} onSelectDay={onNavigateToDay} />
          </div>
        </div>
      ) : (
        <div
          id="analytics-panel-details"
          role="tabpanel"
          aria-labelledby="analytics-tab-details"
          className="analytics-view-panel"
        >
          <div className="analytics-charts-grid">
            <div className="glass-card analytics-chart-card analytics-chart-card--medium motion-enter">
              <h3 className="analytics-chart-title">
                <Activity size={18} color="var(--accent-teal)" />
                Macronutrients
              </h3>
              <p className="analytics-chart-subtitle">{macroPeriodLabel}</p>
              <div className="analytics-chart-canvas analytics-chart-canvas--medium">
                {visibleMacroRows.length > 0 ? (
                  <Bar
                    data={stackedMacroChartData}
                    options={{
                      ...baseChartOptions(xTickRotation),
                      scales: {
                        x: { ...(baseChartOptions(xTickRotation).scales?.x ?? {}), stacked: true },
                        y: { ...(baseChartOptions(xTickRotation).scales?.y ?? {}), stacked: true },
                      },
                    }}
                  />
                ) : (
                  <div className="analytics-chart-empty analytics-chart-empty--compact">
                    <span>No macros enabled.</span>
                    <span className="analytics-summary-meta">Turn on macros in Dashboard settings.</span>
                  </div>
                )}
              </div>
            </div>

            <div className="glass-card analytics-chart-card analytics-chart-card--medium motion-enter">
              <h3 className="analytics-chart-title">
                <PieChart size={18} color="var(--accent-teal)" />
                Macro calorie split
              </h3>
              <div className="analytics-chart-canvas analytics-chart-canvas--doughnut analytics-chart-canvas--doughnut-sm">
                {visibleMacroRows.length === 0 ? (
                  <div className="analytics-chart-empty analytics-chart-empty--compact">
                    <span>No macros enabled.</span>
                  </div>
                ) : hasMacroSplitData ? (
                  <Doughnut
                    data={doughnutChartData}
                    options={doughnutChartOptions as any}
                    plugins={[doughnutCenterTextPlugin(doughnutCenter)]}
                  />
                ) : (
                  <div className="analytics-empty-doughnut">
                    <span>No macro data in this period.</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="analytics-charts-grid">
            <div className="glass-card analytics-chart-card analytics-chart-card--medium motion-enter">
              <h3 className="analytics-chart-title">
                <Droplets size={18} color="var(--hydration-color)" />
                Hydration
              </h3>
              <div className="analytics-chart-canvas analytics-chart-canvas--short">
                {waterAvg > 0 || dailyWater.some((v) => v > 0) ? (
                  <Line data={waterLineData} options={baseChartOptions(xTickRotation) as any} />
                ) : (
                  <div className="analytics-chart-empty analytics-chart-empty--compact">
                    <span>No hydration logged.</span>
                  </div>
                )}
              </div>
              {supplements.length > 0 && (
                <p className="analytics-chart-footnote">
                  Supplements logged on {suppCheckIns} of {rangeWindow.dayCount} days
                </p>
              )}
            </div>

            <div className="glass-card analytics-chart-card analytics-chart-card--medium motion-enter">
              <h3 className="analytics-chart-title">
                <BarChart3 size={18} color="var(--accent-amber)" />
                Weekday averages
              </h3>
              <AnalyticsDayOfWeek buckets={dowBuckets} calorieGoal={baseCalorieGoal} />
            </div>
          </div>

          <div className="glass-card analytics-chart-card analytics-chart-card--micros motion-enter">
            <h3 className="analytics-chart-title">
              <Sparkles size={18} color="var(--accent-purple)" />
              Micronutrients
            </h3>
            <AnalyticsMicroPanel items={microAverages} summaryLabel={summaryLabel} />
            <p className="analytics-chart-footnote">
              {loggedDays}/{rangeWindow.dayCount} days logged · {onPlanDays} macro on-plan days
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;

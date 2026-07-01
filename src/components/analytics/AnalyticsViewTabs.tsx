import React from 'react';

export type AnalyticsView = 'overview' | 'details';

interface AnalyticsViewTabsProps {
  view: AnalyticsView;
  onChange: (view: AnalyticsView) => void;
}

const TABS: { id: AnalyticsView; label: string; hint: string }[] = [
  { id: 'overview', label: 'Overview', hint: 'Calories & adherence at a glance' },
  { id: 'details', label: 'Details', hint: 'Deeper breakdowns' },
];

export const AnalyticsViewTabs: React.FC<AnalyticsViewTabsProps> = ({ view, onChange }) => (
  <div className="analytics-view-tabs" role="tablist" aria-label="Analytics sections">
    {TABS.map((tab) => (
      <button
        key={tab.id}
        type="button"
        role="tab"
        id={`analytics-tab-${tab.id}`}
        aria-selected={view === tab.id}
        aria-controls={`analytics-panel-${tab.id}`}
        className={`analytics-view-tab${view === tab.id ? ' is-active' : ''}`}
        onClick={() => onChange(tab.id)}
      >
        <span>{tab.label}</span>
        <span className="analytics-view-tab-hint">{tab.hint}</span>
      </button>
    ))}
  </div>
);

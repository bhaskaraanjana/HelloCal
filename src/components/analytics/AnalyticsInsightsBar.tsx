import React, { useState } from 'react';
import type { AnalyticsInsight } from '../../services/analyticsInsights';
import { Lightbulb, ChevronDown } from 'lucide-react';

interface AnalyticsInsightsBarProps {
  insights: AnalyticsInsight[];
  previewCount?: number;
}

export const AnalyticsInsightsBar: React.FC<AnalyticsInsightsBarProps> = ({
  insights,
  previewCount = 2,
}) => {
  const [expanded, setExpanded] = useState(false);
  if (insights.length === 0) return null;

  const hasMore = insights.length > previewCount;
  const visible = expanded ? insights : insights.slice(0, previewCount);

  return (
    <div className="analytics-insights glass-card motion-enter" style={{ animationDelay: '80ms' }}>
      <div className="analytics-insights-head">
        <Lightbulb size={16} aria-hidden />
        <span>Insights</span>
      </div>
      <ul className="analytics-insights-list">
        {visible.map((insight) => (
          <li key={insight.id} className={`analytics-insight analytics-insight--${insight.tone}`}>
            {insight.text}
          </li>
        ))}
      </ul>
      {hasMore && (
        <button
          type="button"
          className="analytics-insights-more"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          <ChevronDown size={14} aria-hidden className={expanded ? 'is-flipped' : ''} />
          {expanded ? 'Show fewer' : `${insights.length - previewCount} more insights`}
        </button>
      )}
    </div>
  );
};

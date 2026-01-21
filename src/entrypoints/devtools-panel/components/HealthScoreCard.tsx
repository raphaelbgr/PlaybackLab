/**
 * Health Score Card Component
 * Displays stream health score with visual breakdown
 */

import { useMemo } from 'react';
import {
  calculateHealthScore,
  getScoreColor,
  getStatusColor,
  type HealthMetrics,
  type HealthScore,
} from '../../../shared/utils/streamHealthScore';
import type { DetectedStream } from '../../../store';
import { safeUpperCase } from '../../../shared/utils/stringUtils';

interface Props {
  stream: DetectedStream | null;
  metrics?: Partial<HealthMetrics>;
}

export function HealthScoreCard({ stream, metrics }: Props) {
  // Calculate health score from available data
  const healthScore = useMemo<HealthScore | null>(() => {
    if (!stream) return null;

    // Build metrics from available stream data (without real-time metrics)
    const fullMetrics: HealthMetrics = {
      bufferLevel: 10, // Default buffer level
      droppedFrames: 0,
      totalFrames: 1000, // Estimate
      rebufferingEvents: 0,
      playbackDuration: 60,
      errorCount: stream.error ? 1 : 0,
      qualitySwitches: 0,
      averageBitrate: stream.manifest?.videoVariants?.[0]?.bandwidth ?? 0,
      maxBitrate: stream.manifest?.videoVariants?.[0]?.bandwidth ?? 5000000,
      ...metrics,
    };

    return calculateHealthScore(fullMetrics);
  }, [stream, metrics]);

  if (!stream) {
    return (
      <div className="health-score-card empty">
        <div className="health-score-icon">📊</div>
        <p>Select a stream to view health score</p>
      </div>
    );
  }

  if (!healthScore) {
    return (
      <div className="health-score-card loading">
        <p>Calculating health score...</p>
      </div>
    );
  }

  const scoreColor = getScoreColor(healthScore.overall);
  const statusColor = getStatusColor(healthScore.status);

  return (
    <div className="health-score-card">
      <div className="health-score-header">
        <h3>Stream Health</h3>
        <span
          className="health-status-badge"
          style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
        >
          {safeUpperCase(healthScore.status)}
        </span>
      </div>

      {/* Main Score Circle */}
      <div className="health-score-main">
        <div
          className="score-circle"
          style={{
            background: `conic-gradient(${scoreColor} ${healthScore.overall}%, var(--bg-tertiary) 0)`,
          }}
        >
          <div className="score-inner">
            <span className="score-value" style={{ color: scoreColor }}>
              {healthScore.overall}
            </span>
            <span className="score-grade">{healthScore.grade}</span>
          </div>
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="health-breakdown">
        <div className="breakdown-item">
          <div className="breakdown-header">
            <span className="breakdown-label">Buffer</span>
            <span className="breakdown-value">{healthScore.breakdown.buffer}</span>
          </div>
          <div className="breakdown-bar">
            <div
              className="breakdown-fill"
              style={{
                width: `${healthScore.breakdown.buffer}%`,
                backgroundColor: getScoreColor(healthScore.breakdown.buffer),
              }}
            />
          </div>
        </div>

        <div className="breakdown-item">
          <div className="breakdown-header">
            <span className="breakdown-label">Frames</span>
            <span className="breakdown-value">{healthScore.breakdown.frames}</span>
          </div>
          <div className="breakdown-bar">
            <div
              className="breakdown-fill"
              style={{
                width: `${healthScore.breakdown.frames}%`,
                backgroundColor: getScoreColor(healthScore.breakdown.frames),
              }}
            />
          </div>
        </div>

        <div className="breakdown-item">
          <div className="breakdown-header">
            <span className="breakdown-label">Stability</span>
            <span className="breakdown-value">{healthScore.breakdown.stability}</span>
          </div>
          <div className="breakdown-bar">
            <div
              className="breakdown-fill"
              style={{
                width: `${healthScore.breakdown.stability}%`,
                backgroundColor: getScoreColor(healthScore.breakdown.stability),
              }}
            />
          </div>
        </div>

        <div className="breakdown-item">
          <div className="breakdown-header">
            <span className="breakdown-label">Quality</span>
            <span className="breakdown-value">{healthScore.breakdown.quality}</span>
          </div>
          <div className="breakdown-bar">
            <div
              className="breakdown-fill"
              style={{
                width: `${healthScore.breakdown.quality}%`,
                backgroundColor: getScoreColor(healthScore.breakdown.quality),
              }}
            />
          </div>
        </div>

        <div className="breakdown-item">
          <div className="breakdown-header">
            <span className="breakdown-label">Errors</span>
            <span className="breakdown-value">{healthScore.breakdown.errors}</span>
          </div>
          <div className="breakdown-bar">
            <div
              className="breakdown-fill"
              style={{
                width: `${healthScore.breakdown.errors}%`,
                backgroundColor: getScoreColor(healthScore.breakdown.errors),
              }}
            />
          </div>
        </div>
      </div>

      {/* Issues */}
      {healthScore.issues.length > 0 && (
        <div className="health-issues">
          <h4>Issues Detected</h4>
          <ul>
            {healthScore.issues.map((issue, i) => (
              <li key={i} className="issue-item">
                <span className="issue-icon">⚠️</span>
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      {healthScore.recommendations.length > 0 && (
        <div className="health-recommendations">
          <h4>Recommendations</h4>
          <ul>
            {healthScore.recommendations.map((rec, i) => (
              <li key={i} className="recommendation-item">
                <span className="recommendation-icon">💡</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

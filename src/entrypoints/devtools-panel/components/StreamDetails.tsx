/**
 * StreamDetails Component
 * Right panel showing detailed information for selected stream
 */

import { useState } from 'react';
import type { DetectedStream } from '../../../store';
import { formatDistanceToNow } from 'date-fns';
import { safeUpperCase, typeToClassName, formatBitrate, formatDuration, getFilenameFromUrl } from '../../../shared/utils/stringUtils';

interface StreamDetailsProps {
  stream: DetectedStream | null;
}

type DetailTab = 'overview' | 'manifest' | 'metrics' | 'drm' | 'network';

export function StreamDetails({ stream }: StreamDetailsProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [urlExpanded, setUrlExpanded] = useState(false);

  if (!stream) {
    return (
      <div className="stream-details-empty">
        <div className="empty-icon">👈</div>
        <p>Select a stream to view details</p>
      </div>
    );
  }

  const { info, isLoading, error } = stream;

  return (
    <div className="stream-details">
      {/* Header */}
      <div className="details-header">
        <div className="details-title">
          <span className={`type-badge ${typeToClassName(info.type)}`}>{safeUpperCase(info.type)}</span>
          <span className="details-filename">{getFilenameFromUrl(info.url)}</span>
          {info.isActive && <span className="live-badge">LIVE</span>}
        </div>

        {/* Collapsible URL */}
        <div className={`details-url-wrapper ${urlExpanded ? 'expanded' : ''}`}>
          <button
            className="url-toggle-btn"
            onClick={() => setUrlExpanded(!urlExpanded)}
            title={urlExpanded ? 'Collapse URL' : 'Expand URL'}
          >
            {urlExpanded ? '▲' : '▼'}
          </button>
          <div className="details-url" title={info.url}>
            {info.url}
          </div>
        </div>

        <div className="details-meta">
          Detected {formatDistanceToNow(info.detectedAt, { addSuffix: true })}
          {info.initiator && ` · Source: ${info.initiator}`}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="details-tabs">
        <button
          className={`details-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`details-tab ${activeTab === 'manifest' ? 'active' : ''}`}
          onClick={() => setActiveTab('manifest')}
        >
          Manifest
        </button>
        <button
          className={`details-tab ${activeTab === 'metrics' ? 'active' : ''}`}
          onClick={() => setActiveTab('metrics')}
        >
          Metrics
        </button>
        <button
          className={`details-tab ${activeTab === 'drm' ? 'active' : ''}`}
          onClick={() => setActiveTab('drm')}
        >
          DRM
        </button>
      </div>

      {/* Tab Content */}
      <div className="details-content">
        {isLoading && (
          <div className="details-loading">
            <div className="spinner"></div>
            <span>Loading manifest...</span>
          </div>
        )}

        {error && (
          <div className="details-error">
            <span className="error-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {activeTab === 'overview' && <OverviewTab stream={stream} />}
        {activeTab === 'manifest' && <ManifestTab stream={stream} />}
        {activeTab === 'metrics' && <MetricsTab stream={stream} />}
        {activeTab === 'drm' && <DrmTab stream={stream} />}
      </div>
    </div>
  );
}

function OverviewTab({ stream }: { stream: DetectedStream }) {
  const { manifest } = stream;

  const stats = [
    {
      label: 'Type',
      value: safeUpperCase(stream.info.type),
      icon: '📺',
    },
    {
      label: 'Variants',
      value: manifest?.videoVariants?.length || 0,
      icon: '🎬',
    },
    {
      label: 'Max Resolution',
      value: manifest?.videoVariants?.length
        ? `${Math.max(...manifest.videoVariants.map(v => v.height || 0))}p`
        : 'N/A',
      icon: '📐',
    },
    {
      label: 'Audio Tracks',
      value: manifest?.audioVariants?.length || 0,
      icon: '🔊',
    },
    {
      label: 'Subtitles',
      value: manifest?.subtitles?.length || 0,
      icon: '💬',
    },
    {
      label: 'DRM',
      value: manifest?.drm?.length
        ? manifest.drm.map(d => d.type).join(', ')
        : 'None',
      icon: '🔐',
    },
    {
      label: 'Duration',
      value: manifest?.duration
        ? formatDuration(manifest.duration)
        : manifest?.isLive ? 'Live' : 'N/A',
      icon: '⏱️',
    },
    {
      label: 'Segments',
      value: manifest?.segments?.length || 0,
      icon: '🧩',
    },
  ];

  return (
    <div className="overview-grid">
      {stats.map((stat) => (
        <div key={stat.label} className="stat-card">
          <div className="stat-icon">{stat.icon}</div>
          <div className="stat-info">
            <div className="stat-value">{stat.value}</div>
            <div className="stat-label">{stat.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ManifestTab({ stream }: { stream: DetectedStream }) {
  const { manifest } = stream;

  if (!manifest) {
    return (
      <div className="tab-empty">
        <p>Manifest not loaded yet</p>
      </div>
    );
  }

  return (
    <div className="manifest-details">
      {/* Video Variants */}
      {manifest.videoVariants.length > 0 && (
        <div className="manifest-section">
          <h4 className="section-title">Video Variants ({manifest.videoVariants.length})</h4>
          <div className="variants-table">
            <div className="table-header">
              <span>Resolution</span>
              <span>Bandwidth</span>
              <span>Codecs</span>
            </div>
            {manifest.videoVariants
              .sort((a, b) => (b.height || 0) - (a.height || 0))
              .map((variant, i) => (
                <div key={i} className="table-row">
                  <span>{variant.width}x{variant.height}</span>
                  <span>{formatBitrate(variant.bandwidth)}</span>
                  <span className="codecs">{variant.codecs || 'N/A'}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Audio Variants */}
      {manifest.audioVariants.length > 0 && (
        <div className="manifest-section">
          <h4 className="section-title">Audio Tracks ({manifest.audioVariants.length})</h4>
          <div className="variants-table">
            <div className="table-header">
              <span>Language</span>
              <span>Name</span>
              <span>Channels</span>
            </div>
            {manifest.audioVariants.map((audio, i) => (
              <div key={i} className="table-row">
                <span>{audio.language || 'N/A'}</span>
                <span>{audio.name || 'Default'}</span>
                <span>{audio.channels || 2}ch</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subtitles */}
      {manifest.subtitles.length > 0 && (
        <div className="manifest-section">
          <h4 className="section-title">Subtitles ({manifest.subtitles.length})</h4>
          <div className="subtitle-list">
            {manifest.subtitles.map((sub, i) => (
              <div key={i} className="subtitle-item">
                <span className="lang-badge">{sub.language || 'UND'}</span>
                <span>{sub.name || 'Unnamed'}</span>
                {sub.forced && <span className="forced-badge">Forced</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Raw Manifest */}
      <div className="manifest-section">
        <h4 className="section-title">Raw Manifest</h4>
        <pre className="raw-manifest">{manifest.raw.slice(0, 2000)}{manifest.raw.length > 2000 ? '...' : ''}</pre>
      </div>
    </div>
  );
}

function MetricsTab({ stream }: { stream: DetectedStream }) {
  const { metrics } = stream;
  const latestMetrics = metrics[metrics.length - 1];

  if (!latestMetrics) {
    return (
      <div className="tab-empty">
        <p>No metrics collected yet</p>
        <p className="hint">Play the video to start collecting metrics</p>
      </div>
    );
  }

  return (
    <div className="metrics-details">
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Current Time</div>
          <div className="metric-value">{formatDuration(latestMetrics.currentTime)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Duration</div>
          <div className="metric-value">{formatDuration(latestMetrics.duration)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Bitrate</div>
          <div className="metric-value">{formatBitrate(latestMetrics.bitrate)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Resolution</div>
          <div className="metric-value">
            {latestMetrics.resolution.width}x{latestMetrics.resolution.height}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Buffer</div>
          <div className="metric-value">
            {latestMetrics.buffered.length > 0
              ? `${(latestMetrics.buffered[0].end - latestMetrics.currentTime).toFixed(1)}s`
              : 'N/A'}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Dropped Frames</div>
          <div className="metric-value">{latestMetrics.droppedFrames}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Bandwidth</div>
          <div className="metric-value">{formatBitrate(latestMetrics.bandwidth)}</div>
        </div>
        {latestMetrics.latency !== undefined && (
          <div className="metric-card">
            <div className="metric-label">Latency</div>
            <div className="metric-value">{latestMetrics.latency.toFixed(0)}ms</div>
          </div>
        )}
      </div>

      {/* Mini timeline */}
      <div className="metrics-history">
        <h4>Bitrate History ({metrics.length} samples)</h4>
        <div className="mini-chart">
          {metrics.slice(-30).map((m, i) => (
            <div
              key={i}
              className="chart-bar"
              style={{
                height: `${(m.bitrate / Math.max(...metrics.map(x => x.bitrate))) * 100}%`,
              }}
              title={`${formatBitrate(m.bitrate)}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function DrmTab({ stream }: { stream: DetectedStream }) {
  const { manifest } = stream;
  const drm = manifest?.drm || [];

  if (drm.length === 0) {
    return (
      <div className="tab-empty">
        <div className="empty-icon">🔓</div>
        <p>No DRM protection detected</p>
      </div>
    );
  }

  return (
    <div className="drm-details">
      {drm.map((drmInfo, i) => (
        <div key={i} className="drm-card">
          <div className="drm-header">
            <span className={`drm-badge ${typeToClassName(drmInfo.type)}`}>
              {safeUpperCase(drmInfo.type)}
            </span>
          </div>
          <div className="drm-info">
            {drmInfo.keyId && (
              <div className="drm-field">
                <span className="field-label">Key ID</span>
                <code className="field-value">{drmInfo.keyId}</code>
              </div>
            )}
            {drmInfo.licenseUrl && (
              <div className="drm-field">
                <span className="field-label">License URL</span>
                <code className="field-value">{drmInfo.licenseUrl}</code>
              </div>
            )}
            {drmInfo.pssh && (
              <div className="drm-field">
                <span className="field-label">PSSH</span>
                <code className="field-value pssh">{drmInfo.pssh.slice(0, 100)}...</code>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Utility functions now imported from shared/utils/stringUtils

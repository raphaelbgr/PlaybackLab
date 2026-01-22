/**
 * StreamDetails Component
 * Right panel showing detailed information for selected stream
 * Features:
 * - Tab persistence per stream URL in localStorage
 * - Live payload/segment monitoring
 * - Smart defaults for Overview tab
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { DetectedStream } from '../../../store';
import { useStore } from '../../../store';
import { formatDistanceToNow } from 'date-fns';
import { safeUpperCase, typeToClassName, formatBitrate, formatDuration, getFilenameFromUrl } from '../../../shared/utils/stringUtils';
import { copyToClipboard, generateCurlCommand } from '../../../shared/utils/copyAsCurl';
import {
  parseVideoCodec,
  getVideoVariantTags,
  getQualityLabel,
  getAspectRatio,
  getResolutionTag,
  getAudioVariantTags,
} from '../../../shared/utils/videoTags';
import { ErrorDisplay } from './ErrorDisplay';
import { CopyButton } from './CopyButton';
import { MiniPlayer } from './MiniPlayer';
import type { VideoVariant, ParsedManifest } from '../../../core/interfaces/IManifestParser';

interface StreamDetailsProps {
  stream: DetectedStream | null;
}

type DetailTab = 'overview' | 'manifest' | 'payload' | 'drm' | 'errors';

// Hash function for URL-based storage keys
function hashUrl(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) - hash) + url.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// Tab persistence helpers
const TAB_STORAGE_KEY = 'pbl_detail_tabs';
const MAX_STORED_TABS = 100;

function getStoredTab(url: string): DetailTab | null {
  try {
    const stored = localStorage.getItem(TAB_STORAGE_KEY);
    if (stored) {
      const tabs = JSON.parse(stored) as Record<string, { tab: DetailTab; ts: number }>;
      const key = hashUrl(url);
      return tabs[key]?.tab || null;
    }
  } catch {
    // Ignore localStorage errors
  }
  return null;
}

function storeTab(url: string, tab: DetailTab): void {
  try {
    const stored = localStorage.getItem(TAB_STORAGE_KEY);
    let tabs: Record<string, { tab: DetailTab; ts: number }> = {};

    if (stored) {
      tabs = JSON.parse(stored);
    }

    // Add/update current entry
    tabs[hashUrl(url)] = { tab, ts: Date.now() };

    // Cleanup: keep only most recent entries if over limit
    const entries = Object.entries(tabs);
    if (entries.length > MAX_STORED_TABS) {
      entries.sort((a, b) => b[1].ts - a[1].ts);
      tabs = Object.fromEntries(entries.slice(0, MAX_STORED_TABS));
    }

    localStorage.setItem(TAB_STORAGE_KEY, JSON.stringify(tabs));
  } catch {
    // Ignore localStorage errors
  }
}

export function StreamDetails({ stream }: StreamDetailsProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [urlExpanded, setUrlExpanded] = useState(false);
  const previousStreamUrl = useRef<string | null>(null);

  // Restore tab from localStorage when stream changes
  useEffect(() => {
    if (stream && stream.info.url !== previousStreamUrl.current) {
      previousStreamUrl.current = stream.info.url;
      const storedTab = getStoredTab(stream.info.url);
      if (storedTab) {
        setActiveTab(storedTab);
      } else {
        setActiveTab('overview'); // Default for new streams
      }
    }
  }, [stream?.info.url]);

  // Persist tab selection when it changes
  const handleTabChange = useCallback((tab: DetailTab) => {
    setActiveTab(tab);
    if (stream) {
      storeTab(stream.info.url, tab);
    }
  }, [stream?.info.url]);

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
          onClick={() => handleTabChange('overview')}
        >
          Overview
        </button>
        <button
          className={`details-tab ${activeTab === 'manifest' ? 'active' : ''}`}
          onClick={() => handleTabChange('manifest')}
        >
          Manifest
        </button>
        <button
          className={`details-tab ${activeTab === 'payload' ? 'active' : ''}`}
          onClick={() => handleTabChange('payload')}
        >
          Payload
        </button>
        <button
          className={`details-tab ${activeTab === 'drm' ? 'active' : ''}`}
          onClick={() => handleTabChange('drm')}
        >
          DRM
        </button>
        <button
          className={`details-tab ${activeTab === 'errors' ? 'active' : ''} ${stream.error ? 'has-error' : ''}`}
          onClick={() => handleTabChange('errors')}
        >
          Errors {stream.error && <span className="error-indicator">!</span>}
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
        {activeTab === 'payload' && <PayloadTab stream={stream} />}
        {activeTab === 'drm' && <DrmTab stream={stream} />}
        {activeTab === 'errors' && <ErrorsTab stream={stream} />}
      </div>
    </div>
  );
}

function OverviewTab({ stream }: { stream: DetectedStream }) {
  const { manifest, info, isLoading } = stream;
  const { setStreamLoading, updateManifest, setStreamError } = useStore();

  // Auto-fetch manifest if not loaded
  useEffect(() => {
    if (!manifest && !isLoading && !stream.error) {
      // Trigger manifest fetch
      setStreamLoading(info.id, true);

      fetch(info.url, {
        headers: info.requestHeaders || {},
      })
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.text();
        })
        .then(async (text) => {
          // Dynamically import parser based on type
          if (info.type === 'hls') {
            const { HlsManifestParser } = await import('../../../core/services/HlsManifestParser');
            const parser = new HlsManifestParser();
            const parsed = await parser.parse(text, info.url);
            updateManifest(info.id, parsed);
          } else if (info.type === 'dash') {
            const { DashManifestParser } = await import('../../../core/services/DashManifestParser');
            const parser = new DashManifestParser();
            const parsed = await parser.parse(text, info.url);
            updateManifest(info.id, parsed);
          } else {
            setStreamLoading(info.id, false);
          }
        })
        .catch((err) => {
          setStreamError(info.id, err.message || 'Failed to load manifest');
        });
    }
  }, [manifest, isLoading, stream.error, info.id, info.url, info.type, info.requestHeaders]);

  // Extract origin domain from URL
  const getOriginDomain = (url: string): string => {
    try {
      return new URL(url).hostname;
    } catch {
      return '—';
    }
  };

  // Determine audio status
  // Check for separate (non-muxed) audio tracks - muxed tracks have isMuxed=true or empty URL
  const hasSeparateAudioTracks = (manifest?.audioVariants ?? []).some(a => !a.isMuxed && a.url);
  // Audio is embedded if we have audio in the video but no separate audio tracks
  // OR if manifest has audio variants that are all muxed
  const hasMuxedAudio = (manifest?.audioVariants ?? []).some(a => a.isMuxed);
  const isAudioEmbedded = hasMuxedAudio || (info.hasAudio && !hasSeparateAudioTracks);

  const getAudioStatus = (): string => {
    // If video has audio (from content script detection)
    if (info.hasAudio) {
      if (info.audioMuted) return 'Muted';
      if (isAudioEmbedded) return 'Embedded';
      if (hasSeparateAudioTracks) return 'Playing';
      return 'Embedded'; // Default to embedded if has audio but no separate tracks
    }
    // If manifest has audio info
    if (hasMuxedAudio) return 'Embedded';
    if (hasSeparateAudioTracks) return 'Available';
    return '—';
  };

  // Get origin with ellipsis handling
  const originDomain = getOriginDomain(info.url);
  const truncateOrigin = (domain: string, maxLen: number = 18): string => {
    if (domain.length <= maxLen) return domain;
    return domain.substring(0, maxLen - 1) + '…';
  };

  // Basic info - always available (removed redundant Type - already in header)
  const basicStats = [
    {
      label: 'Status',
      value: info.playbackState ? capitalizeFirst(info.playbackState) : (info.isActive ? 'Active' : 'Detected'),
      icon: info.playbackState === 'playing' ? '▶️' : (info.playbackState === 'paused' ? '⏸️' : '○'),
      tooltip: '',
    },
    {
      label: 'Audio',
      value: getAudioStatus(),
      icon: info.audioMuted ? '🔇' : '🔊',
      tooltip: isAudioEmbedded ? 'Audio is muxed/embedded in the video stream' : '',
    },
    {
      label: 'Origin',
      value: truncateOrigin(originDomain),
      icon: '🌐',
      tooltip: originDomain,
    },
  ];

  // Manifest details - show loading or actual data
  const manifestStats = [
    {
      label: 'Variants',
      value: manifest?.videoVariants?.length ?? (isLoading ? '...' : '—'),
      icon: '🎬',
    },
    {
      label: 'Max Resolution',
      value: manifest?.videoVariants?.length
        ? `${Math.max(...manifest.videoVariants.map(v => v.height || 0))}p`
        : (isLoading ? '...' : '—'),
      icon: '📐',
    },
    {
      label: 'Audio Tracks',
      value: manifest?.audioVariants?.length ?? (isLoading ? '...' : '—'),
      icon: '🎵',
    },
    {
      label: 'Subtitles',
      value: manifest?.subtitles?.length ?? (isLoading ? '...' : '0'),
      icon: '💬',
    },
    {
      label: 'DRM',
      value: manifest?.drm?.length
        ? manifest.drm.map(d => capitalizeFirst(d.type)).join(', ')
        : (isLoading ? '...' : 'None'),
      icon: '🔐',
    },
    {
      label: 'Duration',
      value: manifest?.duration
        ? formatDuration(manifest.duration)
        : (manifest?.isLive ? 'Live Stream' : (isLoading ? '...' : '—')),
      icon: manifest?.isLive ? '🔴' : '⏱️',
    },
  ];

  // Check if stream has DRM
  const hasDrm = (manifest?.drm?.length ?? 0) > 0;

  return (
    <div className="overview-content">
      {/* Mini Player Preview */}
      <div className="overview-section">
        <MiniPlayer
          url={info.url}
          type={info.type === 'unknown' ? undefined : info.type}
          hasDrm={hasDrm}
          requestHeaders={info.requestHeaders}
        />
      </div>

      {/* Basic Info Section */}
      <div className="overview-section">
        <h4 className="section-title">Stream Info</h4>
        <div className="overview-grid compact">
          {basicStats.map((stat) => (
            <div key={stat.label} className="stat-card" title={stat.tooltip || undefined}>
              <div className="stat-icon">{stat.icon}</div>
              <div className="stat-info">
                <div className="stat-value">{stat.value}</div>
                <div className="stat-label">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Manifest Details Section */}
      <div className="overview-section">
        <h4 className="section-title">
          Manifest Details
          {isLoading && <span className="loading-indicator">Loading...</span>}
        </h4>
        <div className="overview-grid">
          {manifestStats.map((stat) => (
            <div key={stat.label} className={`stat-card ${stat.value === '...' ? 'loading' : ''}`}>
              <div className="stat-icon">{stat.icon}</div>
              <div className="stat-info">
                <div className="stat-value">{stat.value}</div>
                <div className="stat-label">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bitrate Ladder Visualization */}
      {manifest?.videoVariants && manifest.videoVariants.length > 0 && (
        <div className="overview-section">
          <h4 className="section-title">Bitrate Ladder</h4>
          <BitrateLadder variants={manifest.videoVariants} />
        </div>
      )}

      {/* Request Headers (if available) */}
      {info.requestHeaders && Object.keys(info.requestHeaders).length > 0 && (
        <div className="overview-section">
          <h4 className="section-title">Request Headers</h4>
          <div className="headers-list">
            {Object.entries(info.requestHeaders).slice(0, 5).map(([key, value]) => (
              <div key={key} className="header-row">
                <span className="header-key">{key}:</span>
                <span className="header-value">{value}</span>
              </div>
            ))}
            {Object.keys(info.requestHeaders).length > 5 && (
              <div className="header-row more">
                +{Object.keys(info.requestHeaders).length - 5} more headers
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Bitrate Ladder Visualization Component (Enhanced with codec/HDR badges)
function BitrateLadder({ variants }: { variants: VideoVariant[] }) {
  // Sort by resolution (height) descending
  const sortedVariants = [...variants].sort((a, b) => (b.height || 0) - (a.height || 0));

  // Find max bandwidth for scaling
  const maxBandwidth = Math.max(...variants.map(v => v.bandwidth || 0));

  // Resolution labels
  const getResolutionLabel = (height: number): string => {
    if (height >= 2160) return '4K';
    if (height >= 1440) return '2K';
    if (height >= 1080) return '1080p';
    if (height >= 720) return '720p';
    if (height >= 480) return '480p';
    if (height >= 360) return '360p';
    if (height >= 240) return '240p';
    return `${height}p`;
  };

  // Quality tier color
  const getQualityColor = (height: number): string => {
    if (height >= 2160) return '#8b5cf6'; // Purple - 4K
    if (height >= 1080) return '#10b981'; // Green - HD
    if (height >= 720) return '#3b82f6';  // Blue - HD Ready
    if (height >= 480) return '#f59e0b';  // Amber - SD
    return '#6b7280';                      // Gray - Low
  };

  // Get unique codecs and HDR types for summary
  const codecSet = new Set<string>();
  const hdrSet = new Set<string>();
  sortedVariants.forEach(v => {
    const tags = getVideoVariantTags(v.codecs, v.height, v.frameRate);
    if (tags.codec) codecSet.add(tags.codec.label);
    if (tags.hdr) hdrSet.add(tags.hdr.label);
  });

  return (
    <div className="bitrate-ladder">
      {/* Summary badges */}
      {(codecSet.size > 0 || hdrSet.size > 0) && (
        <div className="ladder-summary">
          {Array.from(codecSet).map(codec => {
            const tags = getVideoVariantTags(
              sortedVariants.find(v => parseVideoCodec(v.codecs)?.codec === codec)?.codecs,
              undefined,
              undefined
            );
            return tags.codec ? (
              <span
                key={codec}
                className="ladder-badge"
                style={{ color: tags.codec.color, backgroundColor: tags.codec.bgColor }}
                data-tooltip={tags.codec.tooltip}
              >
                {tags.codec.label}
              </span>
            ) : null;
          })}
          {Array.from(hdrSet).map(hdr => {
            const variant = sortedVariants.find(v => {
              const t = getVideoVariantTags(v.codecs, v.height, v.frameRate);
              return t.hdr?.label === hdr;
            });
            const tags = variant ? getVideoVariantTags(variant.codecs, variant.height, variant.frameRate) : null;
            return tags?.hdr ? (
              <span
                key={hdr}
                className="ladder-badge"
                style={{ color: tags.hdr.color, backgroundColor: tags.hdr.bgColor }}
                data-tooltip={tags.hdr.tooltip}
              >
                {tags.hdr.label}
              </span>
            ) : null;
          })}
        </div>
      )}

      {/* Ladder rows */}
      {sortedVariants.map((variant, i) => {
        const height = variant.height || 0;
        const bandwidth = variant.bandwidth || 0;
        const widthPercent = maxBandwidth > 0 ? (bandwidth / maxBandwidth) * 100 : 0;
        const color = getQualityColor(height);
        const tags = getVideoVariantTags(variant.codecs, variant.height, variant.frameRate);

        return (
          <div key={i} className="ladder-row">
            <div className="ladder-label">
              <span className="ladder-resolution">{getResolutionLabel(height)}</span>
              <span className="ladder-dimensions">{variant.width}×{height}</span>
            </div>
            <div className="ladder-bar-container">
              <div
                className="ladder-bar"
                style={{
                  width: `${Math.max(widthPercent, 5)}%`,
                  backgroundColor: color,
                }}
              />
              <span className="ladder-bitrate">{formatBitrate(bandwidth)}</span>
              {/* Show badges for this variant */}
              <div className="ladder-row-badges">
                {tags.codec && (
                  <span
                    className="ladder-mini-badge"
                    style={{ color: tags.codec.color, backgroundColor: tags.codec.bgColor }}
                    data-tooltip={tags.codec.tooltip}
                  >
                    {tags.codec.label}
                  </span>
                )}
                {tags.hdr && (
                  <span
                    className="ladder-mini-badge"
                    style={{ color: tags.hdr.color, backgroundColor: tags.hdr.bgColor }}
                    data-tooltip={tags.hdr.tooltip}
                  >
                    {tags.hdr.label}
                  </span>
                )}
                {tags.frameRate && (
                  <span
                    className="ladder-mini-badge"
                    style={{ color: tags.frameRate.color, backgroundColor: tags.frameRate.bgColor }}
                    data-tooltip={tags.frameRate.tooltip}
                  >
                    {tags.frameRate.label}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
      <div className="ladder-legend">
        <span className="legend-item">
          <span className="legend-dot" style={{ backgroundColor: '#8b5cf6' }} />4K
        </span>
        <span className="legend-item">
          <span className="legend-dot" style={{ backgroundColor: '#10b981' }} />Full HD
        </span>
        <span className="legend-item">
          <span className="legend-dot" style={{ backgroundColor: '#3b82f6' }} />HD
        </span>
        <span className="legend-item">
          <span className="legend-dot" style={{ backgroundColor: '#f59e0b' }} />SD
        </span>
      </div>
    </div>
  );
}

// Network request type for Payload tab
interface SegmentRequest {
  id: string;
  url: string;
  type: 'manifest' | 'segment' | 'key' | 'init' | 'other';
  status: number | 'pending';
  statusText?: string;
  size: number;
  duration: number;
  timestamp: number;
  sequenceNumber?: number;
  method?: string;
  mimeType?: string;
  mediaDuration?: number; // Media duration in seconds (from manifest)
}

// Helper to find media duration by matching segment URL to manifest segments
function findSegmentMediaDuration(url: string, manifest?: ParsedManifest): number | undefined {
  if (!manifest?.segments?.length) return undefined;

  // Try exact match first
  const exactMatch = manifest.segments.find(seg => seg.url === url);
  if (exactMatch) return exactMatch.duration;

  // Try matching by filename (last part of path)
  try {
    const urlFilename = new URL(url).pathname.split('/').pop()?.split('?')[0];
    if (urlFilename) {
      const filenameMatch = manifest.segments.find(seg => {
        const segFilename = new URL(seg.url).pathname.split('/').pop()?.split('?')[0];
        return segFilename === urlFilename;
      });
      if (filenameMatch) return filenameMatch.duration;
    }
  } catch {
    // URL parsing failed
  }

  // Return target duration as fallback if available
  if (manifest.segments.length > 0) {
    // Calculate average segment duration from manifest
    const avgDuration = manifest.segments.reduce((sum, s) => sum + s.duration, 0) / manifest.segments.length;
    return Math.round(avgDuration * 100) / 100; // Round to 2 decimals
  }

  return undefined;
}

// Request Detail Modal Component
function RequestDetailModal({ request, onClose }: { request: SegmentRequest; onClose: () => void }) {
  // Parse URL for detailed info
  let urlInfo: { host: string; pathname: string; filename: string; queryParams: [string, string][] } = {
    host: '',
    pathname: '',
    filename: '',
    queryParams: [],
  };

  try {
    const urlObj = new URL(request.url);
    const pathSegments = urlObj.pathname.split('/').filter(Boolean);
    urlInfo = {
      host: urlObj.host,
      pathname: urlObj.pathname,
      filename: pathSegments[pathSegments.length - 1] || urlObj.pathname,
      queryParams: Array.from(urlObj.searchParams.entries()),
    };
  } catch {
    urlInfo.filename = request.url.slice(0, 50);
  }

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDurationMs = (ms: number): string => {
    if (ms === 0) return '—';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getStatusColor = (status: number | 'pending'): string => {
    if (status === 'pending') return 'var(--text-secondary)';
    if (typeof status === 'number') {
      if (status >= 200 && status < 300) return 'var(--success)';
      if (status >= 300 && status < 400) return 'var(--warning)';
    }
    return 'var(--error)';
  };

  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'manifest': return 'Manifest (m3u8/mpd)';
      case 'segment': return 'Media Segment';
      case 'init': return 'Init Segment';
      case 'key': return 'Encryption Key';
      default: return 'Other';
    }
  };

  const getTypeColor = (type: string): string => {
    switch (type) {
      case 'manifest': return '#4fc3f7';
      case 'segment': return '#81c784';
      case 'init': return '#ffb74d';
      case 'key': return '#f06292';
      default: return '#9e9e9e';
    }
  };

  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content request-detail-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title">
            <span className="request-type-badge" style={{ backgroundColor: getTypeColor(request.type) }}>
              {request.type.toUpperCase()}
            </span>
            <span className="request-filename">{urlInfo.filename}</span>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {/* Status Section */}
          <div className="detail-section">
            <h4 className="detail-section-title">Response</h4>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Status</span>
                <span className="detail-value" style={{ color: getStatusColor(request.status) }}>
                  {typeof request.status === 'number' ? `${request.status} ${request.statusText || ''}` : 'Pending'}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Size</span>
                <span className="detail-value">{formatSize(request.size)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Duration</span>
                <span className="detail-value">{formatDurationMs(request.duration)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Type</span>
                <span className="detail-value">{getTypeLabel(request.type)}</span>
              </div>
              {request.mimeType && (
                <div className="detail-item">
                  <span className="detail-label">MIME Type</span>
                  <span className="detail-value">{request.mimeType}</span>
                </div>
              )}
              <div className="detail-item">
                <span className="detail-label">Timestamp</span>
                <span className="detail-value">{new Date(request.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
          </div>

          {/* URL Section */}
          <div className="detail-section">
            <h4 className="detail-section-title">
              URL
              <button className="copy-btn" onClick={() => copyToClipboard(request.url)} title="Copy URL">
                📋
              </button>
            </h4>
            <div className="url-breakdown">
              <div className="detail-item full-width">
                <span className="detail-label">Full URL</span>
                <code className="detail-value url-value">{request.url}</code>
              </div>
              <div className="detail-item">
                <span className="detail-label">Host</span>
                <span className="detail-value">{urlInfo.host}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Path</span>
                <span className="detail-value">{urlInfo.pathname}</span>
              </div>
            </div>
          </div>

          {/* Query Parameters */}
          {urlInfo.queryParams.length > 0 && (
            <div className="detail-section">
              <h4 className="detail-section-title">Query Parameters ({urlInfo.queryParams.length})</h4>
              <div className="query-params-list">
                {urlInfo.queryParams.map(([key, value], i) => (
                  <div key={i} className="query-param">
                    <span className="param-key">{key}</span>
                    <span className="param-value">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timing */}
          <div className="detail-section">
            <h4 className="detail-section-title">Timing</h4>
            <div className="timing-bar">
              <div className="timing-fill" style={{ width: `${Math.min(100, (request.duration / 500) * 100)}%` }}></div>
              <span className="timing-label">{formatDurationMs(request.duration)}</span>
            </div>
            {request.size > 0 && request.duration > 0 && (
              <div className="throughput">
                Throughput: {formatSize(Math.round(request.size / (request.duration / 1000)))}/s
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button className="btn-secondary" onClick={() => copyToClipboard(request.url)}>
            Copy URL
          </button>
          <button className="btn-secondary" onClick={() => copyToClipboard(generateCurlCommand({ url: request.url, method: request.method || 'GET' }))}>
            Copy as cURL
          </button>
          <button className="btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Payload storage helpers
const PAYLOAD_STORAGE_KEY = 'pbl_payload_requests';
const MAX_STORED_STREAMS = 50;
const MAX_REQUESTS_PER_STREAM = 100;

function getPayloadStorageKey(streamUrl: string): string {
  return hashUrl(streamUrl);
}

function loadStoredRequests(streamUrl: string): SegmentRequest[] {
  try {
    const stored = localStorage.getItem(PAYLOAD_STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored) as Record<string, { requests: SegmentRequest[]; ts: number }>;
      const key = getPayloadStorageKey(streamUrl);
      return data[key]?.requests || [];
    }
  } catch {
    // Ignore localStorage errors
  }
  return [];
}

function saveStoredRequests(streamUrl: string, requests: SegmentRequest[]): void {
  try {
    const stored = localStorage.getItem(PAYLOAD_STORAGE_KEY);
    let data: Record<string, { requests: SegmentRequest[]; ts: number }> = {};

    if (stored) {
      data = JSON.parse(stored);
    }

    const key = getPayloadStorageKey(streamUrl);
    // Keep only the last N requests
    data[key] = {
      requests: requests.slice(-MAX_REQUESTS_PER_STREAM),
      ts: Date.now(),
    };

    // Cleanup: keep only most recent streams if over limit
    const entries = Object.entries(data);
    if (entries.length > MAX_STORED_STREAMS) {
      entries.sort((a, b) => b[1].ts - a[1].ts);
      data = Object.fromEntries(entries.slice(0, MAX_STORED_STREAMS));
    }

    localStorage.setItem(PAYLOAD_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore localStorage errors
  }
}

function clearStoredRequests(streamUrl: string): void {
  try {
    const stored = localStorage.getItem(PAYLOAD_STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored) as Record<string, { requests: SegmentRequest[]; ts: number }>;
      const key = getPayloadStorageKey(streamUrl);
      if (data[key]) {
        delete data[key];
        localStorage.setItem(PAYLOAD_STORAGE_KEY, JSON.stringify(data));
      }
    }
  } catch {
    // Ignore localStorage errors
  }
}

function PayloadTab({ stream }: { stream: DetectedStream }) {
  const [requests, setRequests] = useState<SegmentRequest[]>([]);
  const [isCapturing, setIsCapturing] = useState(true); // Auto-start
  const [isPaused, setIsPaused] = useState(false);
  const [filter, setFilter] = useState<'all' | 'segment' | 'manifest' | 'error'>('all');
  const [selectedRequest, setSelectedRequest] = useState<SegmentRequest | null>(null);
  const requestCountRef = useRef(0);
  const streamUrlRef = useRef<string | null>(null);

  // Load stored requests when stream changes
  useEffect(() => {
    if (stream && stream.info.url !== streamUrlRef.current) {
      streamUrlRef.current = stream.info.url;
      const storedRequests = loadStoredRequests(stream.info.url);
      if (storedRequests.length > 0) {
        setRequests(storedRequests);
        // Set the counter to continue from where we left off
        const maxSeq = Math.max(...storedRequests.map(r => r.sequenceNumber || 0));
        requestCountRef.current = maxSeq;
      } else {
        setRequests([]);
        requestCountRef.current = 0;
      }
    }
  }, [stream?.info.url]);

  // Save requests to localStorage when they change
  useEffect(() => {
    if (stream && requests.length > 0) {
      saveStoredRequests(stream.info.url, requests);
    }
  }, [requests, stream?.info.url]);

  // Listen for network requests
  useEffect(() => {
    if (!stream || !isCapturing || isPaused) return;

    const handleMessage = (message: { type: string; payload?: SegmentRequest }) => {
      if (message.type === 'NETWORK_REQUEST' && message.payload) {
        const req = message.payload;
        // Only add requests related to this stream's domain
        try {
          const streamHost = new URL(stream.info.url).hostname;
          const reqHost = new URL(req.url).hostname;
          if (reqHost.includes(streamHost) || streamHost.includes(reqHost)) {
            requestCountRef.current++;
            setRequests((prev) => {
              // Check for duplicates by URL + timestamp (within 100ms)
              const isDuplicate = prev.some(
                p => p.url === req.url && Math.abs(p.timestamp - req.timestamp) < 100
              );
              if (isDuplicate) return prev;

              return [
                ...prev,
                { ...req, sequenceNumber: requestCountRef.current }
              ].slice(-MAX_REQUESTS_PER_STREAM);
            });
          }
        } catch {
          // Invalid URL, skip
        }
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    // Start network monitoring
    chrome.runtime.sendMessage({
      type: 'START_NETWORK_CAPTURE',
      tabId: stream.info.tabId,
    });

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [stream, isCapturing, isPaused]);

  // Stop capture when unmounting
  useEffect(() => {
    return () => {
      if (stream) {
        chrome.runtime.sendMessage({
          type: 'STOP_NETWORK_CAPTURE',
          tabId: stream.info.tabId,
        });
      }
    };
  }, [stream?.info.tabId]);

  // Filter requests
  const filteredRequests = requests.filter((req) => {
    switch (filter) {
      case 'manifest':
        return req.type === 'manifest';
      case 'segment':
        return req.type === 'segment' || req.type === 'init';
      case 'error':
        return typeof req.status === 'number' && (req.status >= 400 || req.status === 0);
      default:
        return true;
    }
  });

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDurationMs = (ms: number): string => {
    if (ms === 0) return '—';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getFilename = (url: string): string => {
    try {
      const urlObj = new URL(url);
      const segments = urlObj.pathname.split('/').filter(Boolean);
      return segments[segments.length - 1] || urlObj.pathname;
    } catch {
      return url.slice(0, 30);
    }
  };

  const getStatusIcon = (status: number | 'pending'): { icon: string; className: string } => {
    if (status === 'pending') return { icon: '⏳', className: 'pending' };
    if (status >= 200 && status < 300) return { icon: '✓', className: 'success' };
    if (status >= 300 && status < 400) return { icon: '↪', className: 'redirect' };
    return { icon: '✕', className: 'error' };
  };

  const getTypeColor = (type: string): string => {
    switch (type) {
      case 'manifest': return '#4fc3f7';
      case 'segment': return '#81c784';
      case 'init': return '#ffb74d';
      case 'key': return '#f06292';
      default: return '#9e9e9e';
    }
  };

  const handleClear = () => {
    setRequests([]);
    requestCountRef.current = 0;
    // Also clear from localStorage
    if (stream) {
      clearStoredRequests(stream.info.url);
    }
  };

  const errorCount = requests.filter(r => typeof r.status === 'number' && (r.status >= 400 || r.status === 0)).length;

  return (
    <div className="payload-tab">
      {/* Header */}
      <div className="payload-header">
        <div className="payload-status">
          <span className={`live-indicator ${isCapturing && !isPaused ? 'active' : ''}`}>
            {isCapturing && !isPaused ? '● LIVE' : '○ PAUSED'}
          </span>
          <span className="request-count">{requests.length} requests</span>
        </div>
        <div className="payload-actions">
          <button
            className={`btn-small ${isPaused ? '' : 'active'}`}
            onClick={() => setIsPaused(!isPaused)}
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? '▶' : '⏸'}
          </button>
          <button className="btn-small" onClick={handleClear} title="Clear">
            🗑
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="payload-filters">
        <button
          className={`filter-chip ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button
          className={`filter-chip ${filter === 'segment' ? 'active' : ''}`}
          onClick={() => setFilter('segment')}
        >
          Segments
        </button>
        <button
          className={`filter-chip ${filter === 'manifest' ? 'active' : ''}`}
          onClick={() => setFilter('manifest')}
        >
          Manifests
        </button>
        <button
          className={`filter-chip ${filter === 'error' ? 'active' : ''} ${errorCount > 0 ? 'has-errors' : ''}`}
          onClick={() => setFilter('error')}
        >
          Errors {errorCount > 0 && `(${errorCount})`}
        </button>
      </div>

      {/* Request List */}
      <div className="payload-list">
        {filteredRequests.length === 0 ? (
          <div className="payload-empty">
            {isCapturing && !isPaused
              ? 'Waiting for segment requests...'
              : 'Capture paused. Click ▶ to resume.'}
          </div>
        ) : (
          filteredRequests.slice().reverse().map((req) => {
            const statusInfo = getStatusIcon(req.status);
            // Look up media duration from manifest for segments
            const mediaDuration = req.type === 'segment' || req.type === 'init'
              ? findSegmentMediaDuration(req.url, stream.manifest)
              : undefined;
            return (
              <div
                key={req.id}
                className={`payload-item clickable ${statusInfo.className}`}
                onClick={() => setSelectedRequest(req)}
              >
                <span className="payload-seq">#{req.sequenceNumber}</span>
                <span
                  className="payload-type"
                  style={{ backgroundColor: getTypeColor(req.type) }}
                >
                  {req.type.slice(0, 3).toUpperCase()}
                </span>
                <span className="payload-name" title={req.url}>
                  {getFilename(req.url)}
                </span>
                <span className="payload-size">{formatSize(req.size)}</span>
                {mediaDuration !== undefined && (
                  <span className="payload-media-duration" title="Media duration (from manifest)">
                    🎬 {mediaDuration.toFixed(1)}s
                  </span>
                )}
                <span className="payload-duration" title="Download time">
                  ⏱ {formatDurationMs(req.duration)}
                </span>
                <span className={`payload-status ${statusInfo.className}`}>
                  {statusInfo.icon} {typeof req.status === 'number' ? req.status : ''}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Summary */}
      {requests.length > 0 && (
        <div className="payload-summary">
          <span>Total: {formatSize(requests.reduce((sum, r) => sum + r.size, 0))}</span>
          <span>Segments: {requests.filter(r => r.type === 'segment').length}</span>
          <span>Avg: {formatDurationMs(Math.round(requests.reduce((sum, r) => sum + r.duration, 0) / requests.length))}</span>
        </div>
      )}

      {/* Request Detail Modal */}
      {selectedRequest && (
        <RequestDetailModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
        />
      )}
    </div>
  );
}

function ManifestTab({ stream }: { stream: DetectedStream }) {
  const { manifest } = stream;
  const [expandedVariants, setExpandedVariants] = useState<Set<string>>(new Set());

  const toggleVariant = (key: string) => {
    setExpandedVariants(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  if (!manifest) {
    return (
      <div className="tab-empty">
        <p>Manifest not loaded yet</p>
        <p className="hint">Go to Overview tab to trigger manifest loading</p>
      </div>
    );
  }

  const videoVariants = manifest.videoVariants || [];
  const audioVariants = manifest.audioVariants || [];
  const subtitles = manifest.subtitles || [];
  const segments = manifest.segments || [];
  const rawManifest = manifest.raw || '';

  return (
    <div className="manifest-details">
      {/* Manifest Summary */}
      <div className="manifest-section">
        <h4 className="section-title" data-tooltip="The manifest is an index file (m3u8/mpd) that tells the player what video/audio files to download" data-tooltip-wrap="true">
          Manifest Info
        </h4>
        <div className="manifest-summary">
          <div className="summary-item" data-tooltip="HLS (Apple) or DASH (MPEG) streaming format">
            <span className="summary-label">Format</span>
            <span className={`summary-value type-badge ${manifest.type}`}>{safeUpperCase(manifest.type)}</span>
          </div>
          <div className="summary-item" data-tooltip="Live = real-time broadcast, VOD = pre-recorded video">
            <span className="summary-label">Type</span>
            <span className={`summary-value ${manifest.isLive ? 'live' : ''}`}>
              {manifest.isLive ? '🔴 Live' : '📼 VOD'}
            </span>
          </div>
          {manifest.duration ? (
            <div className="summary-item" data-tooltip="Total video length">
              <span className="summary-label">Duration</span>
              <span className="summary-value">{formatDuration(manifest.duration)}</span>
            </div>
          ) : null}
          <div className="summary-item" data-tooltip="Small video/audio chunks (2-10 sec each)" data-tooltip-wrap="true">
            <span className="summary-label">Segments</span>
            <span className="summary-value">{segments.length || '—'}</span>
          </div>
          <div className="summary-item" data-tooltip="Digital Rights Management - content encryption">
            <span className="summary-label">DRM</span>
            <span className="summary-value">{manifest.drm?.length ? `${manifest.drm.length} system(s)` : 'None'}</span>
          </div>
        </div>
      </div>

      {/* Video Variants - Rich Cards */}
      {videoVariants.length > 0 && (
        <div className="manifest-section">
          <h4 className="section-title" data-tooltip="Video quality variants available in this stream - player selects based on bandwidth">
            Video Variants ({videoVariants.length})
          </h4>
          <div className="video-cards">
            {[...videoVariants]
              .sort((a, b) => (b.height || 0) - (a.height || 0))
              .map((variant, i) => {
                const key = `video-${i}`;
                const isExpanded = expandedVariants.has(key);
                const tags = getVideoVariantTags(variant.codecs, variant.height, variant.frameRate, variant.width);
                const codecInfo = parseVideoCodec(variant.codecs);
                const qualityLabel = getQualityLabel(variant.height);
                const aspectRatio = getAspectRatio(variant.width, variant.height);
                const resolutionTag = getResolutionTag(variant.width, variant.height);
                const isTopQuality = i === 0;

                return (
                  <div
                    key={key}
                    className={`video-card ${isExpanded ? 'expanded' : ''} ${isTopQuality ? 'top-quality' : ''}`}
                    onClick={() => toggleVariant(key)}
                  >
                    {/* Card Header */}
                    <div className="video-card-header">
                      <div className="video-card-title">
                        <span className="video-icon">🎬</span>
                        <span className="video-quality">{qualityLabel}</span>
                        {isTopQuality && (
                          <span className="video-badge best" data-tooltip="Highest quality variant available">Best</span>
                        )}
                      </div>
                      <div className="video-card-tags">
                        {tags.codec && (
                          <span
                            className="video-tag"
                            style={{ color: tags.codec.color, backgroundColor: tags.codec.bgColor }}
                            data-tooltip={tags.codec.tooltip}
                          >
                            {tags.codec.label}
                          </span>
                        )}
                        {tags.hdr && (
                          <span
                            className="video-tag"
                            style={{ color: tags.hdr.color, backgroundColor: tags.hdr.bgColor }}
                            data-tooltip={tags.hdr.tooltip}
                          >
                            {tags.hdr.label}
                          </span>
                        )}
                        {tags.frameRate && (
                          <span
                            className="video-tag"
                            style={{ color: tags.frameRate.color, backgroundColor: tags.frameRate.bgColor }}
                            data-tooltip={tags.frameRate.tooltip}
                          >
                            {tags.frameRate.label}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Info Row */}
                    <div className="video-card-info">
                      <span className="video-info-item" data-tooltip="Video resolution in pixels">
                        {variant.width || 0}×{variant.height || 0}
                      </span>
                      {resolutionTag && (
                        <span
                          className="video-tag tag-resolution"
                          style={{ color: resolutionTag.color, backgroundColor: resolutionTag.bgColor }}
                          data-tooltip={resolutionTag.tooltip}
                          data-tooltip-wrap
                        >
                          {resolutionTag.label}
                        </span>
                      )}
                      <span className="video-info-item" data-tooltip="Video bitrate - higher means better quality">
                        {formatBitrate(variant.bandwidth || 0)}
                      </span>
                      {variant.frameRate && (
                        <span className="video-info-item" data-tooltip="Frames per second">
                          {variant.frameRate}fps
                        </span>
                      )}
                      <span className="video-info-item" data-tooltip="Aspect ratio">
                        {aspectRatio}
                      </span>
                    </div>

                    {/* Muxed Audio Info Row (Option A + B) */}
                    {tags.muxedAudioInfo && (
                      <div className="video-muxed-audio-row">
                        <span className="muxed-audio-icon">🔊</span>
                        <span className="muxed-audio-label">Muxed:</span>
                        {tags.muxedAudioInfo.codecTag && (
                          <span
                            className="video-tag"
                            style={{ color: tags.muxedAudioInfo.codecTag.color, backgroundColor: tags.muxedAudioInfo.codecTag.bgColor }}
                            data-tooltip={tags.muxedAudioInfo.codecTag.tooltip}
                            data-tooltip-wrap
                          >
                            {tags.muxedAudioInfo.codecTag.label}
                          </span>
                        )}
                        {tags.muxedAudioInfo.channelsTag && (
                          <span
                            className="video-tag"
                            style={{ color: tags.muxedAudioInfo.channelsTag.color, backgroundColor: tags.muxedAudioInfo.channelsTag.bgColor }}
                            data-tooltip={tags.muxedAudioInfo.channelsTag.tooltip}
                            data-tooltip-wrap
                          >
                            {tags.muxedAudioInfo.channelsTag.label}
                          </span>
                        )}
                        {tags.muxedAudioInfo.estimatedBitrate && (
                          <span className="muxed-audio-bitrate" data-tooltip="Estimated audio bitrate (actual may vary)">
                            {tags.muxedAudioInfo.estimatedBitrate}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="video-card-details">
                        <div className="video-detail-grid">
                          <div className="video-detail">
                            <span className="detail-label">Resolution</span>
                            <span className="detail-value">{variant.width || 0}×{variant.height || 0}</span>
                          </div>
                          <div className="video-detail">
                            <span className="detail-label">Bitrate</span>
                            <span className="detail-value">{formatBitrate(variant.bandwidth || 0)}</span>
                          </div>
                          <div className="video-detail">
                            <span className="detail-label">Codec</span>
                            <span className="detail-value">
                              {codecInfo
                                ? `${codecInfo.codec}${codecInfo.profile ? ` ${codecInfo.profile}` : ''}${codecInfo.level ? ` L${codecInfo.level}` : ''}`
                                : variant.codecs || '—'}
                            </span>
                          </div>
                          {variant.frameRate && (
                            <div className="video-detail">
                              <span className="detail-label">Frame Rate</span>
                              <span className="detail-value">{variant.frameRate} fps</span>
                            </div>
                          )}
                          <div className="video-detail">
                            <span className="detail-label">Aspect Ratio</span>
                            <span className="detail-value">{aspectRatio}</span>
                          </div>
                          <div className="video-detail full-width">
                            <span className="detail-label">Full Codec String</span>
                            <span className="detail-value mono">{variant.codecs || '—'}</span>
                          </div>
                        </div>
                        {variant.url && (
                          <div className="video-url-row">
                            <code className="video-url" title={variant.url}>{variant.url}</code>
                            <CopyButton text={variant.url} variant="icon" size="small" title="Copy variant URL" />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Expand indicator */}
                    <div className="video-card-expand">
                      {isExpanded ? '▲' : '▼'}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Audio Tracks - Rich Cards (Option 2+3) */}
      {audioVariants.length > 0 && (
        <div className="manifest-section">
          <h4 className="section-title" data-tooltip="Audio tracks available in this stream - can be muxed (embedded in video) or separate files">
            Audio Tracks ({audioVariants.length})
          </h4>
          <div className="audio-cards">
            {audioVariants.map((audio, i) => {
              const key = `audio-${i}`;
              const isExpanded = expandedVariants.has(key);
              const audioTags = getAudioVariantTags(audio.codecs, audio.channels);

              return (
                <div
                  key={key}
                  className={`audio-card ${isExpanded ? 'expanded' : ''} ${audio.isDefault ? 'is-default' : ''}`}
                  onClick={() => toggleVariant(key)}
                >
                  {/* Card Header */}
                  <div className="audio-card-header">
                    <div className="audio-card-title">
                      <span className="audio-icon">🎵</span>
                      <span className="audio-name">{audio.name || audio.language || 'Audio'}</span>
                      {audio.isDefault && (
                        <span className="audio-badge default" data-tooltip="Default audio track - plays automatically">Default</span>
                      )}
                    </div>
                    <div className="audio-card-badges">
                      <span
                        className={`audio-badge ${audio.isMuxed ? 'muxed' : 'separate'}`}
                        data-tooltip={audio.isMuxed
                          ? 'Muxed Audio: Audio is embedded within video segments (downloaded together)'
                          : 'Separate: Audio is in its own playlist/segments (separate download)'}
                      >
                        {audio.isMuxed ? 'muxed' : 'separate'}
                      </span>
                    </div>
                  </div>

                  {/* Card Info Row with Tags */}
                  <div className="audio-card-info">
                    {audioTags.codec && (
                      <span
                        className="video-tag"
                        style={{ color: audioTags.codec.color, backgroundColor: audioTags.codec.bgColor }}
                        data-tooltip={audioTags.codec.tooltip}
                        data-tooltip-wrap
                      >
                        {audioTags.codec.label}
                      </span>
                    )}
                    {audioTags.channels && (
                      <span
                        className="video-tag"
                        style={{ color: audioTags.channels.color, backgroundColor: audioTags.channels.bgColor }}
                        data-tooltip={audioTags.channels.tooltip}
                        data-tooltip-wrap
                      >
                        {audioTags.channels.label}
                      </span>
                    )}
                    {audio.bandwidth && (
                      <span className="audio-info-item" data-tooltip="Audio bitrate">
                        {formatBitrate(audio.bandwidth)}
                      </span>
                    )}
                    {audio.sampleRate && (
                      <span className="audio-info-item" data-tooltip="Audio sample rate in kHz">
                        {(audio.sampleRate / 1000).toFixed(1)}kHz
                      </span>
                    )}
                    {audio.language && audio.language !== audio.name && (
                      <span className="audio-info-item lang" data-tooltip="Language code">
                        {audio.language}
                      </span>
                    )}
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="audio-card-details">
                      <div className="audio-detail-grid">
                        <div className="audio-detail">
                          <span className="detail-label">Source</span>
                          <span className="detail-value">{audio.isMuxed ? 'Embedded in video' : 'Separate stream'}</span>
                        </div>
                        <div className="audio-detail">
                          <span className="detail-label">Codec</span>
                          <span className="detail-value">
                            {audioTags.codec ? audioTags.codec.label : (audio.codecs || 'Not specified')}
                          </span>
                        </div>
                        <div className="audio-detail">
                          <span className="detail-label">Channels</span>
                          <span className="detail-value">
                            {audio.channels || 2} ({audioTags.channels?.label || 'Stereo'})
                          </span>
                        </div>
                        {audio.bandwidth && (
                          <div className="audio-detail">
                            <span className="detail-label">Bitrate</span>
                            <span className="detail-value">{formatBitrate(audio.bandwidth)}</span>
                          </div>
                        )}
                        {audio.sampleRate && (
                          <div className="audio-detail">
                            <span className="detail-label">Sample Rate</span>
                            <span className="detail-value">{audio.sampleRate.toLocaleString()} Hz</span>
                          </div>
                        )}
                        {audio.groupId && (
                          <div className="audio-detail">
                            <span className="detail-label">Group ID</span>
                            <span className="detail-value">{audio.groupId}</span>
                          </div>
                        )}
                        {audio.characteristics && (
                          <div className="audio-detail full-width">
                            <span className="detail-label">Characteristics</span>
                            <span className="detail-value">{audio.characteristics}</span>
                          </div>
                        )}
                      </div>
                      {audio.url && !audio.isMuxed && (
                        <div className="audio-url-row">
                          <code className="audio-url" title={audio.url}>{audio.url}</code>
                          <CopyButton text={audio.url} variant="icon" size="small" title="Copy audio URL" />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Expand indicator */}
                  <div className="audio-card-expand">
                    {isExpanded ? '▲' : '▼'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Subtitles */}
      {subtitles.length > 0 && (
        <div className="manifest-section">
          <h4 className="section-title">Subtitles ({subtitles.length})</h4>
          <div className="subtitle-list expandable">
            {subtitles.map((sub, i) => {
              const key = `sub-${i}`;
              const isExpanded = expandedVariants.has(key);
              return (
                <div key={i} className={`subtitle-item expandable ${isExpanded ? 'expanded' : ''}`}>
                  <div className="subtitle-header clickable" onClick={() => toggleVariant(key)}>
                    <span className="expand-indicator">{isExpanded ? '▼' : '▶'}</span>
                    <span className="lang-badge">{sub.language || 'UND'}</span>
                    <span>{sub.name || 'Unnamed'}</span>
                    {sub.forced && <span className="forced-badge">Forced</span>}
                  </div>
                  {isExpanded && (
                    <div className="variant-details">
                      <div className="variant-url-row">
                        <span className="url-label">URL:</span>
                        <span className="url-value" title={sub.url}>{sub.url}</span>
                        <button
                          className="copy-btn-small"
                          onClick={(e) => { e.stopPropagation(); copyToClipboard(sub.url); }}
                          title="Copy URL"
                        >
                          📋
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Raw Manifest */}
      {rawManifest && (
        <div className="manifest-section">
          <h4 className="section-title">
            Raw Manifest
            <button
              className="copy-btn"
              onClick={() => copyToClipboard(rawManifest)}
              title="Copy raw manifest"
            >
              Copy
            </button>
          </h4>
          <pre className="raw-manifest">{rawManifest.slice(0, 2000)}{rawManifest.length > 2000 ? '...' : ''}</pre>
        </div>
      )}

      {/* Show message if no content */}
      {videoVariants.length === 0 && audioVariants.length === 0 && !rawManifest && (
        <div className="tab-empty">
          <p>No manifest data available</p>
        </div>
      )}
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
        <p className="hint">
          This stream appears to be unencrypted.
          <br />
          DRM info is extracted from:
        </p>
        <ul className="hint-list">
          <li>HLS: EXT-X-KEY tags with SAMPLE-AES</li>
          <li>DASH: ContentProtection elements</li>
        </ul>
      </div>
    );
  }

  return (
    <div className="drm-details">
      <div className="drm-summary">
        <span className="drm-count">{drm.length} DRM system{drm.length > 1 ? 's' : ''} detected</span>
      </div>
      {drm.map((drmInfo, i) => (
        <div key={i} className="drm-card">
          <div className="drm-header">
            <span className={`drm-badge ${typeToClassName(drmInfo.type)}`}>
              {safeUpperCase(drmInfo.type)}
            </span>
            <span className="drm-system-name">
              {drmInfo.type === 'widevine' && 'Google Widevine'}
              {drmInfo.type === 'playready' && 'Microsoft PlayReady'}
              {drmInfo.type === 'fairplay' && 'Apple FairPlay'}
              {drmInfo.type === 'clearkey' && 'Clear Key'}
              {drmInfo.type === 'unknown' && 'Unknown System'}
            </span>
          </div>
          <div className="drm-info">
            {drmInfo.keyId && (
              <div className="drm-field">
                <span className="field-label">Key ID</span>
                <div className="field-value-row">
                  <code className="field-value">{drmInfo.keyId}</code>
                  <button className="copy-btn-small" onClick={() => copyToClipboard(drmInfo.keyId!)} title="Copy">
                    📋
                  </button>
                </div>
              </div>
            )}
            {drmInfo.licenseUrl && (
              <div className="drm-field">
                <span className="field-label">License URL</span>
                <div className="field-value-row">
                  <code className="field-value">{drmInfo.licenseUrl}</code>
                  <button className="copy-btn-small" onClick={() => copyToClipboard(drmInfo.licenseUrl!)} title="Copy">
                    📋
                  </button>
                </div>
              </div>
            )}
            {drmInfo.pssh && (
              <div className="drm-field">
                <span className="field-label">PSSH (Base64)</span>
                <div className="field-value-row">
                  <code className="field-value pssh">{drmInfo.pssh.slice(0, 80)}{drmInfo.pssh.length > 80 ? '...' : ''}</code>
                  <button className="copy-btn-small" onClick={() => copyToClipboard(drmInfo.pssh!)} title="Copy full PSSH">
                    📋
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorsTab({ stream }: { stream: DetectedStream }) {
  const { error } = stream;

  return (
    <div className="errors-tab">
      <ErrorDisplay error={error} showSearch={!error} />
    </div>
  );
}

// Utility function
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

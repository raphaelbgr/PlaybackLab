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

interface StreamDetailsProps {
  stream: DetectedStream | null;
}

type DetailTab = 'overview' | 'manifest' | 'payload' | 'metrics' | 'drm';

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
          className={`details-tab ${activeTab === 'metrics' ? 'active' : ''}`}
          onClick={() => handleTabChange('metrics')}
        >
          Metrics
        </button>
        <button
          className={`details-tab ${activeTab === 'drm' ? 'active' : ''}`}
          onClick={() => handleTabChange('drm')}
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
        {activeTab === 'payload' && <PayloadTab stream={stream} />}
        {activeTab === 'metrics' && <MetricsTab stream={stream} />}
        {activeTab === 'drm' && <DrmTab stream={stream} />}
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
            const parsed = parser.parse(text, info.url);
            updateManifest(info.id, parsed);
          } else if (info.type === 'dash') {
            const { DashManifestParser } = await import('../../../core/services/DashManifestParser');
            const parser = new DashManifestParser();
            const parsed = parser.parse(text, info.url);
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

  // Basic info - always available
  const basicStats = [
    {
      label: 'Type',
      value: safeUpperCase(info.type),
      icon: '📺',
    },
    {
      label: 'Status',
      value: info.playbackState ? capitalizeFirst(info.playbackState) : (info.isActive ? 'Active' : 'Detected'),
      icon: info.playbackState === 'playing' ? '▶️' : (info.playbackState === 'paused' ? '⏸️' : '○'),
    },
    {
      label: 'Audio',
      value: info.hasAudio ? (info.audioMuted ? 'Muted' : 'Available') : '—',
      icon: info.audioMuted ? '🔇' : '🔊',
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

  return (
    <div className="overview-content">
      {/* Basic Info Section */}
      <div className="overview-section">
        <h4 className="section-title">Stream Info</h4>
        <div className="overview-grid compact">
          {basicStats.map((stat) => (
            <div key={stat.label} className="stat-card">
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
                <span className="payload-duration">{formatDurationMs(req.duration)}</span>
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
  const rawManifest = manifest.raw || '';

  return (
    <div className="manifest-details">
      {/* Video Variants */}
      {videoVariants.length > 0 && (
        <div className="manifest-section">
          <h4 className="section-title">Video Variants ({videoVariants.length})</h4>
          <div className="variants-table">
            <div className="table-header">
              <span>Resolution</span>
              <span>Bandwidth</span>
              <span>Codecs</span>
            </div>
            {[...videoVariants]
              .sort((a, b) => (b.height || 0) - (a.height || 0))
              .map((variant, i) => (
                <div key={i} className="table-row">
                  <span>{variant.width || 0}x{variant.height || 0}</span>
                  <span>{formatBitrate(variant.bandwidth || 0)}</span>
                  <span className="codecs">{variant.codecs || '—'}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Audio Variants */}
      {audioVariants.length > 0 && (
        <div className="manifest-section">
          <h4 className="section-title">Audio Tracks ({audioVariants.length})</h4>
          <div className="variants-table">
            <div className="table-header">
              <span>Language</span>
              <span>Name</span>
              <span>Channels</span>
            </div>
            {audioVariants.map((audio, i) => (
              <div key={i} className="table-row">
                <span>{audio.language || '—'}</span>
                <span>{audio.name || 'Default'}</span>
                <span>{audio.channels || 2}ch</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subtitles */}
      {subtitles.length > 0 && (
        <div className="manifest-section">
          <h4 className="section-title">Subtitles ({subtitles.length})</h4>
          <div className="subtitle-list">
            {subtitles.map((sub, i) => (
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
      {rawManifest && (
        <div className="manifest-section">
          <h4 className="section-title">Raw Manifest</h4>
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

function MetricsTab({ stream }: { stream: DetectedStream }) {
  const metrics = stream.metrics || [];
  const latestMetrics = metrics.length > 0 ? metrics[metrics.length - 1] : null;

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
            {latestMetrics.resolution?.width || 0}x{latestMetrics.resolution?.height || 0}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Buffer</div>
          <div className="metric-value">
            {latestMetrics.buffered?.length > 0
              ? `${(latestMetrics.buffered[0].end - latestMetrics.currentTime).toFixed(1)}s`
              : '—'}
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

// Utility function
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

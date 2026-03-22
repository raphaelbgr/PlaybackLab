/**
 * NetworkInspector Component - View segment and manifest requests
 * SOLID: Single Responsibility - Network request display only
 */

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import type { DetectedStream } from '../../../store';

interface NetworkRequest {
  id: string;
  url: string;
  type: 'manifest' | 'segment' | 'key' | 'init' | 'other';
  method: string;
  status: number;
  statusText: string;
  size: number;
  duration: number;
  timestamp: number;
  mimeType?: string;
}

interface Props {
  stream: DetectedStream | null;
}

export function NetworkInspector({ stream }: Props) {
  const [requests, setRequests] = useState<NetworkRequest[]>([]);
  const [filter, setFilter] = useState<'all' | 'manifest' | 'segment' | 'error'>('all');
  const [isCapturing, setIsCapturing] = useState(true); // Auto-start monitoring
  const [selectedRequest, setSelectedRequest] = useState<NetworkRequest | null>(null);

  // Listen for network requests from background
  useEffect(() => {
    if (!stream || !isCapturing) return;

    const handleMessage = (message: { type: string; payload?: NetworkRequest }) => {
      if (message.type === 'NETWORK_REQUEST' && message.payload) {
        setRequests((prev) => [...prev, message.payload!].slice(-100)); // Keep last 100
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
      chrome.runtime.sendMessage({
        type: 'STOP_NETWORK_CAPTURE',
        tabId: stream.info.tabId,
      });
    };
  }, [stream, isCapturing]);

  // Filter requests
  const filteredRequests = requests.filter((req) => {
    switch (filter) {
      case 'manifest':
        return req.type === 'manifest';
      case 'segment':
        return req.type === 'segment' || req.type === 'init';
      case 'error':
        return req.status >= 400 || req.status === 0;
      default:
        return true;
    }
  });

  // Format file size
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '--';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Format duration
  const formatDuration = (ms: number): string => {
    if (ms === 0) return '--';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  // Get status color
  const getStatusColor = (status: number): string => {
    if (status === 0) return 'error';
    if (status < 300) return 'success';
    if (status < 400) return 'warning';
    return 'error';
  };

  // Get type badge color
  const getTypeBadgeClass = (type: NetworkRequest['type']): string => {
    switch (type) {
      case 'manifest':
        return 'badge-manifest';
      case 'segment':
        return 'badge-segment';
      case 'init':
        return 'badge-init';
      case 'key':
        return 'badge-key';
      default:
        return 'badge-other';
    }
  };

  // Clear requests
  const handleClear = () => {
    setRequests([]);
    setSelectedRequest(null);
  };

  // Extract filename from URL
  const getFilename = (url: string): string => {
    try {
      const urlObj = new URL(url);
      const segments = urlObj.pathname.split('/').filter(Boolean);
      return segments[segments.length - 1] || urlObj.pathname;
    } catch {
      return url.slice(0, 50);
    }
  };

  if (!stream) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🌐</div>
        <h3 className="empty-state-title">No Stream Selected</h3>
        <p className="empty-state-text">
          Select a stream from the Streams tab to monitor network requests.
        </p>
      </div>
    );
  }

  return (
    <div className="network-inspector scrollable-panel">
      <div className="network-header">
        <h2>Network Inspector</h2>
        <div className="network-actions">
          <button
            className={`btn ${isCapturing ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setIsCapturing(!isCapturing)}
          >
            {isCapturing ? 'Stop' : 'Start'} Capture
          </button>
          <button className="btn btn-secondary" onClick={handleClear}>
            Clear
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="network-filters">
        <button
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({requests.length})
        </button>
        <button
          className={`filter-btn ${filter === 'manifest' ? 'active' : ''}`}
          onClick={() => setFilter('manifest')}
        >
          Manifests
        </button>
        <button
          className={`filter-btn ${filter === 'segment' ? 'active' : ''}`}
          onClick={() => setFilter('segment')}
        >
          Segments
        </button>
        <button
          className={`filter-btn ${filter === 'error' ? 'active' : ''}`}
          onClick={() => setFilter('error')}
        >
          Errors ({requests.filter((r) => r.status >= 400 || r.status === 0).length})
        </button>
      </div>

      {/* Request List */}
      <div className="network-list">
        {filteredRequests.length === 0 ? (
          <div className="network-empty">
            {isCapturing
              ? 'Waiting for requests...'
              : 'Click "Start Capture" to monitor network requests.'}
          </div>
        ) : (
          <table className="network-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Type</th>
                <th>Name</th>
                <th>Size</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((req) => (
                <tr
                  key={req.id}
                  className={selectedRequest?.id === req.id ? 'selected' : ''}
                  onClick={() => setSelectedRequest(req)}
                >
                  <td className={`status-cell ${getStatusColor(req.status)}`}>
                    {req.status || 'ERR'}
                  </td>
                  <td>
                    <span className={`type-badge ${getTypeBadgeClass(req.type)}`}>
                      {req.type}
                    </span>
                  </td>
                  <td className="name-cell" title={req.url}>
                    {getFilename(req.url)}
                  </td>
                  <td>{formatSize(req.size)}</td>
                  <td>{formatDuration(req.duration)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Request Details */}
      {selectedRequest && (
        <div className="request-details">
          <h3>Request Details</h3>
          <div className="detail-row">
            <span className="detail-label">URL</span>
            <span className="detail-value url">{selectedRequest.url}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Method</span>
            <span className="detail-value">{selectedRequest.method}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Status</span>
            <span className="detail-value">
              {selectedRequest.status} {selectedRequest.statusText}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">MIME Type</span>
            <span className="detail-value">{selectedRequest.mimeType || 'Unknown'}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Size</span>
            <span className="detail-value">{formatSize(selectedRequest.size)}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Duration</span>
            <span className="detail-value">{formatDuration(selectedRequest.duration)}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Requested</span>
            <span className="detail-value">
              {formatDistanceToNow(selectedRequest.timestamp, { addSuffix: true })}
            </span>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      {requests.length > 0 && (
        <div className="network-stats">
          <div className="stat">
            <span className="stat-value">{requests.length}</span>
            <span className="stat-label">Total Requests</span>
          </div>
          <div className="stat">
            <span className="stat-value">
              {formatSize(requests.reduce((sum, r) => sum + r.size, 0))}
            </span>
            <span className="stat-label">Total Size</span>
          </div>
          <div className="stat">
            <span className="stat-value">
              {requests.filter((r) => r.type === 'segment').length}
            </span>
            <span className="stat-label">Segments</span>
          </div>
          <div className="stat">
            <span className="stat-value">
              {requests.filter((r) => r.status >= 400 || r.status === 0).length}
            </span>
            <span className="stat-label">Errors</span>
          </div>
        </div>
      )}
    </div>
  );
}

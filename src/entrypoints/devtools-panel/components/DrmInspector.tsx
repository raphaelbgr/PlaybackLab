/**
 * DrmInspector Component - View DRM sessions and license info
 * SOLID: Single Responsibility - DRM debugging only
 */

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import type { DetectedStream } from '../../../store';

interface DrmSession {
  id: string;
  type: 'widevine' | 'playready' | 'fairplay' | 'clearkey' | 'unknown';
  status: 'pending' | 'active' | 'expired' | 'error';
  keyIds: string[];
  createdAt: number;
  expiresAt?: number;
  licenseUrl?: string;
}

interface LicenseRequest {
  id: string;
  sessionId: string;
  url: string;
  method: string;
  status: number;
  duration: number;
  timestamp: number;
  error?: string;
}

interface Props {
  stream: DetectedStream | null;
}

// DRM type display info
const DRM_INFO: Record<string, { name: string; color: string; description: string }> = {
  widevine: {
    name: 'Widevine',
    color: '#4CAF50',
    description: 'Google Widevine DRM - Used by Chrome, Android, and many streaming services',
  },
  playready: {
    name: 'PlayReady',
    color: '#2196F3',
    description: 'Microsoft PlayReady DRM - Used by Edge, Xbox, and Windows apps',
  },
  fairplay: {
    name: 'FairPlay',
    color: '#9C27B0',
    description: 'Apple FairPlay DRM - Used by Safari and Apple devices',
  },
  clearkey: {
    name: 'ClearKey',
    color: '#FF9800',
    description: 'W3C Clear Key - Basic encryption without commercial DRM',
  },
  unknown: {
    name: 'Unknown',
    color: '#757575',
    description: 'Unknown DRM system',
  },
};

export function DrmInspector({ stream }: Props) {
  const [sessions, setSessions] = useState<DrmSession[]>([]);
  const [licenseRequests, setLicenseRequests] = useState<LicenseRequest[]>([]);
  const [selectedSession, setSelectedSession] = useState<DrmSession | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);

  // Parse DRM info from manifest
  useEffect(() => {
    if (!stream?.manifest) return;

    const drmInfo = stream.manifest.drm || [];
    const newSessions: DrmSession[] = drmInfo.map((drm, index) => ({
      id: `drm-${index}-${Date.now()}`,
      type: drm.type.toLowerCase() as DrmSession['type'],
      status: 'active',
      keyIds: drm.keyId ? [drm.keyId] : [],
      createdAt: Date.now(),
      licenseUrl: drm.licenseUrl,
    }));

    if (newSessions.length > 0) {
      setSessions(newSessions);
    }
  }, [stream?.manifest]);

  // Listen for DRM events from content script
  useEffect(() => {
    if (!stream || !isMonitoring) return;

    const handleMessage = (message: { type: string; payload?: unknown }) => {
      if (message.type === 'DRM_SESSION_CREATED') {
        const session = message.payload as DrmSession;
        setSessions((prev) => [...prev, session]);
      }
      if (message.type === 'LICENSE_REQUEST') {
        const request = message.payload as LicenseRequest;
        setLicenseRequests((prev) => [...prev, request].slice(-50));
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    // Start DRM monitoring
    chrome.runtime.sendMessage({
      type: 'START_DRM_MONITORING',
      tabId: stream.info.tabId,
    });

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
      chrome.runtime.sendMessage({
        type: 'STOP_DRM_MONITORING',
        tabId: stream.info.tabId,
      });
    };
  }, [stream, isMonitoring]);

  // Get status badge style
  const getStatusStyle = (status: DrmSession['status']) => {
    switch (status) {
      case 'active':
        return 'status-active';
      case 'pending':
        return 'status-pending';
      case 'expired':
        return 'status-expired';
      case 'error':
        return 'status-error';
      default:
        return '';
    }
  };

  // Format key ID for display
  const formatKeyId = (keyId: string): string => {
    if (keyId.length > 32) {
      return `${keyId.slice(0, 16)}...${keyId.slice(-8)}`;
    }
    return keyId;
  };

  if (!stream) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔐</div>
        <h3 className="empty-state-title">No Stream Selected</h3>
        <p className="empty-state-text">
          Select a stream from the Streams tab to inspect DRM information.
        </p>
      </div>
    );
  }

  const hasDrm = sessions.length > 0 || (stream.manifest?.drm && stream.manifest.drm.length > 0);

  return (
    <div className="drm-inspector">
      <div className="drm-header">
        <h2>DRM Inspector</h2>
        <div className="drm-actions">
          <button
            className={`btn ${isMonitoring ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setIsMonitoring(!isMonitoring)}
          >
            {isMonitoring ? 'Stop' : 'Start'} Monitoring
          </button>
        </div>
      </div>

      {!hasDrm ? (
        <div className="drm-no-protection">
          <div className="no-drm-icon">🔓</div>
          <h3>No DRM Protection Detected</h3>
          <p>This stream does not appear to use DRM encryption.</p>
          <p className="drm-hint">
            If you expect DRM, make sure the manifest has been parsed and try playing the video.
          </p>
        </div>
      ) : (
        <>
          {/* DRM Overview */}
          <div className="drm-overview">
            <h3>Protection Systems</h3>
            <div className="drm-systems">
              {sessions.map((session) => {
                const info = DRM_INFO[session.type] || DRM_INFO.unknown;
                return (
                  <div
                    key={session.id}
                    className={`drm-system-card ${selectedSession?.id === session.id ? 'selected' : ''}`}
                    onClick={() => setSelectedSession(session)}
                    style={{ borderLeftColor: info.color }}
                  >
                    <div className="drm-system-header">
                      <span className="drm-system-name">{info.name}</span>
                      <span className={`drm-status ${getStatusStyle(session.status)}`}>
                        {session.status}
                      </span>
                    </div>
                    <p className="drm-system-desc">{info.description}</p>
                    {session.keyIds.length > 0 && (
                      <div className="drm-key-count">
                        {session.keyIds.length} key{session.keyIds.length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Session Details */}
          {selectedSession && (
            <div className="drm-session-details">
              <h3>Session Details</h3>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">Session ID</span>
                  <span className="detail-value mono">{selectedSession.id}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">DRM Type</span>
                  <span className="detail-value">
                    {DRM_INFO[selectedSession.type]?.name || 'Unknown'}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Status</span>
                  <span className={`detail-value ${getStatusStyle(selectedSession.status)}`}>
                    {selectedSession.status}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Created</span>
                  <span className="detail-value">
                    {formatDistanceToNow(selectedSession.createdAt, { addSuffix: true })}
                  </span>
                </div>
                {selectedSession.licenseUrl && (
                  <div className="detail-item full-width">
                    <span className="detail-label">License URL</span>
                    <span className="detail-value mono url">{selectedSession.licenseUrl}</span>
                  </div>
                )}
              </div>

              {/* Key IDs */}
              {selectedSession.keyIds.length > 0 && (
                <div className="drm-keys">
                  <h4>Key IDs</h4>
                  <div className="key-list">
                    {selectedSession.keyIds.map((keyId, index) => (
                      <div key={index} className="key-item">
                        <span className="key-index">#{index + 1}</span>
                        <code className="key-value">{formatKeyId(keyId)}</code>
                        <button
                          className="btn-icon"
                          onClick={() => navigator.clipboard.writeText(keyId)}
                          title="Copy full key ID"
                        >
                          📋
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* License Requests */}
          {licenseRequests.length > 0 && (
            <div className="license-requests">
              <h3>License Requests</h3>
              <div className="request-list">
                {licenseRequests.map((req) => (
                  <div key={req.id} className="request-item">
                    <span className={`request-status ${req.status < 400 ? 'success' : 'error'}`}>
                      {req.status}
                    </span>
                    <span className="request-url">{new URL(req.url).pathname}</span>
                    <span className="request-duration">{req.duration}ms</span>
                    <span className="request-time">
                      {formatDistanceToNow(req.timestamp, { addSuffix: true })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DRM Compatibility Info */}
          <div className="drm-compatibility">
            <h3>Browser Compatibility</h3>
            <table className="compatibility-table">
              <thead>
                <tr>
                  <th>Browser</th>
                  <th>Widevine</th>
                  <th>PlayReady</th>
                  <th>FairPlay</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Chrome</td>
                  <td className="supported">✓</td>
                  <td className="not-supported">✗</td>
                  <td className="not-supported">✗</td>
                </tr>
                <tr>
                  <td>Firefox</td>
                  <td className="supported">✓</td>
                  <td className="not-supported">✗</td>
                  <td className="not-supported">✗</td>
                </tr>
                <tr>
                  <td>Safari</td>
                  <td className="not-supported">✗</td>
                  <td className="not-supported">✗</td>
                  <td className="supported">✓</td>
                </tr>
                <tr>
                  <td>Edge</td>
                  <td className="supported">✓</td>
                  <td className="supported">✓</td>
                  <td className="not-supported">✗</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

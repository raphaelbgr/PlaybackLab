/**
 * SOLID: Single Responsibility - Only inspects DRM
 * SOLID: Interface Segregation - Focused on DRM inspection
 */

export interface DrmSession {
  id: string;
  type: 'widevine' | 'playready' | 'fairplay' | 'clearkey';
  status: 'pending' | 'active' | 'closed' | 'error';
  keyIds: string[];
  createdAt: number;
  expiresAt?: number;
}

export interface LicenseRequest {
  id: string;
  sessionId: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: ArrayBuffer;
  timestamp: number;
}

export interface LicenseResponse {
  requestId: string;
  status: number;
  headers: Record<string, string>;
  body?: ArrayBuffer;
  timestamp: number;
  duration: number;
}

export interface KeyInfo {
  keyId: string;
  status: 'usable' | 'expired' | 'output-restricted' | 'output-downscaled' | 'status-pending' | 'internal-error';
  type: 'temporary' | 'persistent';
}

export interface IDrmInspector {
  /**
   * Start monitoring DRM activity
   */
  start(): void;

  /**
   * Stop monitoring
   */
  stop(): void;

  /**
   * Get active DRM sessions
   */
  getSessions(): DrmSession[];

  /**
   * Get license requests history
   */
  getLicenseRequests(): LicenseRequest[];

  /**
   * Get license responses history
   */
  getLicenseResponses(): LicenseResponse[];

  /**
   * Subscribe to new session events
   */
  onSessionCreated(callback: (session: DrmSession) => void): () => void;

  /**
   * Subscribe to license request events
   */
  onLicenseRequest(callback: (request: LicenseRequest) => void): () => void;

  /**
   * Subscribe to key status change events
   */
  onKeyStatusChange(callback: (sessionId: string, keys: KeyInfo[]) => void): () => void;

  /**
   * Clear all collected data
   */
  clear(): void;
}

/**
 * SOLID: Single Responsibility - Only detects streams
 * SOLID: Interface Segregation - Focused on detection only
 */

export interface StreamInfo {
  id: string;
  url: string;
  type: 'hls' | 'dash' | 'unknown';
  detectedAt: number;
  tabId: number;
  frameId: number;
  initiator?: string;
}

export interface DetectionResult {
  detected: boolean;
  stream?: StreamInfo;
  error?: string;
}

export interface IStreamDetector {
  /**
   * Check if a URL is a video stream
   */
  isStreamUrl(url: string): boolean;

  /**
   * Detect stream type from URL
   */
  detectStreamType(url: string): 'hls' | 'dash' | 'unknown';

  /**
   * Process a network request and extract stream info
   */
  processRequest(details: chrome.webRequest.WebRequestDetails): DetectionResult;

  /**
   * Subscribe to stream detection events
   */
  onStreamDetected(callback: (stream: StreamInfo) => void): () => void;
}

/**
 * StreamDetector - Implements IStreamDetector
 * SOLID: Single Responsibility - Only detects video streams
 */

import type { IStreamDetector, StreamInfo, DetectionResult } from '../interfaces/IStreamDetector';

type StreamDetectedCallback = (stream: StreamInfo) => void;

export class StreamDetector implements IStreamDetector {
  private callbacks: Set<StreamDetectedCallback> = new Set();
  private detectedStreams: Map<string, StreamInfo> = new Map();

  private readonly HLS_PATTERNS = [
    /\.m3u8(\?|$)/i,
    /\/manifest\(/i,
    /\/playlist\./i,
    /hls.*\.m3u8/i,
  ];

  private readonly DASH_PATTERNS = [
    /\.mpd(\?|$)/i,
    /\/manifest\.mpd/i,
    /dash.*\.mpd/i,
  ];

  isStreamUrl(url: string): boolean {
    return this.detectStreamType(url) !== 'unknown';
  }

  detectStreamType(url: string): 'hls' | 'dash' | 'unknown' {
    const lowerUrl = url.toLowerCase();

    for (const pattern of this.HLS_PATTERNS) {
      if (pattern.test(lowerUrl)) {
        return 'hls';
      }
    }

    for (const pattern of this.DASH_PATTERNS) {
      if (pattern.test(lowerUrl)) {
        return 'dash';
      }
    }

    return 'unknown';
  }

  processRequest(details: chrome.webRequest.WebRequestDetails): DetectionResult {
    const { url, tabId, frameId, initiator, requestId } = details;

    if (!this.isStreamUrl(url)) {
      return { detected: false };
    }

    // Avoid duplicate detection
    const streamKey = `${tabId}-${url}`;
    if (this.detectedStreams.has(streamKey)) {
      return {
        detected: true,
        stream: this.detectedStreams.get(streamKey),
      };
    }

    const stream: StreamInfo = {
      id: `stream-${requestId}-${Date.now()}`,
      url,
      type: this.detectStreamType(url),
      detectedAt: Date.now(),
      tabId,
      frameId,
      initiator: initiator ?? undefined,
    };

    this.detectedStreams.set(streamKey, stream);
    this.notifyCallbacks(stream);

    return { detected: true, stream };
  }

  onStreamDetected(callback: StreamDetectedCallback): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  private notifyCallbacks(stream: StreamInfo): void {
    for (const callback of this.callbacks) {
      try {
        callback(stream);
      } catch (error) {
        console.error('[StreamDetector] Callback error:', error);
      }
    }
  }

  clearForTab(tabId: number): void {
    for (const [key, stream] of this.detectedStreams) {
      if (stream.tabId === tabId) {
        this.detectedStreams.delete(key);
      }
    }
  }
}

// Singleton instance
export const streamDetector = new StreamDetector();

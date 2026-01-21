/**
 * SOLID: Single Responsibility - Only detects streams
 * SOLID: Interface Segregation - Focused on detection only
 */

export type PlaybackState = 'playing' | 'paused' | 'buffering' | 'stalled' | 'ended' | 'idle';

export type StreamContentType = 'video' | 'audio' | 'subtitle' | 'mixed' | 'unknown';

export type StreamRole = 'master' | 'variant' | 'audio-track' | 'subtitle-track' | 'standalone';

export interface StreamInfo {
  id: string;
  url: string;
  type: 'hls' | 'dash' | 'mse' | 'unknown';
  detectedAt: number;
  tabId: number;
  frameId: number;
  initiator?: string;
  requestHeaders?: Record<string, string>;
  isMaster?: boolean;  // True if this is a master/main manifest
  isActive?: boolean;  // True if actively being played by a video element
  platform?: string;   // Platform identifier (youtube, vimeo, twitch, etc.)
  title?: string;      // Video/stream title (from page or manifest)
  pageTitle?: string;  // Page title where stream was detected
  pageUrl?: string;    // Page URL where stream was detected

  // Playback state
  playbackState?: PlaybackState;  // Current playback state

  // Audio info
  hasAudio?: boolean;    // True if stream has audio (separate or muxed)
  audioMuted?: boolean;  // True if audio is muted
  volume?: number;       // Volume level (0-1)
  hasMuxedAudio?: boolean;  // True if audio is muxed with video (not separate tracks)

  // Content classification
  contentType?: StreamContentType;  // Type of content (video, audio, subtitle, mixed)
  role?: StreamRole;                // Role in stream hierarchy (master, variant, track)
  parentStreamId?: string;          // ID of parent stream (for variants/tracks)
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
  detectStreamType(url: string): 'hls' | 'dash' | 'mse' | 'unknown';

  /**
   * Process a network request and extract stream info
   */
  processRequest(details: chrome.webRequest.WebRequestDetails): DetectionResult;

  /**
   * Subscribe to stream detection events
   */
  onStreamDetected(callback: (stream: StreamInfo) => void): () => void;
}

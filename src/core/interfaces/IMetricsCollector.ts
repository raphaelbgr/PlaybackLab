/**
 * SOLID: Single Responsibility - Only collects playback metrics
 * SOLID: Interface Segregation - Focused interface for metrics
 */

export interface PlaybackMetrics {
  timestamp: number;
  currentTime: number;
  duration: number;
  buffered: BufferRange[];
  bitrate: number;
  resolution: { width: number; height: number };
  droppedFrames: number;
  totalFrames: number;
  bandwidth: number;
  latency?: number;
}

export interface BufferRange {
  start: number;
  end: number;
}

export interface BufferingEvent {
  type: 'start' | 'end';
  timestamp: number;
  position: number;
  duration?: number;
}

export interface QualitySwitchEvent {
  timestamp: number;
  fromBitrate: number;
  toBitrate: number;
  fromResolution: { width: number; height: number };
  toResolution: { width: number; height: number };
  reason?: string;
}

export interface ErrorEvent {
  timestamp: number;
  type: string;
  message: string;
  fatal: boolean;
  details?: Record<string, unknown>;
}

export interface IMetricsCollector {
  /**
   * Start collecting metrics
   */
  start(): void;

  /**
   * Stop collecting metrics
   */
  stop(): void;

  /**
   * Get current metrics snapshot
   */
  getCurrentMetrics(): PlaybackMetrics | null;

  /**
   * Get metrics history
   */
  getHistory(): PlaybackMetrics[];

  /**
   * Subscribe to buffering events
   */
  onBuffering(callback: (event: BufferingEvent) => void): () => void;

  /**
   * Subscribe to quality switch events
   */
  onQualitySwitch(callback: (event: QualitySwitchEvent) => void): () => void;

  /**
   * Subscribe to error events
   */
  onError(callback: (event: ErrorEvent) => void): () => void;

  /**
   * Clear collected data
   */
  clear(): void;
}

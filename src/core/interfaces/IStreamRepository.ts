/**
 * SOLID: Single Responsibility - Only manages stream data storage
 * SOLID: Dependency Inversion - High-level modules depend on this abstraction
 */

import type { StreamInfo } from './IStreamDetector';
import type { ParsedManifest } from './IManifestParser';
import type { PlaybackMetrics } from './IMetricsCollector';
import type { DrmSession, LicenseRequest, LicenseResponse } from './IDrmInspector';

export interface StoredStream {
  info: StreamInfo;
  manifest?: ParsedManifest;
  metrics: PlaybackMetrics[];
  drmSessions: DrmSession[];
  licenseRequests: LicenseRequest[];
  licenseResponses: LicenseResponse[];
  createdAt: number;
  updatedAt: number;
}

export interface StreamFilter {
  tabId?: number;
  type?: 'hls' | 'dash' | 'unknown';
  since?: number;
  limit?: number;
}

export interface IStreamRepository {
  /**
   * Save or update a stream
   */
  save(stream: StoredStream): Promise<void>;

  /**
   * Get stream by ID
   */
  getById(id: string): Promise<StoredStream | null>;

  /**
   * Get all streams with optional filter
   */
  getAll(filter?: StreamFilter): Promise<StoredStream[]>;

  /**
   * Delete stream by ID
   */
  delete(id: string): Promise<void>;

  /**
   * Delete all streams for a tab
   */
  deleteByTab(tabId: number): Promise<void>;

  /**
   * Clear all stored streams
   */
  clear(): Promise<void>;

  /**
   * Update stream metrics
   */
  updateMetrics(id: string, metrics: PlaybackMetrics): Promise<void>;

  /**
   * Update stream manifest
   */
  updateManifest(id: string, manifest: ParsedManifest): Promise<void>;

  /**
   * Subscribe to stream changes
   */
  onChange(callback: (streams: StoredStream[]) => void): () => void;
}

/**
 * Zustand Store - Global State Management
 * SOLID: Single Responsibility - Only manages UI state
 */

import { create } from 'zustand';
import type { StreamInfo } from '../core/interfaces/IStreamDetector';
import type { ParsedManifest } from '../core/interfaces/IManifestParser';
import type { PlaybackMetrics } from '../core/interfaces/IMetricsCollector';

export interface DetectedStream {
  info: StreamInfo;
  manifest?: ParsedManifest;
  metrics: PlaybackMetrics[];
  isLoading: boolean;
  error?: string;
}

export interface AppState {
  // Streams
  streams: Map<string, DetectedStream>;
  selectedStreamId: string | null;

  // UI State
  activeTab: 'streams' | 'manifest' | 'metrics' | 'drm' | 'network';
  isPanelExpanded: boolean;

  // Actions
  addStream: (stream: StreamInfo) => void;
  removeStream: (id: string) => void;
  selectStream: (id: string | null) => void;
  updateManifest: (id: string, manifest: ParsedManifest) => void;
  addMetrics: (id: string, metrics: PlaybackMetrics) => void;
  setStreamLoading: (id: string, loading: boolean) => void;
  setStreamError: (id: string, error: string) => void;
  setActiveTab: (tab: AppState['activeTab']) => void;
  togglePanel: () => void;
  clearAll: () => void;
}

export const useStore = create<AppState>((set) => ({
  // Initial state
  streams: new Map(),
  selectedStreamId: null,
  activeTab: 'streams',
  isPanelExpanded: true,

  // Actions
  addStream: (stream) =>
    set((state) => {
      const newStreams = new Map(state.streams);
      newStreams.set(stream.id, {
        info: stream,
        metrics: [],
        isLoading: false,
      });
      return {
        streams: newStreams,
        selectedStreamId: state.selectedStreamId ?? stream.id,
      };
    }),

  removeStream: (id) =>
    set((state) => {
      const newStreams = new Map(state.streams);
      newStreams.delete(id);
      return {
        streams: newStreams,
        selectedStreamId:
          state.selectedStreamId === id
            ? newStreams.keys().next().value ?? null
            : state.selectedStreamId,
      };
    }),

  selectStream: (id) => set({ selectedStreamId: id }),

  updateManifest: (id, manifest) =>
    set((state) => {
      const stream = state.streams.get(id);
      if (!stream) return state;
      const newStreams = new Map(state.streams);
      newStreams.set(id, { ...stream, manifest, isLoading: false });
      return { streams: newStreams };
    }),

  addMetrics: (id, metrics) =>
    set((state) => {
      const stream = state.streams.get(id);
      if (!stream) return state;
      const newStreams = new Map(state.streams);
      newStreams.set(id, {
        ...stream,
        metrics: [...stream.metrics.slice(-99), metrics], // Keep last 100
      });
      return { streams: newStreams };
    }),

  setStreamLoading: (id, loading) =>
    set((state) => {
      const stream = state.streams.get(id);
      if (!stream) return state;
      const newStreams = new Map(state.streams);
      newStreams.set(id, { ...stream, isLoading: loading });
      return { streams: newStreams };
    }),

  setStreamError: (id, error) =>
    set((state) => {
      const stream = state.streams.get(id);
      if (!stream) return state;
      const newStreams = new Map(state.streams);
      newStreams.set(id, { ...stream, error, isLoading: false });
      return { streams: newStreams };
    }),

  setActiveTab: (tab) => set({ activeTab: tab }),

  togglePanel: () => set((state) => ({ isPanelExpanded: !state.isPanelExpanded })),

  clearAll: () =>
    set({
      streams: new Map(),
      selectedStreamId: null,
    }),
}));

// Selectors for performance
export const useSelectedStream = () =>
  useStore((state) =>
    state.selectedStreamId ? state.streams.get(state.selectedStreamId) : null
  );

export const useStreamsList = () =>
  useStore((state) => Array.from(state.streams.values()));

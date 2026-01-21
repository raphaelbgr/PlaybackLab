/**
 * Zustand Store - Global State Management
 * SOLID: Single Responsibility - Only manages UI state
 */

import { create } from 'zustand';
import type { StreamInfo, PlaybackState } from '../core/interfaces/IStreamDetector';
import type { ParsedManifest } from '../core/interfaces/IManifestParser';
import type { PlaybackMetrics } from '../core/interfaces/IMetricsCollector';
import { urlsMatch } from '../shared/utils/stringUtils';

export interface PlaybackUpdate {
  playbackState?: PlaybackState;
  hasAudio?: boolean;
  audioMuted?: boolean;
  volume?: number;
  isActive?: boolean;
}

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
  activeTab: 'streams' | 'network' | 'export';
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
  updateStreamPlayback: (streamUrl: string, update: PlaybackUpdate) => void;
  updateAllPlaybackStates: (streams: StreamInfo[]) => void;
  selectStreamByUrl: (url: string) => boolean;
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
      // Check if stream with same URL already exists (dedupe)
      for (const [existingId, existingStream] of state.streams) {
        if (existingStream.info.url === stream.url) {
          // Update existing stream instead of adding duplicate
          const newStreams = new Map(state.streams);
          newStreams.set(existingId, {
            ...existingStream,
            info: { ...existingStream.info, ...stream, id: existingId },
          });
          return { streams: newStreams };
        }
      }

      // New stream - add it
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

  updateStreamPlayback: (streamUrl, update) =>
    set((state) => {
      const newStreams = new Map(state.streams);
      let updated = false;

      for (const [id, stream] of newStreams) {
        // Match by URL using robust matching function
        if (urlsMatch(stream.info.url, streamUrl)) {
          newStreams.set(id, {
            ...stream,
            info: {
              ...stream.info,
              playbackState: update.playbackState ?? stream.info.playbackState,
              hasAudio: update.hasAudio ?? stream.info.hasAudio,
              audioMuted: update.audioMuted ?? stream.info.audioMuted,
              volume: update.volume ?? stream.info.volume,
              isActive: update.isActive ?? stream.info.isActive,
            },
          });
          updated = true;
        }
      }

      return updated ? { streams: newStreams } : state;
    }),

  updateAllPlaybackStates: (updatedStreams) =>
    set((state) => {
      const newStreams = new Map(state.streams);
      let updated = false;

      for (const updatedInfo of updatedStreams) {
        for (const [id, stream] of newStreams) {
          // Match by URL using robust matching function
          if (urlsMatch(stream.info.url, updatedInfo.url)) {
            newStreams.set(id, {
              ...stream,
              info: {
                ...stream.info,
                playbackState: updatedInfo.playbackState,
                hasAudio: updatedInfo.hasAudio,
                audioMuted: updatedInfo.audioMuted,
                volume: updatedInfo.volume,
                isActive: updatedInfo.isActive,
              },
            });
            updated = true;
          }
        }
      }

      return updated ? { streams: newStreams } : state;
    }),

  selectStreamByUrl: (url) => {
    const state = useStore.getState();
    for (const [id, stream] of state.streams) {
      if (urlsMatch(stream.info.url, url)) {
        set({ selectedStreamId: id });
        return true;
      }
    }
    return false;
  },
}));

// Selectors for performance
export const useSelectedStream = () =>
  useStore((state) =>
    state.selectedStreamId ? state.streams.get(state.selectedStreamId) : null
  );

export const useStreamsList = () =>
  useStore((state) => Array.from(state.streams.values()));

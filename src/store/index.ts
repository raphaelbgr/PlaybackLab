/**
 * Zustand Store - Global State Management
 * SOLID: Single Responsibility - Only manages UI state
 */

import { create } from 'zustand';
import type { StreamInfo, PlaybackState } from '../core/interfaces/IStreamDetector';
import type { ParsedManifest } from '../core/interfaces/IManifestParser';
import type { DetectedAd, VastParseResult } from '../core/interfaces/IAdDetector';
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
  isLoading: boolean;
  error?: string;
  segmentCount: number;
  lastSegmentUrl?: string;
}

export interface AppState {
  // Streams
  streams: Map<string, DetectedStream>;
  selectedStreamId: string | null;

  // Ads
  ads: Map<string, DetectedAd>;
  selectedAdId: string | null;

  // UI State
  activeTab: 'streams' | 'network' | 'export';
  isPanelExpanded: boolean;

  // Stream Actions
  addStream: (stream: StreamInfo) => void;
  removeStream: (id: string) => void;
  selectStream: (id: string | null) => void;
  updateManifest: (id: string, manifest: ParsedManifest) => void;
  setStreamLoading: (id: string, loading: boolean) => void;
  setStreamError: (id: string, error: string) => void;
  updateStreamPlayback: (streamUrl: string, update: PlaybackUpdate) => void;
  updateAllPlaybackStates: (streams: StreamInfo[]) => void;
  incrementSegmentCount: (streamId: string, segmentUrl: string) => void;
  selectStreamByUrl: (url: string) => boolean;

  // Ad Actions
  addAd: (ad: DetectedAd) => void;
  removeAd: (id: string) => void;
  selectAd: (id: string | null) => void;
  updateAdParsedContent: (id: string, parsed: VastParseResult & { rawXml: string }) => void;
  setAdLoading: (id: string, loading: boolean) => void;
  setAdError: (id: string, error: string) => void;
  clearAds: () => void;

  // UI Actions
  setActiveTab: (tab: AppState['activeTab']) => void;
  togglePanel: () => void;
  clearAll: () => void;
}

export const useStore = create<AppState>((set) => ({
  // Initial state
  streams: new Map(),
  selectedStreamId: null,
  ads: new Map(),
  selectedAdId: null,
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
        isLoading: false,
        segmentCount: 0,
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
      ads: new Map(),
      selectedAdId: null,
    }),

  // Ad Actions
  addAd: (ad) =>
    set((state) => {
      // Check if ad with same URL already exists (dedupe)
      for (const [existingId, existingAd] of state.ads) {
        if (existingAd.url === ad.url) {
          // Update existing ad instead of adding duplicate
          const newAds = new Map(state.ads);
          newAds.set(existingId, { ...existingAd, ...ad, id: existingId });
          return { ads: newAds };
        }
      }

      // New ad - add it
      const newAds = new Map(state.ads);
      newAds.set(ad.id, ad);
      return { ads: newAds };
    }),

  removeAd: (id) =>
    set((state) => {
      const newAds = new Map(state.ads);
      newAds.delete(id);
      return {
        ads: newAds,
        selectedAdId:
          state.selectedAdId === id
            ? newAds.keys().next().value ?? null
            : state.selectedAdId,
      };
    }),

  selectAd: (id) => set({ selectedAdId: id }),

  updateAdParsedContent: (id, parsed) =>
    set((state) => {
      const ad = state.ads.get(id);
      if (!ad) return state;
      const newAds = new Map(state.ads);
      newAds.set(id, {
        ...ad,
        ...parsed,
        isLoading: false,
      });
      return { ads: newAds };
    }),

  setAdLoading: (id, loading) =>
    set((state) => {
      const ad = state.ads.get(id);
      if (!ad) return state;
      const newAds = new Map(state.ads);
      newAds.set(id, { ...ad, isLoading: loading });
      return { ads: newAds };
    }),

  setAdError: (id, error) =>
    set((state) => {
      const ad = state.ads.get(id);
      if (!ad) return state;
      const newAds = new Map(state.ads);
      newAds.set(id, { ...ad, error, isLoading: false });
      return { ads: newAds };
    }),

  clearAds: () =>
    set({
      ads: new Map(),
      selectedAdId: null,
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

  incrementSegmentCount: (streamId, segmentUrl) =>
    set((state) => {
      const stream = state.streams.get(streamId);
      if (!stream) return state;
      const newStreams = new Map(state.streams);
      newStreams.set(streamId, {
        ...stream,
        segmentCount: stream.segmentCount + 1,
        lastSegmentUrl: segmentUrl,
      });
      return { streams: newStreams };
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

// Ad selectors
export const useSelectedAd = () =>
  useStore((state) =>
    state.selectedAdId ? state.ads.get(state.selectedAdId) : null
  );

export const useAdsList = () =>
  useStore((state) => Array.from(state.ads.values()));

export const useAdsCount = () =>
  useStore((state) => state.ads.size);

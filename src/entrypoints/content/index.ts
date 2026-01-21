/**
 * Content Script
 * SOLID: Single Responsibility - Page-level video detection, metrics, and stream picking
 */

import { isBlockedUrl, isValidStreamUrl, extractUrlsFromContent, type ScannedStream } from '../../core/services/PageScanner';

interface VideoMetrics {
  bufferAhead: number;
  bitrate: number;
  droppedFrames: number;
  resolution: string;
  currentTime: number;
  duration: number;
  paused: boolean;
  readyState: number;
}

type PlaybackState = 'playing' | 'paused' | 'buffering' | 'stalled' | 'ended' | 'idle';

interface VideoPlaybackInfo {
  src: string;
  playbackState: PlaybackState;
  hasAudio: boolean;
  audioMuted: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  resolution: string;
}

interface VideoInfo {
  index: number;
  src: string;
  currentSrc: string;
  hasHls: boolean;
  hasDash: boolean;
  hasShaka: boolean;
  isPlaying: boolean;
  duration: number;
  resolution: string;
  rect: { top: number; left: number; width: number; height: number };
}

// Picker overlay state
let pickerOverlay: HTMLDivElement | null = null;
let pickerHighlights: HTMLDivElement[] = [];

// Persistent video overlay state
let persistentOverlaysEnabled = false;
let persistentOverlayContainer: HTMLDivElement | null = null;
let persistentOverlays: Map<HTMLVideoElement, HTMLDivElement> = new Map();

// Detected streams cache (populated by background script)
let detectedStreamsCache: Array<{ url: string; type: string; id: string }> = [];

// WXT content script configuration
export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    console.log('[PlaybackLab] Content script loaded');

    // ========================================
    // Context Validation (must be first)
    // ========================================

    // Check if extension context is still valid
    const isContextValid = (): boolean => {
      try {
        return !!chrome.runtime?.id;
      } catch {
        return false;
      }
    };

    // ========================================
    // Video Source Collection
    // ========================================

    const collectVideoSources = (): string[] => {
      const sources: string[] = [];
      const videos = document.querySelectorAll('video');

      videos.forEach((video) => {
        const videoElement = video as HTMLVideoElement & {
          hls?: { url?: string };
          player?: { getSource?: () => string };
          shaka?: { getAssetUri?: () => string };
        };

        // Direct sources
        if (video.src && video.src.startsWith('http')) {
          sources.push(video.src);
        }
        if (video.currentSrc && video.currentSrc.startsWith('http') && video.currentSrc !== video.src) {
          sources.push(video.currentSrc);
        }

        // HLS.js source
        if (videoElement.hls?.url) {
          sources.push(videoElement.hls.url);
        }

        // Shaka Player source
        if (videoElement.shaka?.getAssetUri) {
          const uri = videoElement.shaka.getAssetUri();
          if (uri) sources.push(uri);
        }

        // Check source elements
        const sourceElements = video.querySelectorAll('source');
        sourceElements.forEach((source) => {
          if (source.src && source.src.startsWith('http')) {
            sources.push(source.src);
          }
        });
      });

      return [...new Set(sources)];
    };

    // ========================================
    // Playback State Detection
    // ========================================

    const getPlaybackState = (video: HTMLVideoElement): PlaybackState => {
      // Check ended first
      if (video.ended) return 'ended';

      // Check if video is stalled (was playing but stopped unexpectedly)
      if (video.readyState < 3 && !video.paused && video.currentTime > 0) {
        return 'stalled';
      }

      // Check if buffering (waiting for data)
      if (video.readyState < 3 && !video.paused) {
        return 'buffering';
      }

      // Check if actively playing
      if (!video.paused && video.readyState >= 3) {
        return 'playing';
      }

      // Check if paused
      if (video.paused && video.currentTime > 0) {
        return 'paused';
      }

      // Default: idle (not yet started or reset)
      return 'idle';
    };

    const hasAudioTrack = (video: HTMLVideoElement): boolean => {
      // Check using various APIs
      try {
        // Check if video has audio tracks via audioTracks API (if available)
        const videoEl = video as HTMLVideoElement & {
          audioTracks?: { length: number };  // Simplified type for audioTracks
          mozHasAudio?: boolean;
          webkitAudioDecodedByteCount?: number;
        };

        // Firefox
        if (typeof videoEl.mozHasAudio === 'boolean') {
          return videoEl.mozHasAudio;
        }

        // WebKit (Chrome/Safari) - check decoded audio bytes
        if (typeof videoEl.webkitAudioDecodedByteCount === 'number') {
          return videoEl.webkitAudioDecodedByteCount > 0;
        }

        // audioTracks API (limited browser support)
        if (videoEl.audioTracks && videoEl.audioTracks.length > 0) {
          return true;
        }

        // Fallback: assume video has audio if it has duration and isn't explicitly muted
        // (most videos have audio)
        return video.duration > 0;
      } catch {
        return true; // Assume audio exists if we can't detect
      }
    };

    const collectPlaybackInfo = (): VideoPlaybackInfo[] => {
      const videos = document.querySelectorAll('video');
      const playbackInfos: VideoPlaybackInfo[] = [];

      videos.forEach((video) => {
        const videoElement = video as HTMLVideoElement & {
          hls?: { url?: string };
          player?: { getSource?: () => string };
          shaka?: { getAssetUri?: () => string };
        };

        // Get the primary source URL
        let src = video.currentSrc || video.src || '';

        // Try to get HLS/DASH source
        if (videoElement.hls?.url) {
          src = videoElement.hls.url;
        } else if (videoElement.shaka?.getAssetUri) {
          try {
            src = videoElement.shaka.getAssetUri() || src;
          } catch {}
        }

        // Skip videos without valid sources
        if (!src || src.startsWith('blob:')) {
          // Try to find source from source elements
          const sourceEl = video.querySelector('source[src^="http"]') as HTMLSourceElement;
          if (sourceEl) {
            src = sourceEl.src;
          }
        }

        if (!src) return; // Skip if no source found

        const info: VideoPlaybackInfo = {
          src,
          playbackState: getPlaybackState(video),
          hasAudio: hasAudioTrack(video),
          audioMuted: video.muted,
          volume: video.volume,
          currentTime: video.currentTime,
          duration: video.duration || 0,
          resolution: `${video.videoWidth}x${video.videoHeight}`,
        };

        playbackInfos.push(info);
      });

      return playbackInfos;
    };

    // ========================================
    // Video Element Detection
    // ========================================

    const detectVideoElements = (): VideoInfo[] => {
      const videos = document.querySelectorAll('video');
      const videoInfos: VideoInfo[] = [];

      videos.forEach((video, index) => {
        const videoElement = video as HTMLVideoElement & {
          hls?: unknown;
          player?: unknown;
          shaka?: unknown;
        };

        const rect = video.getBoundingClientRect();

        const info: VideoInfo = {
          index,
          src: video.src || '',
          currentSrc: video.currentSrc || '',
          hasHls: !!videoElement.hls,
          hasDash: !!videoElement.player,
          hasShaka: !!videoElement.shaka,
          isPlaying: !video.paused && !video.ended && video.readyState > 2,
          duration: video.duration || 0,
          resolution: `${video.videoWidth}x${video.videoHeight}`,
          rect: {
            top: rect.top + window.scrollY,
            left: rect.left + window.scrollX,
            width: rect.width,
            height: rect.height,
          },
        };

        videoInfos.push(info);
      });

      return videoInfos;
    };

    // ========================================
    // Page Stream Scanner
    // ========================================

    const scanPageForStreams = (filterAds: boolean = true): ScannedStream[] => {
      const streams: ScannedStream[] = [];
      const seenUrls = new Set<string>();
      console.log('[PlaybackLab Scanner] Starting scan, filterAds:', filterAds);

      const addStream = (url: string, source: string) => {
        if (seenUrls.has(url)) {
          console.log('[PlaybackLab Scanner] Skipping duplicate:', url);
          return;
        }
        if (filterAds && isBlockedUrl(url)) {
          console.log('[PlaybackLab Scanner] Blocked (ad):', url);
          return;
        }
        const type = isValidStreamUrl(url);
        if (type) {
          seenUrls.add(url);
          streams.push({ url, type, source });
          console.log('[PlaybackLab Scanner] Found stream:', type, url, 'from', source);
        } else {
          console.log('[PlaybackLab Scanner] Not a stream URL:', url, 'from', source);
        }
      };

      // 1. Check all video elements
      const videos = document.querySelectorAll('video');
      console.log('[PlaybackLab Scanner] Found', videos.length, 'video elements');
      videos.forEach((video, i) => {
        console.log(`[PlaybackLab Scanner] Video[${i}]: src=${video.src?.substring(0, 80)}... currentSrc=${video.currentSrc?.substring(0, 80)}...`);
        const videoEl = video as HTMLVideoElement & {
          hls?: { url?: string; levels?: { url: string }[] };
          shaka?: { getAssetUri?: () => string };
          player?: { getSource?: () => { src: string } | string };
          dashPlayer?: { getSource?: () => string };
        };

        // Direct src
        if (video.src && video.src.startsWith('http')) {
          addStream(video.src, `video[${i}].src`);
        }
        if (video.currentSrc && video.currentSrc.startsWith('http')) {
          addStream(video.currentSrc, `video[${i}].currentSrc`);
        }

        // Source elements
        video.querySelectorAll('source').forEach((source, j) => {
          if (source.src && source.src.startsWith('http')) {
            addStream(source.src, `video[${i}] source[${j}]`);
          }
        });

        // HLS.js
        if (videoEl.hls?.url) {
          addStream(videoEl.hls.url, `video[${i}] hls.js`);
        }

        // Shaka
        if (videoEl.shaka?.getAssetUri) {
          try {
            const uri = videoEl.shaka.getAssetUri();
            if (uri) addStream(uri, `video[${i}] shaka`);
          } catch {}
        }

        // dash.js
        if (videoEl.player?.getSource) {
          try {
            const source = videoEl.player.getSource();
            if (typeof source === 'string') {
              addStream(source, `video[${i}] dash.js`);
            } else if (source?.src) {
              addStream(source.src, `video[${i}] dash.js`);
            }
          } catch {}
        }
      });

      // 2. Check common global variables
      const win = window as any;
      const globalChecks = [
        { path: 'player?.getSource', fn: () => win.player?.getSource?.() },
        { path: 'videojs?.getPlayer()?.src', fn: () => win.videojs?.getPlayer?.()?.src?.() },
        { path: '__PLAYER_CONFIG__.url', fn: () => win.__PLAYER_CONFIG__?.url },
        { path: '__VIDEO_CONFIG__.url', fn: () => win.__VIDEO_CONFIG__?.url },
        { path: 'playerConfig.source', fn: () => win.playerConfig?.source },
        { path: 'jwplayer().getPlaylistItem().file', fn: () => win.jwplayer?.()?.getPlaylistItem?.()?.file },
        { path: 'bitmovin.player.getSource', fn: () => win.bitmovin?.player?.getSource?.() },
      ];

      for (const check of globalChecks) {
        try {
          const result = check.fn();
          if (typeof result === 'string' && result.startsWith('http')) {
            addStream(result, `window.${check.path}`);
          } else if (result?.src) {
            addStream(result.src, `window.${check.path}`);
          }
        } catch {}
      }

      // 3. Scan page for URLs in script tags and data attributes
      const pageContent = document.documentElement.innerHTML;
      console.log('[PlaybackLab Scanner] Scanning page content, length:', pageContent.length);
      const extractedUrls = extractUrlsFromContent(pageContent);
      console.log('[PlaybackLab Scanner] Extracted', extractedUrls.length, 'URLs from page content');
      for (const url of extractedUrls) {
        addStream(url, 'page-content');
      }

      console.log('[PlaybackLab Scanner] Scan complete, found', streams.length, 'streams');
      return streams;
    };

    // ========================================
    // Stream URL Extraction
    // ========================================

    const extractStreamUrl = (video: HTMLVideoElement): { url: string; type: 'hls' | 'dash' | 'mse' | 'unknown'; sources: string[] } => {
      const sources: string[] = [];
      let primaryUrl = '';
      let streamType: 'hls' | 'dash' | 'mse' | 'unknown' = 'unknown';

      const videoElement = video as HTMLVideoElement & {
        hls?: { url?: string; levels?: { url: string }[] };
        player?: { getSource?: () => { src: string } };
        shaka?: { getAssetUri?: () => string };
        dashPlayer?: { getSource?: () => string };
      };

      // 1. Check HLS.js instance
      if (videoElement.hls) {
        if (videoElement.hls.url) {
          primaryUrl = videoElement.hls.url;
          streamType = 'hls';
          sources.push(primaryUrl);
        }
        // Also check levels for variant playlists
        if (videoElement.hls.levels) {
          videoElement.hls.levels.forEach((level: { url: string }) => {
            if (level.url) sources.push(level.url);
          });
        }
      }

      // 2. Check Shaka Player instance
      if (videoElement.shaka?.getAssetUri) {
        const uri = videoElement.shaka.getAssetUri();
        if (uri) {
          primaryUrl = primaryUrl || uri;
          if (uri.includes('.mpd')) streamType = 'dash';
          else if (uri.includes('.m3u8')) streamType = 'hls';
          sources.push(uri);
        }
      }

      // 3. Check dash.js instance
      if (videoElement.player?.getSource) {
        try {
          const source = videoElement.player.getSource();
          if (source && typeof source === 'object' && source.src) {
            primaryUrl = primaryUrl || source.src;
            streamType = 'dash';
            sources.push(source.src);
          }
        } catch {
          // Ignore
        }
      }

      // 4. Check direct src (may be blob: URL)
      if (video.src && !video.src.startsWith('blob:')) {
        sources.push(video.src);
        if (!primaryUrl) {
          primaryUrl = video.src;
          if (video.src.includes('.m3u8')) streamType = 'hls';
          else if (video.src.includes('.mpd')) streamType = 'dash';
        }
      }

      // 5. Check currentSrc
      if (video.currentSrc && !video.currentSrc.startsWith('blob:') && video.currentSrc !== video.src) {
        sources.push(video.currentSrc);
        if (!primaryUrl) {
          primaryUrl = video.currentSrc;
          if (video.currentSrc.includes('.m3u8')) streamType = 'hls';
          else if (video.currentSrc.includes('.mpd')) streamType = 'dash';
        }
      }

      // 6. Check source elements
      const sourceElements = video.querySelectorAll('source');
      sourceElements.forEach((source) => {
        if (source.src && source.src.startsWith('http')) {
          sources.push(source.src);
          if (!primaryUrl) {
            primaryUrl = source.src;
            if (source.src.includes('.m3u8')) streamType = 'hls';
            else if (source.src.includes('.mpd')) streamType = 'dash';
          }
        }
      });

      // 7. Try to find manifest URL from global variables (common player patterns)
      try {
        // Check for common global player configs
        const win = window as any;
        const possibleConfigs = [
          win.__PLAYER_CONFIG__,
          win.__VIDEO_CONFIG__,
          win.playerConfig,
          win.videoConfig,
        ];

        for (const config of possibleConfigs) {
          if (config?.url || config?.src || config?.source) {
            const url = config.url || config.src || config.source;
            if (typeof url === 'string' && url.startsWith('http')) {
              sources.push(url);
              if (!primaryUrl) primaryUrl = url;
            }
          }
        }
      } catch {
        // Ignore errors from accessing global variables
      }

      return {
        url: primaryUrl,
        type: streamType,
        sources: [...new Set(sources)],
      };
    };

    // ========================================
    // Stream Picker Overlay
    // ========================================

    const createPickerOverlay = () => {
      // Remove existing overlay
      removePickerOverlay();

      const videos = document.querySelectorAll('video');
      if (videos.length === 0) return;

      // Create main overlay container
      pickerOverlay = document.createElement('div');
      pickerOverlay.id = 'playbacklab-picker-overlay';
      pickerOverlay.innerHTML = `
        <style>
          #playbacklab-picker-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            z-index: 2147483647;
            pointer-events: none;
          }
          .playbacklab-video-highlight {
            position: absolute;
            border: 3px solid #007acc;
            background: rgba(0, 122, 204, 0.1);
            cursor: pointer;
            pointer-events: auto;
            transition: all 0.2s ease;
            box-sizing: border-box;
          }
          .playbacklab-video-highlight:hover {
            border-color: #00d4ff;
            background: rgba(0, 212, 255, 0.2);
            box-shadow: 0 0 20px rgba(0, 212, 255, 0.5);
          }
          .playbacklab-video-label {
            position: absolute;
            top: 8px;
            left: 8px;
            background: #007acc;
            color: white;
            padding: 4px 12px;
            border-radius: 4px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 12px;
            font-weight: 600;
            pointer-events: none;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .playbacklab-video-label .icon {
            font-size: 14px;
          }
          .playbacklab-video-info {
            position: absolute;
            bottom: 8px;
            left: 8px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 6px 12px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 11px;
            pointer-events: none;
            max-width: calc(100% - 16px);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .playbacklab-picker-banner {
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #1e1e1e;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
            pointer-events: auto;
            display: flex;
            align-items: center;
            gap: 12px;
            z-index: 2147483647;
          }
          .playbacklab-picker-banner button {
            background: #444;
            color: white;
            border: none;
            padding: 6px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
          }
          .playbacklab-picker-banner button:hover {
            background: #555;
          }
        </style>
        <div class="playbacklab-picker-banner">
          <span>🎯 Click on a video to inspect</span>
          <button id="playbacklab-cancel-picker">Cancel (Esc)</button>
        </div>
      `;
      document.body.appendChild(pickerOverlay);

      // Add cancel button handler
      const cancelBtn = document.getElementById('playbacklab-cancel-picker');
      cancelBtn?.addEventListener('click', () => {
        cancelPicker();
      });

      // Add ESC key handler
      const escHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          cancelPicker();
          document.removeEventListener('keydown', escHandler);
        }
      };
      document.addEventListener('keydown', escHandler);

      // Create highlights for each video
      videos.forEach((video, index) => {
        const rect = video.getBoundingClientRect();
        if (rect.width < 50 || rect.height < 50) return; // Skip tiny videos

        const highlight = document.createElement('div');
        highlight.className = 'playbacklab-video-highlight';
        highlight.style.top = `${rect.top}px`;
        highlight.style.left = `${rect.left}px`;
        highlight.style.width = `${rect.width}px`;
        highlight.style.height = `${rect.height}px`;

        // Determine stream type
        const videoEl = video as HTMLVideoElement & { hls?: unknown; shaka?: unknown; player?: unknown };
        let typeLabel = 'Video';
        if (videoEl.hls) typeLabel = 'HLS';
        else if (videoEl.shaka) typeLabel = 'DASH';
        else if (videoEl.player) typeLabel = 'DASH';
        else if (video.src?.includes('.m3u8') || video.currentSrc?.includes('.m3u8')) typeLabel = 'HLS';
        else if (video.src?.includes('.mpd') || video.currentSrc?.includes('.mpd')) typeLabel = 'DASH';

        const resolution = video.videoWidth && video.videoHeight
          ? `${video.videoWidth}x${video.videoHeight}`
          : 'Loading...';

        highlight.innerHTML = `
          <div class="playbacklab-video-label">
            <span class="icon">▶</span>
            <span>${typeLabel} #${index + 1}</span>
          </div>
          <div class="playbacklab-video-info">${resolution}</div>
        `;

        // Click handler
        highlight.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          selectVideo(video, index);
        });

        pickerOverlay?.appendChild(highlight);
        pickerHighlights.push(highlight);
      });

      // Update positions on scroll/resize
      const updatePositions = () => {
        videos.forEach((video, index) => {
          const highlight = pickerHighlights[index];
          if (!highlight) return;

          const rect = video.getBoundingClientRect();
          highlight.style.top = `${rect.top}px`;
          highlight.style.left = `${rect.left}px`;
          highlight.style.width = `${rect.width}px`;
          highlight.style.height = `${rect.height}px`;
        });
      };

      window.addEventListener('scroll', updatePositions);
      window.addEventListener('resize', updatePositions);
    };

    const removePickerOverlay = () => {
      if (pickerOverlay) {
        pickerOverlay.remove();
        pickerOverlay = null;
      }
      pickerHighlights = [];
    };

    const cancelPicker = () => {
      removePickerOverlay();
      if (isContextValid()) {
        chrome.runtime.sendMessage({ type: 'PICKER_CANCELLED' }).catch(() => {});
      }
    };

    const selectVideo = (video: HTMLVideoElement, index: number) => {
      removePickerOverlay();

      if (!isContextValid()) return;

      const extracted = extractStreamUrl(video);

      chrome.runtime.sendMessage({
        type: 'PICKER_RESULT',
        payload: {
          url: extracted.url,
          type: extracted.type,
          sources: extracted.sources,
          videoIndex: index,
          resolution: `${video.videoWidth}x${video.videoHeight}`,
          duration: video.duration || 0,
        },
      }).catch(() => {});
    };

    // ========================================
    // Persistent Video Overlays
    // ========================================

    const createPersistentOverlayContainer = () => {
      if (persistentOverlayContainer) return;

      persistentOverlayContainer = document.createElement('div');
      persistentOverlayContainer.id = 'playbacklab-persistent-overlays';
      persistentOverlayContainer.innerHTML = `
        <style>
          #playbacklab-persistent-overlays {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            z-index: 2147483646;
            pointer-events: none;
          }
          .playbacklab-persistent-overlay {
            position: absolute;
            border: 2px solid #00d4ff;
            border-radius: 4px;
            pointer-events: none;
            box-sizing: border-box;
            transition: border-color 0.2s ease;
          }
          .playbacklab-persistent-overlay:hover {
            border-color: #00ff88;
          }
          .playbacklab-overlay-badge {
            position: absolute;
            top: 8px;
            left: 8px;
            display: flex;
            align-items: center;
            gap: 8px;
            pointer-events: auto;
          }
          .playbacklab-overlay-type {
            background: linear-gradient(135deg, #007acc 0%, #00d4ff 100%);
            color: white;
            padding: 6px 12px;
            border-radius: 4px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            box-shadow: 0 2px 8px rgba(0, 122, 204, 0.4);
            cursor: pointer;
            transition: transform 0.15s ease, box-shadow 0.15s ease;
          }
          .playbacklab-overlay-type:hover {
            transform: scale(1.05);
            box-shadow: 0 4px 12px rgba(0, 212, 255, 0.5);
          }
          .playbacklab-overlay-type.hls {
            background: linear-gradient(135deg, #ff6b35 0%, #ff9f43 100%);
            box-shadow: 0 2px 8px rgba(255, 107, 53, 0.4);
          }
          .playbacklab-overlay-type.hls:hover {
            box-shadow: 0 4px 12px rgba(255, 159, 67, 0.5);
          }
          .playbacklab-overlay-type.dash {
            background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%);
            box-shadow: 0 2px 8px rgba(139, 92, 246, 0.4);
          }
          .playbacklab-overlay-type.dash:hover {
            box-shadow: 0 4px 12px rgba(167, 139, 250, 0.5);
          }
          .playbacklab-overlay-actions {
            position: absolute;
            top: 8px;
            right: 8px;
            display: flex;
            gap: 6px;
            pointer-events: auto;
          }
          .playbacklab-overlay-btn {
            background: rgba(0, 0, 0, 0.8);
            color: white;
            border: none;
            padding: 6px 10px;
            border-radius: 4px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 11px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.15s ease, transform 0.15s ease;
            display: flex;
            align-items: center;
            gap: 4px;
          }
          .playbacklab-overlay-btn:hover {
            background: rgba(0, 122, 204, 0.9);
            transform: scale(1.05);
          }
          .playbacklab-overlay-btn.copy-btn:hover {
            background: rgba(0, 180, 100, 0.9);
          }
          .playbacklab-overlay-btn.copied {
            background: rgba(0, 180, 100, 0.9);
          }
          .playbacklab-overlay-info {
            position: absolute;
            bottom: 8px;
            left: 8px;
            right: 8px;
            background: rgba(0, 0, 0, 0.85);
            color: #e0e0e0;
            padding: 8px 12px;
            border-radius: 4px;
            font-family: 'SF Mono', Monaco, Consolas, monospace;
            font-size: 10px;
            pointer-events: auto;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            cursor: pointer;
            transition: background 0.15s ease;
          }
          .playbacklab-overlay-info:hover {
            background: rgba(0, 0, 0, 0.95);
          }
          .playbacklab-overlay-resolution {
            position: absolute;
            bottom: 8px;
            right: 8px;
            background: rgba(0, 0, 0, 0.7);
            color: #888;
            padding: 4px 8px;
            border-radius: 4px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 10px;
            pointer-events: none;
          }
        </style>
      `;
      document.body.appendChild(persistentOverlayContainer);
    };

    const removePersistentOverlays = () => {
      persistentOverlays.forEach((overlay) => overlay.remove());
      persistentOverlays.clear();
      if (persistentOverlayContainer) {
        persistentOverlayContainer.remove();
        persistentOverlayContainer = null;
      }
      persistentOverlaysEnabled = false;
    };

    const getStreamTypeForVideo = (video: HTMLVideoElement): { type: string; url: string; streamId: string | null } => {
      const videoEl = video as HTMLVideoElement & {
        hls?: { url?: string };
        shaka?: { getAssetUri?: () => string };
        player?: { getSource?: () => { src: string } | string };
        dashPlayer?: { getSource?: () => string };
      };

      let url = '';
      let type = 'VIDEO';
      let streamId: string | null = null;

      // Check HLS.js - most common
      if (videoEl.hls?.url) {
        url = videoEl.hls.url;
        type = 'HLS';
      }
      // Check Shaka Player (supports both HLS and DASH)
      else if (videoEl.shaka?.getAssetUri) {
        try {
          url = videoEl.shaka.getAssetUri() || '';
          type = url.includes('.mpd') ? 'DASH' : url.includes('.m3u8') ? 'HLS' : 'DASH';
        } catch {}
      }
      // Check dash.js
      else if (videoEl.player?.getSource) {
        try {
          const source = videoEl.player.getSource();
          url = typeof source === 'string' ? source : source?.src || '';
          type = 'DASH';
        } catch {}
      }
      // Check direct src
      else if (video.currentSrc || video.src) {
        url = video.currentSrc || video.src;
        if (url.includes('.m3u8')) type = 'HLS';
        else if (url.includes('.mpd')) type = 'DASH';
        else if (url.startsWith('blob:')) type = 'MSE';
      }

      // Try to match with detected streams cache
      if (detectedStreamsCache.length > 0) {
        // Strategy 1: Exact URL match (works when we found the manifest URL)
        if (url && !url.startsWith('blob:')) {
          const exactMatch = detectedStreamsCache.find((s) => s.url === url);
          if (exactMatch) {
            streamId = exactMatch.id;
            type = exactMatch.type.toUpperCase();
            return { type, url, streamId };
          }
        }

        // Strategy 2: If we have MSE/blob, check if there's only one stream (common case)
        if (type === 'MSE' || type === 'VIDEO' || url.startsWith('blob:')) {
          if (detectedStreamsCache.length === 1) {
            // Single stream detected - very likely this video is playing it
            const singleStream = detectedStreamsCache[0];
            streamId = singleStream.id;
            type = singleStream.type.toUpperCase();
            url = singleStream.url;
            return { type, url, streamId };
          }

          // Strategy 3: Look for an active/playing stream
          // This works because the video element we're looking at is likely playing one of the detected streams
          // For now, prefer HLS/DASH streams over others
          const hlsStream = detectedStreamsCache.find(s => s.type === 'hls');
          const dashStream = detectedStreamsCache.find(s => s.type === 'dash');
          const preferredStream = hlsStream || dashStream;

          if (preferredStream) {
            streamId = preferredStream.id;
            type = preferredStream.type.toUpperCase();
            url = preferredStream.url;
            return { type, url, streamId };
          }
        }

        // Strategy 4: Partial URL match (filename match)
        if (url && !url.startsWith('blob:')) {
          try {
            const urlFilename = new URL(url).pathname.split('/').pop();
            if (urlFilename) {
              const filenameMatch = detectedStreamsCache.find((s) => {
                try {
                  const cachedFilename = new URL(s.url).pathname.split('/').pop();
                  return cachedFilename === urlFilename;
                } catch { return false; }
              });
              if (filenameMatch) {
                streamId = filenameMatch.id;
                type = filenameMatch.type.toUpperCase();
                return { type, url, streamId };
              }
            }
          } catch {}
        }
      }

      return { type, url, streamId };
    };

    const copyToClipboard = async (text: string, button: HTMLButtonElement) => {
      try {
        await navigator.clipboard.writeText(text);
        button.classList.add('copied');
        const originalText = button.innerHTML;
        button.innerHTML = '✓ Copied';
        setTimeout(() => {
          button.classList.remove('copied');
          button.innerHTML = originalText;
        }, 1500);
      } catch {
        // Fallback for when clipboard API is blocked
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand('copy');
          button.classList.add('copied');
          const originalText = button.innerHTML;
          button.innerHTML = '✓ Copied';
          setTimeout(() => {
            button.classList.remove('copied');
            button.innerHTML = originalText;
          }, 1500);
        } catch {}
        document.body.removeChild(textarea);
      }
    };

    const createPersistentVideoOverlays = () => {
      removePersistentOverlays();
      createPersistentOverlayContainer();
      persistentOverlaysEnabled = true;

      const videos = document.querySelectorAll('video');
      if (videos.length === 0) return;

      videos.forEach((video, index) => {
        const rect = video.getBoundingClientRect();
        if (rect.width < 100 || rect.height < 60) return; // Skip tiny videos

        const { type, url, streamId } = getStreamTypeForVideo(video);
        const resolution = video.videoWidth && video.videoHeight
          ? `${video.videoWidth}×${video.videoHeight}`
          : '';

        const overlay = document.createElement('div');
        overlay.className = 'playbacklab-persistent-overlay';
        overlay.style.top = `${rect.top}px`;
        overlay.style.left = `${rect.left}px`;
        overlay.style.width = `${rect.width}px`;
        overlay.style.height = `${rect.height}px`;
        overlay.dataset.videoIndex = String(index);

        // Type badge (click to select in DevTools)
        const badge = document.createElement('div');
        badge.className = 'playbacklab-overlay-badge';

        const typeBadge = document.createElement('div');
        typeBadge.className = `playbacklab-overlay-type ${type.toLowerCase()}`;
        typeBadge.textContent = type;
        typeBadge.title = 'Click to inspect in PlaybackLab';
        typeBadge.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          selectStreamFromOverlay(url, streamId, index);
        });
        badge.appendChild(typeBadge);

        // Action buttons
        const actions = document.createElement('div');
        actions.className = 'playbacklab-overlay-actions';

        // Copy URL button
        if (url && !url.startsWith('blob:')) {
          const copyBtn = document.createElement('button');
          copyBtn.className = 'playbacklab-overlay-btn copy-btn';
          copyBtn.innerHTML = '📋 Copy URL';
          copyBtn.title = 'Copy stream URL';
          copyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            copyToClipboard(url, copyBtn);
          });
          actions.appendChild(copyBtn);
        }

        // Info button (opens in DevTools)
        const infoBtn = document.createElement('button');
        infoBtn.className = 'playbacklab-overlay-btn';
        infoBtn.innerHTML = '🔍 Inspect';
        infoBtn.title = 'View details in PlaybackLab';
        infoBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          selectStreamFromOverlay(url, streamId, index);
        });
        actions.appendChild(infoBtn);

        // URL info bar at bottom
        const infoBar = document.createElement('div');
        infoBar.className = 'playbacklab-overlay-info';
        if (url && !url.startsWith('blob:')) {
          // Truncate URL for display
          const displayUrl = url.length > 80 ? url.substring(0, 77) + '...' : url;
          infoBar.textContent = displayUrl;
          infoBar.title = url;
          infoBar.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            copyToClipboard(url, infoBar as unknown as HTMLButtonElement);
          });
        } else {
          infoBar.textContent = url.startsWith('blob:') ? 'MSE/Blob stream (URL not directly copyable)' : 'No URL detected';
          infoBar.style.color = '#888';
        }

        // Resolution badge (bottom right, only if we have info bar)
        if (resolution && url && !url.startsWith('blob:')) {
          const resolutionBadge = document.createElement('div');
          resolutionBadge.className = 'playbacklab-overlay-resolution';
          resolutionBadge.textContent = resolution;
          overlay.appendChild(resolutionBadge);
          // Adjust info bar to not overlap
          infoBar.style.right = '100px';
        }

        overlay.appendChild(badge);
        overlay.appendChild(actions);
        overlay.appendChild(infoBar);

        persistentOverlayContainer?.appendChild(overlay);
        persistentOverlays.set(video, overlay);
      });

      // Update positions on scroll/resize
      const updateOverlayPositions = () => {
        if (!persistentOverlaysEnabled) return;
        persistentOverlays.forEach((overlay, video) => {
          const rect = video.getBoundingClientRect();
          overlay.style.top = `${rect.top}px`;
          overlay.style.left = `${rect.left}px`;
          overlay.style.width = `${rect.width}px`;
          overlay.style.height = `${rect.height}px`;
        });
      };

      window.addEventListener('scroll', updateOverlayPositions);
      window.addEventListener('resize', updateOverlayPositions);
    };

    const selectStreamFromOverlay = (url: string, streamId: string | null, videoIndex: number) => {
      if (!isContextValid()) return;

      chrome.runtime.sendMessage({
        type: 'SELECT_STREAM_FROM_PAGE',
        payload: {
          url,
          streamId,
          videoIndex,
        },
      }).catch(() => {});
    };

    // ========================================
    // Metrics Collection
    // ========================================

    const collectMetrics = (): { metrics: VideoMetrics | null } => {
      const video = document.querySelector('video') as HTMLVideoElement | null;

      if (!video) {
        return { metrics: null };
      }

      let bufferAhead = 0;
      const buffered = video.buffered;
      for (let i = 0; i < buffered.length; i++) {
        if (video.currentTime >= buffered.start(i) && video.currentTime <= buffered.end(i)) {
          bufferAhead = buffered.end(i) - video.currentTime;
          break;
        }
      }

      const quality = video.getVideoPlaybackQuality?.();
      const droppedFrames = quality?.droppedVideoFrames ?? 0;

      let bitrate = 0;
      const videoElement = video as HTMLVideoElement & {
        hls?: { bandwidthEstimate?: number };
        shaka?: { getStats?: () => { estimatedBandwidth?: number } };
      };

      if (videoElement.hls?.bandwidthEstimate) {
        bitrate = videoElement.hls.bandwidthEstimate;
      } else if (videoElement.shaka?.getStats) {
        bitrate = videoElement.shaka.getStats()?.estimatedBandwidth ?? 0;
      }

      return {
        metrics: {
          bufferAhead,
          bitrate,
          droppedFrames,
          resolution: `${video.videoWidth}x${video.videoHeight}`,
          currentTime: video.currentTime,
          duration: video.duration,
          paused: video.paused,
          readyState: video.readyState,
        },
      };
    };

    // ========================================
    // Message Handlers
    // ========================================

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      // Ignore messages if context is invalidated
      if (!isContextValid()) return false;

      switch (message.type) {
        case 'COLLECT_METRICS':
          sendResponse(collectMetrics());
          return false;

        case 'GET_VIDEO_SOURCES':
          sendResponse({ sources: collectVideoSources() });
          return false;

        case 'GET_VIDEO_ELEMENTS':
          sendResponse({ videos: detectVideoElements() });
          return false;

        case 'GET_PLAYBACK_INFO':
          sendResponse({ playbackInfo: collectPlaybackInfo() });
          return false;

        case 'COUNT_VIDEOS':
          const videos = document.querySelectorAll('video');
          sendResponse({ count: videos.length });
          return false;

        case 'SCAN_FOR_STREAMS':
          const shouldFilterAds = message.filterAds !== false;
          const scannedStreams = scanPageForStreams(shouldFilterAds);
          sendResponse({ streams: scannedStreams });
          return false;

        case 'START_PICKER':
          createPickerOverlay();
          sendResponse({ success: true });
          return false;

        case 'CANCEL_PICKER':
          cancelPicker();
          sendResponse({ success: true });
          return false;

        case 'ENABLE_VIDEO_OVERLAYS':
          createPersistentVideoOverlays();
          sendResponse({ success: true, count: persistentOverlays.size });
          return false;

        case 'DISABLE_VIDEO_OVERLAYS':
          removePersistentOverlays();
          sendResponse({ success: true });
          return false;

        case 'UPDATE_STREAMS_CACHE':
          if (message.payload?.streams) {
            detectedStreamsCache = message.payload.streams;
            // Refresh overlays if enabled to update stream IDs
            if (persistentOverlaysEnabled) {
              createPersistentVideoOverlays();
            }
          }
          sendResponse({ success: true });
          return false;

        case 'GET_OVERLAY_STATUS':
          sendResponse({ enabled: persistentOverlaysEnabled, count: persistentOverlays.size });
          return false;

        default:
          return false;
      }
    });

    // ========================================
    // Auto-reporting
    // ========================================

    // Store interval ID for cleanup
    let reportingIntervalId: ReturnType<typeof setInterval> | null = null;

    const reportVideoSources = () => {
      // Stop reporting if extension context is invalidated
      if (!isContextValid()) {
        if (reportingIntervalId) {
          clearInterval(reportingIntervalId);
          reportingIntervalId = null;
        }
        return;
      }

      const sources = collectVideoSources();
      const playbackInfo = collectPlaybackInfo();

      if (sources.length > 0 || playbackInfo.length > 0) {
        chrome.runtime.sendMessage({
          type: 'UPDATE_ACTIVE_SOURCES',
          payload: { tabId: undefined, sources, playbackInfo },
        }).catch(() => {
          // Context likely invalidated, stop interval
          if (reportingIntervalId) {
            clearInterval(reportingIntervalId);
            reportingIntervalId = null;
          }
        });
      }
    };

    // Initial detection
    reportVideoSources();

    // Periodic reporting
    reportingIntervalId = setInterval(reportVideoSources, 2000);

    // Watch for dynamically added videos
    const observer = new MutationObserver((mutations) => {
      if (!isContextValid()) {
        observer.disconnect();
        return;
      }
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLVideoElement ||
              (node instanceof Element && node.querySelector('video'))) {
            reportVideoSources();
            return;
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Video events - listen for all playback state changes
    const videoEvents = ['play', 'pause', 'playing', 'waiting', 'stalled', 'ended', 'loadedmetadata', 'volumechange'];
    videoEvents.forEach(eventType => {
      document.addEventListener(eventType, (e) => {
        if (e.target instanceof HTMLVideoElement && isContextValid()) {
          reportVideoSources();
        }
      }, true);
    });

    window.addEventListener('unload', () => {
      observer.disconnect();
      if (reportingIntervalId) {
        clearInterval(reportingIntervalId);
        reportingIntervalId = null;
      }
    });
  },
});

// WXT type declaration
declare function defineContentScript(config: {
  matches: string[];
  runAt?: 'document_start' | 'document_end' | 'document_idle';
  main: () => void;
}): { matches: string[]; runAt?: string; main: () => void };

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

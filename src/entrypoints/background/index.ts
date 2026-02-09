/**
 * Background Service Worker
 * SOLID: Single Responsibility - Orchestrates stream detection
 */

import { streamDetector } from '../../core/services/StreamDetector';
import { adDetector } from '../../core/services/AdDetector';
import type { StreamInfo, PlaybackState } from '../../core/interfaces/IStreamDetector';
import type { ParsedManifest } from '../../core/interfaces/IManifestParser';
import type { DetectedAd } from '../../core/interfaces/IAdDetector';
import { safeGetTab } from '../../shared/utils/chromeApiSafe';
import { urlsMatch } from '../../shared/utils/stringUtils';

// Dynamic parser loading to avoid bundling issues
const getHlsParser = async () => {
  const { HlsManifestParser } = await import('../../core/services/HlsManifestParser');
  return new HlsManifestParser();
};
const getDashParser = async () => {
  const { DashManifestParser } = await import('../../core/services/DashManifestParser');
  return new DashManifestParser();
};
const getVastParser = async () => {
  const { VastParser } = await import('../../core/services/VastParser');
  return new VastParser();
};

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

interface NetworkRequest {
  id: string;
  url: string;
  type: 'manifest' | 'segment' | 'key' | 'init' | 'other';
  method: string;
  status: number;
  statusText: string;
  size: number;
  duration: number;
  timestamp: number;
  mimeType?: string;
}

export default defineBackground(() => {
  // Store detected streams per tab
  const tabStreams = new Map<number, StreamInfo[]>();

  // Store network requests per tab
  const tabNetworkRequests = new Map<number, NetworkRequest[]>();

  // Track which tabs are capturing network
  const networkCaptureEnabled = new Set<number>();

  // Track request start times for duration calculation
  const requestStartTimes = new Map<string, number>();

  // Track response sizes from headers
  const responseSizes = new Map<string, number>();

  // Track response MIME types from headers
  const responseMimeTypes = new Map<string, string>();

  // Track which tabs have auto-detection enabled (default: false for clean start)
  const autoDetectionEnabled = new Map<number, boolean>();

  // Track filter ads setting per tab (default: true)
  const filterAdsEnabled = new Map<number, boolean>();

  // Track active video sources per tab
  const activeVideoSources = new Map<number, string[]>();

  // Track which tabs have video overlays enabled
  const overlaysEnabledTabs = new Set<number>();

  // Store detected ads per tab (always enabled)
  const tabAds = new Map<number, DetectedAd[]>();

  // Listen for web requests to detect streams
  chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
      // Only process if auto-detection is enabled for this tab
      if (!autoDetectionEnabled.get(details.tabId)) {
        return;
      }

      // Check if filter ads is enabled (default: true)
      const shouldFilter = filterAdsEnabled.get(details.tabId) !== false;
      streamDetector.setFilterAds(shouldFilter);

      const result = streamDetector.processRequest(details);

      if (result.detected && result.stream) {
        const stream = result.stream;

        if (stream.isMaster) {
          // Master manifest — add to stream list
          addMasterStream(stream);
        } else {
          // Segment/chunk — try to match to an existing parent stream
          const parentStream = findParentStream(stream.tabId, stream.url);
          if (parentStream) {
            chrome.runtime.sendMessage({
              type: 'SEGMENT_DETECTED',
              payload: {
                parentStreamId: parentStream.id,
                segmentUrl: stream.url,
              },
            }).catch(() => {});
          } else {
            // No parent found — for known streaming CDNs, create a synthetic parent
            const platform = streamDetector.detectPlatform(stream.url);
            if (platform) {
              console.log('[PlaybackLab] Creating synthetic parent for', platform, 'segment');
              stream.isMaster = true;
              addMasterStream(stream);
            }
          }
        }
      }

      // Ad detection (always enabled - separate from stream filtering)
      const adResult = adDetector.processRequest(details);
      if (adResult.detected && adResult.ad) {
        const ad = adResult.ad;
        console.log('[PlaybackLab] Ad detected:', ad.format, ad.source, ad.url);

        // Store in tab map
        const ads = tabAds.get(ad.tabId) || [];
        if (!ads.some(a => a.url === ad.url)) {
          ads.push(ad);
          tabAds.set(ad.tabId, ads);

          // Notify DevTools panel
          chrome.runtime.sendMessage({
            type: 'AD_DETECTED',
            payload: ad,
          }).catch(() => {});

          // Auto-fetch and parse VAST/VMAP
          autoFetchAdContent(ad);
        }
      }

      // Track request start time for network capture
      if (networkCaptureEnabled.has(details.tabId)) {
        requestStartTimes.set(details.requestId, Date.now());
      }
    },
    { urls: ['<all_urls>'] },
    []
  );

  // Listen for response headers to capture size and MIME type
  chrome.webRequest.onHeadersReceived.addListener(
    (details) => {
      if (!networkCaptureEnabled.has(details.tabId)) return;

      // Only process streaming-related requests
      const url = details.url.toLowerCase();
      if (!isStreamingRequest(url)) return;

      // Extract Content-Length header
      const contentLength = details.responseHeaders?.find(
        h => h.name.toLowerCase() === 'content-length'
      );
      if (contentLength?.value) {
        responseSizes.set(details.requestId, parseInt(contentLength.value, 10) || 0);
      }

      // Extract Content-Type header
      const contentType = details.responseHeaders?.find(
        h => h.name.toLowerCase() === 'content-type'
      );
      if (contentType?.value) {
        responseMimeTypes.set(details.requestId, contentType.value);
      }
    },
    { urls: ['<all_urls>'] },
    ['responseHeaders']
  );

  // Listen for completed requests to capture network info
  chrome.webRequest.onCompleted.addListener(
    (details) => {
      if (!networkCaptureEnabled.has(details.tabId)) return;

      const startTime = requestStartTimes.get(details.requestId);
      const duration = startTime ? Date.now() - startTime : 0;
      requestStartTimes.delete(details.requestId);

      // Only capture streaming-related requests
      const url = details.url.toLowerCase();
      if (!isStreamingRequest(url)) return;

      // Get size and MIME type from headers (captured in onHeadersReceived)
      const size = responseSizes.get(details.requestId) || 0;
      const mimeType = responseMimeTypes.get(details.requestId);
      responseSizes.delete(details.requestId);
      responseMimeTypes.delete(details.requestId);

      const networkRequest: NetworkRequest = {
        id: details.requestId,
        url: details.url,
        type: getRequestType(url),
        method: details.method,
        status: details.statusCode,
        statusText: getStatusText(details.statusCode),
        size,
        duration,
        timestamp: Date.now(),
        mimeType,
      };

      // Store request
      const requests = tabNetworkRequests.get(details.tabId) || [];
      requests.push(networkRequest);
      if (requests.length > 100) requests.shift();
      tabNetworkRequests.set(details.tabId, requests);

      // Notify DevTools panel
      chrome.runtime.sendMessage({
        type: 'NETWORK_REQUEST',
        payload: networkRequest,
      }).catch(() => {
        // DevTools panel not open, ignore
      });
    },
    { urls: ['<all_urls>'] }
  );

  // Clean up when tab closes
  chrome.tabs.onRemoved.addListener((tabId) => {
    tabStreams.delete(tabId);
    tabNetworkRequests.delete(tabId);
    tabAds.delete(tabId);
    networkCaptureEnabled.delete(tabId);
    autoDetectionEnabled.delete(tabId);
    filterAdsEnabled.delete(tabId);
    activeVideoSources.delete(tabId);
    overlaysEnabledTabs.delete(tabId);
    streamDetector.clearForTab(tabId);
    adDetector.clearForTab(tabId);
  });

  // Clean up when tab navigates
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading') {
      tabStreams.delete(tabId);
      tabNetworkRequests.delete(tabId);
      tabAds.delete(tabId);
      activeVideoSources.delete(tabId);
      overlaysEnabledTabs.delete(tabId);
      streamDetector.clearForTab(tabId);
      adDetector.clearForTab(tabId);
    }
  });

  // Handle messages from DevTools panel
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    switch (message.type) {
      case 'GET_STREAMS': {
        const tabId = message.tabId as number;
        const streams = tabStreams.get(tabId) || [];
        sendResponse({ streams });
        return false;
      }

      case 'GET_ADS': {
        const tabId = message.tabId as number;
        const ads = tabAds.get(tabId) || [];
        sendResponse({ ads });
        return false;
      }

      case 'FETCH_AD': {
        const { url, headers } = message.payload as { url: string; headers?: Record<string, string> };
        fetchAdContent(url, headers)
          .then((result) => sendResponse(result))
          .catch((error: Error) => sendResponse({ success: false, error: error.message }));
        return true;
      }

      case 'FETCH_MANIFEST': {
        const { url, headers } = message.payload as { url: string; headers?: Record<string, string> };
        fetchManifest(url, headers)
          .then((content) => sendResponse({ success: true, content }))
          .catch((error: Error) => sendResponse({ success: false, error: error.message }));
        return true;
      }

      case 'CLEAR_TAB': {
        const tabId = message.tabId as number;
        tabStreams.delete(tabId);
        tabNetworkRequests.delete(tabId);
        activeVideoSources.delete(tabId);
        streamDetector.clearForTab(tabId);
        sendResponse({ success: true });
        return false;
      }

      case 'START_NETWORK_CAPTURE': {
        const tabId = message.tabId as number;
        networkCaptureEnabled.add(tabId);
        tabNetworkRequests.set(tabId, []);
        sendResponse({ success: true });
        return false;
      }

      case 'STOP_NETWORK_CAPTURE': {
        const tabId = message.tabId as number;
        networkCaptureEnabled.delete(tabId);
        sendResponse({ success: true });
        return false;
      }

      case 'ENABLE_AUTO_DETECTION': {
        const tabId = message.tabId as number;
        autoDetectionEnabled.set(tabId, true);
        console.log('[PlaybackLab] Auto-detection enabled for tab', tabId);
        sendResponse({ success: true });
        return false;
      }

      case 'DISABLE_AUTO_DETECTION': {
        const tabId = message.tabId as number;
        autoDetectionEnabled.set(tabId, false);
        console.log('[PlaybackLab] Auto-detection disabled for tab', tabId);
        sendResponse({ success: true });
        return false;
      }

      case 'GET_AUTO_DETECTION_STATUS': {
        const tabId = message.tabId as number;
        sendResponse({ enabled: autoDetectionEnabled.get(tabId) || false });
        return false;
      }

      case 'GET_FILTER_ADS_STATUS': {
        const tabId = message.tabId as number;
        // Default to true (filter enabled)
        sendResponse({ filterAds: filterAdsEnabled.get(tabId) !== false });
        return false;
      }

      case 'SET_FILTER_ADS': {
        const tabId = message.tabId as number;
        const filterAds = message.filterAds as boolean;
        filterAdsEnabled.set(tabId, filterAds);
        console.log('[PlaybackLab] Filter ads', filterAds ? 'enabled' : 'disabled', 'for tab', tabId);
        sendResponse({ success: true });
        return false;
      }

      case 'UPDATE_ACTIVE_SOURCES': {
        const { tabId, sources, playbackInfo } = message.payload as {
          tabId: number;
          sources: string[];
          playbackInfo?: VideoPlaybackInfo[];
        };
        activeVideoSources.set(tabId, sources);

        // Update isActive flag and playback state for existing streams
        const streams = tabStreams.get(tabId) || [];
        let hasUpdates = false;

        streams.forEach(stream => {
          const wasActive = stream.isActive;
          const oldPlaybackState = stream.playbackState;

          // Check if stream URL matches any active source
          const matchingSource = sources.find(src => urlsMatch(src, stream.url));
          stream.isActive = !!matchingSource;

          // Find matching playback info
          if (playbackInfo && playbackInfo.length > 0) {
            const matchingPlayback = playbackInfo.find(info => urlsMatch(info.src, stream.url));

            if (matchingPlayback) {
              stream.playbackState = matchingPlayback.playbackState;
              stream.hasAudio = matchingPlayback.hasAudio;
              stream.audioMuted = matchingPlayback.audioMuted;
              stream.volume = matchingPlayback.volume;
            } else if (!stream.isActive) {
              stream.playbackState = 'idle';
            }
          }

          // Track if anything changed
          if (wasActive !== stream.isActive || oldPlaybackState !== stream.playbackState) {
            hasUpdates = true;
          }
        });

        // Notify DevTools panel if there are updates
        if (hasUpdates) {
          chrome.runtime.sendMessage({
            type: 'PLAYBACK_STATE_UPDATED',
            payload: { tabId, streams },
          }).catch(() => {});
        }

        sendResponse({ success: true });
        return false;
      }

      case 'GET_VIDEO_METRICS': {
        const tabId = message.tabId as number;
        // Safely send message to tab - handles closed tabs gracefully
        safeGetTab(tabId).then((tab) => {
          if (!tab) {
            sendResponse({ metrics: null });
            return;
          }
          chrome.tabs.sendMessage(tabId, { type: 'COLLECT_METRICS' }, (response) => {
            // Check for runtime errors (tab closed, content script not loaded, etc.)
            if (chrome.runtime.lastError) {
              console.debug('[Background] Metrics collection failed:', chrome.runtime.lastError.message);
              sendResponse({ metrics: null });
            } else {
              sendResponse(response || { metrics: null });
            }
          });
        });
        return true;
      }

      case 'ENABLE_VIDEO_OVERLAYS': {
        const tabId = message.tabId as number;
        safeGetTab(tabId).then(async (tab) => {
          if (!tab) {
            sendResponse({ success: false, error: 'Tab not found' });
            return;
          }

          // Helper to enable overlays after ensuring content script is ready
          const enableOverlays = () => {
            // Send detected streams to content script for matching
            const streams = tabStreams.get(tabId) || [];
            const streamsCache = streams.map(s => ({ url: s.url, type: s.type, id: s.id }));

            // First update streams cache, then enable overlays
            chrome.tabs.sendMessage(tabId, {
              type: 'UPDATE_STREAMS_CACHE',
              payload: { streams: streamsCache },
            }, () => {
              if (chrome.runtime.lastError) {
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
                return;
              }
              // Now enable overlays
              chrome.tabs.sendMessage(tabId, { type: 'ENABLE_VIDEO_OVERLAYS' }, (response) => {
                if (chrome.runtime.lastError) {
                  sendResponse({ success: false, error: chrome.runtime.lastError.message });
                } else {
                  // Track that overlays are enabled for this tab
                  overlaysEnabledTabs.add(tabId);
                  sendResponse(response || { success: true });
                }
              });
            });
          };

          // Try to ping content script first
          chrome.tabs.sendMessage(tabId, { type: 'GET_OVERLAY_STATUS' }, async () => {
            if (chrome.runtime.lastError) {
              // Content script not loaded - inject it
              console.log('[PlaybackLab] Content script not found, injecting...');
              try {
                await chrome.scripting.executeScript({
                  target: { tabId },
                  files: ['content-scripts/content.js'],
                });
                console.log('[PlaybackLab] Content script injected successfully');
                // Small delay to let script initialize
                setTimeout(enableOverlays, 100);
              } catch (err) {
                console.error('[PlaybackLab] Failed to inject content script:', err);
                sendResponse({ success: false, error: 'Failed to inject content script' });
              }
            } else {
              // Content script already loaded
              enableOverlays();
            }
          });
        });
        return true;
      }

      case 'DISABLE_VIDEO_OVERLAYS': {
        const tabId = message.tabId as number;
        // Track that overlays are disabled for this tab
        overlaysEnabledTabs.delete(tabId);
        safeGetTab(tabId).then((tab) => {
          if (!tab) {
            sendResponse({ success: false, error: 'Tab not found' });
            return;
          }
          chrome.tabs.sendMessage(tabId, { type: 'DISABLE_VIDEO_OVERLAYS' }, (response) => {
            if (chrome.runtime.lastError) {
              sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
              sendResponse(response || { success: true });
            }
          });
        });
        return true;
      }

      case 'GET_VIDEO_OVERLAY_STATUS': {
        const tabId = message.tabId as number;
        safeGetTab(tabId).then((tab) => {
          if (!tab) {
            sendResponse({ enabled: false, count: 0 });
            return;
          }
          chrome.tabs.sendMessage(tabId, { type: 'GET_OVERLAY_STATUS' }, (response) => {
            if (chrome.runtime.lastError) {
              sendResponse({ enabled: false, count: 0 });
            } else {
              sendResponse(response || { enabled: false, count: 0 });
            }
          });
        });
        return true;
      }

      case 'SELECT_STREAM_FROM_PAGE': {
        // Forward to DevTools panel to select the stream
        const { url, streamId, videoIndex } = message.payload as {
          url: string;
          streamId: string | null;
          videoIndex: number;
        };
        chrome.runtime.sendMessage({
          type: 'SELECT_STREAM_IN_PANEL',
          payload: { url, streamId, videoIndex },
        }).catch(() => {
          // DevTools panel not open, ignore
        });
        sendResponse({ success: true });
        return false;
      }

      default:
        return false;
    }
  });

  // Fetch manifest content
  async function fetchManifest(
    url: string,
    customHeaders?: Record<string, string>
  ): Promise<string> {
    const headers: HeadersInit = {
      Accept: '*/*',
      ...customHeaders,
    };

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`Failed to fetch manifest: ${response.status} ${response.statusText}`);
    }

    return response.text();
  }

  // Check if URL is a streaming-related request
  function isStreamingRequest(url: string): boolean {
    // Standard HLS/DASH patterns
    if (
      url.endsWith('.m3u8') ||
      url.endsWith('.mpd') ||
      url.endsWith('.ts') ||
      url.endsWith('.m4s') ||
      url.endsWith('.m4v') ||
      url.endsWith('.m4a') ||
      url.includes('.m3u8?') ||
      url.includes('.mpd?') ||
      url.includes('.ts?') ||
      url.includes('.m4s?') ||
      url.includes('/segment') ||
      url.includes('/chunk')
    ) {
      return true;
    }

    // YouTube video streams (googlevideo.com)
    if (url.includes('googlevideo.com') && (
      url.includes('/videoplayback') ||
      url.includes('itag=') ||
      url.includes('mime=video') ||
      url.includes('mime=audio')
    )) {
      return true;
    }

    // Vimeo CDN
    if ((url.includes('vimeocdn.com') || url.includes('akamaized.net')) && (
      url.includes('/video/') ||
      url.includes('/sep/') ||
      url.includes('.mp4')
    )) {
      return true;
    }

    // Twitch
    if ((url.includes('ttvnw.net') || url.includes('jtvnw.net')) && (
      url.includes('/v1/segment/') ||
      url.includes('.ts')
    )) {
      return true;
    }

    // Netflix CDN (nflxvideo)
    if (url.includes('nflxvideo.net')) {
      return true;
    }

    // Generic CDN segment patterns
    if (url.match(/\/range\/\d+-\d+/) || // Range requests for segments
        url.match(/\/sq\/\d+/) ||          // Sequence numbers
        url.match(/\/itag\/\d+/)) {        // Quality tags
      return true;
    }

    return false;
  }

  // Get request type from URL
  function getRequestType(url: string): NetworkRequest['type'] {
    // Standard manifest files
    if (url.endsWith('.m3u8') || url.endsWith('.mpd') || url.includes('.m3u8?') || url.includes('.mpd?')) {
      return 'manifest';
    }

    // Standard segment files
    if (url.endsWith('.ts') || url.endsWith('.m4s') || url.endsWith('.m4v') || url.endsWith('.m4a') ||
        url.includes('.ts?') || url.includes('.m4s?')) {
      return 'segment';
    }

    // YouTube segments (googlevideo.com)
    if (url.includes('googlevideo.com') && url.includes('/videoplayback')) {
      return 'segment';
    }

    // Vimeo/Akamai segments
    if ((url.includes('vimeocdn.com') || url.includes('akamaized.net')) &&
        (url.includes('/video/') || url.includes('/sep/'))) {
      return 'segment';
    }

    // Twitch segments
    if ((url.includes('ttvnw.net') || url.includes('jtvnw.net'))) {
      return 'segment';
    }

    // Netflix segments
    if (url.includes('nflxvideo.net')) {
      return 'segment';
    }

    // DRM key/license requests
    if (url.includes('.key') || url.includes('license') ||
        url.includes('widevine') || url.includes('playready') || url.includes('fairplay')) {
      return 'key';
    }

    // Init segments
    if (url.includes('init') || url.includes('/sq/0')) {
      return 'init';
    }

    return 'other';
  }

  // Get status text from status code
  function getStatusText(status: number): string {
    const statusTexts: Record<number, string> = {
      200: 'OK',
      206: 'Partial Content',
      301: 'Moved Permanently',
      302: 'Found',
      304: 'Not Modified',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
    };
    return statusTexts[status] || '';
  }

  // Add a master/parent stream to the tab's stream list and notify the panel
  function addMasterStream(stream: StreamInfo): void {
    console.log('[PlaybackLab] Master stream detected:', stream.type, stream.url);

    // Check if this stream is active (being played)
    const activeSources = activeVideoSources.get(stream.tabId) || [];
    stream.isActive = activeSources.some(src => urlsMatch(src, stream.url));

    // Get page info (title, URL) from tab - safely handle closed tabs
    safeGetTab(stream.tabId).then((tab) => {
      if (tab) {
        stream.pageTitle = tab.title;
        stream.pageUrl = tab.url;
      }

      // Store in tab map
      const streams = tabStreams.get(stream.tabId) || [];
      // Avoid duplicates — for CDN segments, also check hostname match to avoid
      // multiple synthetic parents from the same CDN
      const isDuplicate = streams.some(s => {
        if (s.url === stream.url) return true;
        // For CDN synthetic parents, dedupe by hostname
        try {
          const existingHost = new URL(s.url).hostname;
          const newHost = new URL(stream.url).hostname;
          // Same base hostname (e.g., *.googlevideo.com)
          const existingBase = existingHost.split('.').slice(-2).join('.');
          const newBase = newHost.split('.').slice(-2).join('.');
          if (existingBase === newBase && s.type === stream.type) return true;
        } catch { /* ignore */ }
        return false;
      });

      if (!isDuplicate) {
        streams.push(stream);
        tabStreams.set(stream.tabId, streams);

        // Notify DevTools panel
        chrome.runtime.sendMessage({
          type: 'STREAM_DETECTED',
          payload: stream,
        }).catch(() => {});

        // Update content script cache if overlays are enabled
        if (overlaysEnabledTabs.has(stream.tabId)) {
          const streamsCache = streams.map(s => ({ url: s.url, type: s.type, id: s.id }));
          chrome.tabs.sendMessage(stream.tabId, {
            type: 'UPDATE_STREAMS_CACHE',
            payload: { streams: streamsCache },
          }).catch(() => {});
        }

        // Auto-fetch and parse manifest (only for HLS/DASH, skipped for MSE)
        autoFetchManifest(stream);
      } else {
        // Duplicate CDN stream — route as segment to the existing one
        const existingParent = streams.find(s => {
          try {
            const existingBase = new URL(s.url).hostname.split('.').slice(-2).join('.');
            const newBase = new URL(stream.url).hostname.split('.').slice(-2).join('.');
            return existingBase === newBase && s.type === stream.type;
          } catch { return false; }
        });
        if (existingParent) {
          chrome.runtime.sendMessage({
            type: 'SEGMENT_DETECTED',
            payload: { parentStreamId: existingParent.id, segmentUrl: stream.url },
          }).catch(() => {});
        }
      }
    });
  }

  // Find a parent stream for a segment URL by matching hostname + shared path prefix
  function findParentStream(tabId: number, segmentUrl: string): StreamInfo | null {
    const streams = tabStreams.get(tabId);
    if (!streams?.length) return null;

    try {
      const segUrl = new URL(segmentUrl);
      const segHost = segUrl.hostname;
      const segBase = segHost.split('.').slice(-2).join('.');
      const segPathParts = segUrl.pathname.split('/').filter(Boolean);

      let bestMatch: StreamInfo | null = null;
      let bestMatchLength = 0;

      for (const stream of streams) {
        try {
          const streamUrl = new URL(stream.url);
          const streamHost = streamUrl.hostname;
          const streamBase = streamHost.split('.').slice(-2).join('.');

          // Match by exact hostname OR same base domain (for CDNs like *.googlevideo.com)
          if (streamHost !== segHost && streamBase !== segBase) continue;

          // For same-base-domain CDN matches (e.g., googlevideo.com), accept as parent
          if (streamHost !== segHost && streamBase === segBase) {
            if (!bestMatch || bestMatchLength === 0) {
              bestMatch = stream;
              bestMatchLength = 1;
            }
            continue;
          }

          // Count shared path prefix segments
          const streamPathParts = streamUrl.pathname.split('/').filter(Boolean);
          let shared = 0;
          for (let i = 0; i < Math.min(streamPathParts.length, segPathParts.length); i++) {
            if (streamPathParts[i] === segPathParts[i]) {
              shared++;
            } else {
              break;
            }
          }

          // Require at least 1 shared path segment
          if (shared > bestMatchLength) {
            bestMatchLength = shared;
            bestMatch = stream;
          }
        } catch {
          continue;
        }
      }

      return bestMatch;
    } catch {
      return null;
    }
  }

  // Auto-fetch and parse manifest when a stream is detected
  async function autoFetchManifest(stream: StreamInfo): Promise<void> {
    // Only fetch for HLS and DASH streams
    if (stream.type !== 'hls' && stream.type !== 'dash') return;

    try {
      console.log('[PlaybackLab] Auto-fetching manifest:', stream.url);

      const response = await fetch(stream.url, {
        headers: stream.requestHeaders || {},
      });

      if (!response.ok) {
        console.warn('[PlaybackLab] Manifest fetch failed:', response.status);
        return;
      }

      const content = await response.text();

      // Parse based on type
      let manifest: ParsedManifest | null = null;

      if (stream.type === 'hls') {
        const parser = await getHlsParser();
        if (parser.supports(content, stream.url)) {
          manifest = await parser.parse(content, stream.url);
        }
      } else if (stream.type === 'dash') {
        const parser = await getDashParser();
        if (parser.supports(content, stream.url)) {
          manifest = await parser.parse(content, stream.url);
        }
      }

      if (manifest) {
        console.log('[PlaybackLab] Manifest parsed successfully:', {
          variants: manifest.videoVariants?.length || 0,
          audioTracks: manifest.audioVariants?.length || 0,
          drm: manifest.drm?.length || 0,
        });

        // Send parsed manifest to DevTools panel
        chrome.runtime.sendMessage({
          type: 'MANIFEST_LOADED',
          payload: {
            streamId: stream.id,
            streamUrl: stream.url,
            tabId: stream.tabId,
            manifest,
          },
        }).catch(() => {
          // DevTools panel not open, ignore
        });
      }
    } catch (error) {
      console.warn('[PlaybackLab] Auto-fetch manifest error:', error);
    }
  }

  // Fetch and parse ad content
  async function fetchAdContent(
    url: string,
    customHeaders?: Record<string, string>
  ): Promise<{ success: boolean; content?: string; parsed?: unknown; error?: string }> {
    try {
      const headers: HeadersInit = {
        Accept: 'application/xml, text/xml, */*',
        ...customHeaders,
      };

      const response = await fetch(url, { headers });

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
      }

      const content = await response.text();

      // Try to parse VAST/VMAP
      const parser = await getVastParser();
      if (parser.supports(content)) {
        const parsed = await parser.parse(content, url);
        return { success: true, content, parsed };
      }

      return { success: true, content };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Auto-fetch and parse VAST/VMAP when ad is detected
  async function autoFetchAdContent(ad: DetectedAd): Promise<void> {
    try {
      console.log('[PlaybackLab] Auto-fetching ad content:', ad.url);

      const result = await fetchAdContent(ad.url, ad.requestHeaders);

      if (!result.success) {
        console.warn('[PlaybackLab] Ad fetch failed:', result.error);
        // Send error to panel
        chrome.runtime.sendMessage({
          type: 'AD_ERROR',
          payload: {
            adId: ad.id,
            tabId: ad.tabId,
            error: result.error,
          },
        }).catch(() => {});
        return;
      }

      if (result.parsed) {
        console.log('[PlaybackLab] Ad parsed successfully:', ad.format);

        // Update the stored ad
        const ads = tabAds.get(ad.tabId);
        if (ads) {
          const index = ads.findIndex(a => a.id === ad.id);
          if (index !== -1) {
            ads[index] = {
              ...ads[index],
              ...(result.parsed as object),
              rawXml: result.content,
              isLoading: false,
            };
          }
        }

        // Send parsed ad to DevTools panel
        chrome.runtime.sendMessage({
          type: 'AD_PARSED',
          payload: {
            adId: ad.id,
            tabId: ad.tabId,
            ...result.parsed,
            rawXml: result.content,
          },
        }).catch(() => {});
      }
    } catch (error) {
      console.warn('[PlaybackLab] Auto-fetch ad error:', error);
    }
  }

  // Log extension startup
  console.log('[PlaybackLab] Background service worker started (clean mode - auto-detection off by default)');
});

// WXT type declaration
declare function defineBackground(fn: () => void): { main: () => void };

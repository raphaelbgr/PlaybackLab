/**
 * StreamDetector - Smart stream detection with filtering
 * SOLID: Single Responsibility - Only detects legitimate video streams
 */

import type { IStreamDetector, StreamInfo, DetectionResult } from '../interfaces/IStreamDetector';

type StreamDetectedCallback = (stream: StreamInfo) => void;

// Blocklist of tracking/analytics/ad domains
const BLOCKED_DOMAINS = [
  // Google Ads & Analytics (NOT googleusercontent.com or gstatic.com - those host legitimate content)
  'google-analytics.com',
  'googletagmanager.com',
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'googleads.g.doubleclick.net',
  'pagead2.googlesyndication.com',
  'imasdk.googleapis.com',
  // Social
  'facebook.com',
  'facebook.net',
  'fbcdn.net',
  'twitter.com',
  'linkedin.com',
  'pinterest.com',
  // Ad Networks
  'amazon-adsystem.com',
  'criteo.com',
  'outbrain.com',
  'taboola.com',
  'adsrvr.org',
  'rubiconproject.com',
  'pubmatic.com',
  'openx.net',
  'casalemedia.com',
  'indexww.com',
  'bidswitch.net',
  'moatads.com',
  'serving-sys.com',
  'adnxs.com',
  'adsafeprotected.com',
  'doubleverify.com',
  // Analytics
  'hotjar.com',
  'mixpanel.com',
  'segment.io',
  'segment.com',
  'amplitude.com',
  'heap.io',
  'fullstory.com',
  'clarity.ms',
  'newrelic.com',
  'nr-data.net',
  'sentry.io',
  'bugsnag.com',
  'rollbar.com',
  'loggly.com',
  'sumologic.com',
  'datadoghq.com',
  'optimizely.com',
  'adobedtm.com',
  'omtrdc.net',
  'demdex.net',
  'bing.com',
  'bat.bing.com',
  'scorecardresearch.com',
  'quantserve.com',
  'chartbeat.com',
  'parsely.com',
  'comscore.com',
];

// Blocked URL patterns (tracking, pixels, etc.)
const BLOCKED_PATTERNS = [
  /\/collect\?/i,
  /\/collect$/i,
  /\/pixel/i,
  /\/beacon/i,
  /\/tracking/i,
  /\/analytics/i,
  /\/conversion/i,
  /\/attribution/i,
  /\/measurement/i,
  /\/impression/i,
  /\/viewthrough/i,
  /\/event\?/i,
  /\/log\?/i,
  /\/ping\?/i,
  /\/stats\?/i,
  /\/__ptq\./i,
  /\/gtm\./i,
  /\/gtag/i,
  /\/fbevents/i,
  /1p-user-list/i,
  /px\/li_sync/i,
  /ads\//i,
  /adserver/i,
  /pagead/i,
];

export class StreamDetector implements IStreamDetector {
  private callbacks: Set<StreamDetectedCallback> = new Set();
  private detectedStreams: Map<string, StreamInfo> = new Map();
  private enabled: boolean = true;
  private filterAds: boolean = true;

  /**
   * Check if URL is a legitimate stream URL
   * STRICT: Only match actual manifest file extensions
   */
  isStreamUrl(url: string): boolean {
    if (!this.enabled) return false;

    // Check blocklist first (if filtering is enabled)
    if (this.filterAds && this.isBlockedUrl(url)) {
      return false;
    }

    return this.detectStreamType(url) !== 'unknown';
  }

  /**
   * Set filter ads mode
   */
  setFilterAds(enabled: boolean): void {
    this.filterAds = enabled;
  }

  /**
   * Get filter ads status
   */
  isFilteringAds(): boolean {
    return this.filterAds;
  }

  /**
   * Detect stream type - Matches manifest files and known streaming CDN patterns
   */
  detectStreamType(url: string): 'hls' | 'dash' | 'mse' | 'unknown' {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.toLowerCase();
      const hostname = urlObj.hostname.toLowerCase();

      // Standard manifest extensions
      if (pathname.endsWith('.m3u8')) {
        return 'hls';
      }

      if (pathname.endsWith('.mpd')) {
        return 'dash';
      }

      // YouTube video URLs (googlevideo.com)
      if (hostname.includes('googlevideo.com')) {
        return 'mse'; // YouTube uses MSE with DASH
      }

      // Vimeo CDN
      if (hostname.includes('vimeocdn.com') || hostname.includes('akamaized.net')) {
        if (pathname.includes('/video/') || pathname.includes('/sep/')) {
          return 'mse';
        }
      }

      // Twitch
      if (hostname.includes('ttvnw.net') || hostname.includes('twitch.tv')) {
        return 'hls';
      }

      // Netflix
      if (hostname.includes('nflxvideo.net')) {
        return 'mse';
      }

      // Generic video segment patterns
      if (pathname.match(/\/segment[\d_-]+\.(m4s|mp4|ts)/) ||
          pathname.match(/\/chunk[\d_-]+\.(m4s|mp4|ts)/) ||
          pathname.match(/\/frag[\d_-]+\.(m4s|mp4|ts)/)) {
        return 'mse';
      }

      return 'unknown';
    } catch {
      // Invalid URL
      return 'unknown';
    }
  }

  /**
   * Detect platform from URL
   */
  detectPlatform(url: string): string | undefined {
    try {
      const hostname = new URL(url).hostname.toLowerCase();

      if (hostname.includes('googlevideo.com') || hostname.includes('youtube.com')) {
        return 'youtube';
      }
      if (hostname.includes('vimeocdn.com') || hostname.includes('vimeo.com')) {
        return 'vimeo';
      }
      if (hostname.includes('ttvnw.net') || hostname.includes('twitch.tv')) {
        return 'twitch';
      }
      if (hostname.includes('nflxvideo.net') || hostname.includes('netflix.com')) {
        return 'netflix';
      }
      if (hostname.includes('akamaized.net')) {
        return 'akamai';
      }

      return undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Check if URL should be blocked (tracking, analytics, etc.)
   */
  private isBlockedUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();

      // Check blocked domains
      for (const domain of BLOCKED_DOMAINS) {
        if (hostname.includes(domain)) {
          return true;
        }
      }

      // Check blocked patterns
      for (const pattern of BLOCKED_PATTERNS) {
        if (pattern.test(url)) {
          return true;
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Check if this is likely a master/main manifest (not a variant or segment playlist)
   */
  isMasterManifest(url: string): boolean {
    const lowerUrl = url.toLowerCase();

    // Likely variant playlists (sub-playlists)
    const variantPatterns = [
      /_\d+p\.m3u8/,           // _720p.m3u8, _1080p.m3u8
      /\/\d+\/index\.m3u8/,    // /720/index.m3u8
      /_video_\d+/,            // _video_1080
      /_audio_\d+/,            // _audio_128000
      /chunklist/i,            // chunklist_*.m3u8
      /media_\d+/i,            // media_0.m3u8
      /stream_\d+/i,           // stream_0.m3u8
    ];

    for (const pattern of variantPatterns) {
      if (pattern.test(lowerUrl)) {
        return false;
      }
    }

    return true;
  }

  processRequest(details: chrome.webRequest.WebRequestDetails): DetectionResult {
    const { url, tabId, frameId, initiator, requestId } = details;

    if (!this.isStreamUrl(url)) {
      return { detected: false };
    }

    // Create unique key for deduplication
    const streamKey = `${tabId}-${url}`;
    if (this.detectedStreams.has(streamKey)) {
      return {
        detected: true,
        stream: this.detectedStreams.get(streamKey),
      };
    }

    const isMaster = this.isMasterManifest(url);
    const streamType = this.detectStreamType(url);
    const platform = this.detectPlatform(url);

    const stream: StreamInfo = {
      id: `stream-${requestId}-${Date.now()}`,
      url,
      type: streamType,
      detectedAt: Date.now(),
      tabId,
      frameId,
      initiator: initiator ?? undefined,
      isMaster,
      platform,
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

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getStreamsForTab(tabId: number): StreamInfo[] {
    const streams: StreamInfo[] = [];
    for (const [, stream] of this.detectedStreams) {
      if (stream.tabId === tabId) {
        streams.push(stream);
      }
    }
    return streams;
  }
}

// Singleton instance
export const streamDetector = new StreamDetector();

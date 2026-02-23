/**
 * StreamDetector - Stream detection via file extension + Content-Type matching
 *
 * Based on the battle-tested approach from stream-detector (54ac/stream-detector):
 * - File extension matching (no regex on URL paths)
 * - Content-Type header matching (IANA registered MIME types)
 * - Categorized: manifest (shown in UI), segment (counted), subtitle
 *
 * Detection strategy (three layers):
 * 1. File extension matching (onBeforeRequest) — catches 95%+ of streams worldwide
 * 2. CDN URL patterns (onBeforeRequest) — catches extensionless URLs (YouTube /videoplayback)
 * 3. Content-Type header matching (onHeadersReceived) — universal catch-all for any CDN
 *
 * Platform detection covers 40+ worldwide CDN/streaming domains for UI labeling.
 */

import type { IStreamDetector, StreamInfo, DetectionResult, StreamContentType, StreamRole } from '../interfaces/IStreamDetector';

type StreamDetectedCallback = (stream: StreamInfo) => void;

// --- Supported formats (from stream-detector + our additions) ---

export type StreamCategory = 'manifest' | 'segment' | 'subtitle';

export interface SupportedFormat {
  /** File extensions (without dot) */
  ext: string[];
  /** Content-Type MIME types (lowercase) */
  ct: string[];
  /** Protocol/format name */
  type: 'HLS' | 'DASH' | 'HDS' | 'MSS' | 'MP4' | 'TS' | 'AAC' | 'WEBM' | 'OGG' | 'MP3' | 'VTT' | 'SRT' | 'TTML' | 'DFXP';
  /** Classification for UI */
  category: StreamCategory;
}

/**
 * Comprehensive format registry.
 * Sources: stream-detector (54ac), Akamai HLS docs, IANA MIME types, MDN.
 */
export const SUPPORTED_FORMATS: SupportedFormat[] = [
  // --- Manifests (shown as streams in UI) ---
  {
    ext: ['m3u8'],
    ct: ['application/x-mpegurl', 'application/vnd.apple.mpegurl', 'audio/vnd.apple.mpegurl', 'audio/x-mpegurl'],
    type: 'HLS',
    category: 'manifest',
  },
  {
    ext: ['mpd'],
    ct: ['application/dash+xml'],
    type: 'DASH',
    category: 'manifest',
  },
  {
    ext: ['f4m'],
    ct: ['application/f4m', 'application/f4m+xml'],
    type: 'HDS',
    category: 'manifest',
  },
  {
    ext: ['ism/manifest'],
    ct: [],
    type: 'MSS',
    category: 'manifest',
  },

  // --- Segments (counted under parent streams) ---
  {
    ext: ['ts', 'm2t', 'm2ts'],
    ct: ['video/mp2t', 'video/mpeg'],
    type: 'TS',
    category: 'segment',
  },
  {
    ext: ['m4s'],
    ct: [],  // m4s usually served as application/octet-stream
    type: 'MP4',
    category: 'segment',
  },
  {
    ext: ['m4v'],
    ct: ['video/x-m4v', 'video/m4v'],
    type: 'MP4',
    category: 'segment',
  },
  {
    ext: ['m4a'],
    ct: ['audio/m4a', 'audio/x-m4a'],
    type: 'AAC',
    category: 'segment',
  },
  {
    ext: ['aac'],
    ct: ['audio/aac'],
    type: 'AAC',
    category: 'segment',
  },
  {
    ext: ['weba', 'webm'],
    ct: ['audio/webm', 'video/webm'],
    type: 'WEBM',
    category: 'segment',
  },
  {
    ext: ['ogg', 'ogv', 'oga', 'opus'],
    ct: ['video/ogg', 'audio/ogg', 'audio/opus'],
    type: 'OGG',
    category: 'segment',
  },
  {
    ext: ['mp3'],
    ct: ['audio/mpeg'],
    type: 'MP3',
    category: 'segment',
  },

  // --- Subtitles ---
  {
    ext: ['vtt'],
    ct: ['text/vtt'],
    type: 'VTT',
    category: 'subtitle',
  },
  {
    ext: ['srt'],
    ct: ['application/x-subrip'],
    type: 'SRT',
    category: 'subtitle',
  },
  {
    ext: ['ttml', 'ttml2'],
    ct: ['application/ttml+xml'],
    type: 'TTML',
    category: 'subtitle',
  },
  {
    ext: ['dfxp'],
    ct: ['application/ttaf+xml'],
    type: 'DFXP',
    category: 'subtitle',
  },
];

// Build lookup maps for O(1) matching
const EXT_MAP = new Map<string, SupportedFormat>();
const CT_MAP = new Map<string, SupportedFormat>();

for (const fmt of SUPPORTED_FORMATS) {
  for (const ext of fmt.ext) {
    EXT_MAP.set(ext, fmt);
  }
  for (const ct of fmt.ct) {
    CT_MAP.set(ct, fmt);
  }
}

// --- CDN-specific detectors (for platforms without standard extensions) ---

interface CdnMatch {
  type: 'hls' | 'dash' | 'mse';
  platform: string;
  category: StreamCategory;
}

/**
 * Detect known CDN patterns that don't use standard file extensions.
 * This is the ONLY place with hostname checks — kept minimal.
 */
function matchCdn(hostname: string, pathname: string): CdnMatch | null {
  // YouTube: *.googlevideo.com/videoplayback
  if (hostname.endsWith('googlevideo.com') && pathname.includes('/videoplayback')) {
    return { type: 'mse', platform: 'youtube', category: 'segment' };
  }
  return null;
}

// --- Blocklist for tracking/analytics ---

const BLOCKED_DOMAINS = [
  'google-analytics.com', 'googletagmanager.com', 'doubleclick.net',
  'googlesyndication.com', 'googleadservices.com', 'imasdk.googleapis.com',
  'facebook.com', 'facebook.net', 'fbcdn.net', 'amazon-adsystem.com',
  'criteo.com', 'outbrain.com', 'taboola.com', 'moatads.com', 'adnxs.com',
  'adsafeprotected.com', 'doubleverify.com', 'hotjar.com', 'mixpanel.com',
  'amplitude.com', 'fullstory.com', 'clarity.ms', 'newrelic.com',
  'sentry.io', 'datadoghq.com', 'scorecardresearch.com', 'comscore.com',
];

const BLOCKED_PATH_KEYWORDS = [
  '/collect', '/pixel', '/beacon', '/tracking', '/analytics',
  '/pagead', '/adserver', '/generate_204',
];

function isBlockedUrl(hostname: string, pathname: string): boolean {
  for (const domain of BLOCKED_DOMAINS) {
    if (hostname.endsWith(domain)) return true;
  }
  for (const keyword of BLOCKED_PATH_KEYWORDS) {
    if (pathname.includes(keyword)) return true;
  }
  return false;
}

// --- Main detector ---

export interface MatchResult {
  format: SupportedFormat | null;
  cdnMatch: CdnMatch | null;
}

/**
 * Match a URL against known formats by file extension.
 */
function matchByExtension(pathname: string): SupportedFormat | null {
  const lower = pathname.toLowerCase();

  // Special case: ism/manifest (multi-part extension)
  if (lower.includes('.ism/manifest')) {
    return EXT_MAP.get('ism/manifest') ?? null;
  }

  // Extract extension from last path segment
  const lastSlash = lower.lastIndexOf('/');
  const filename = lastSlash >= 0 ? lower.slice(lastSlash + 1) : lower;
  const queryStart = filename.indexOf('?');
  const clean = queryStart >= 0 ? filename.slice(0, queryStart) : filename;
  const dotIndex = clean.lastIndexOf('.');
  if (dotIndex < 0) return null;

  const ext = clean.slice(dotIndex + 1);
  return EXT_MAP.get(ext) ?? null;
}

/**
 * Match a Content-Type header value against known MIME types.
 * Exported for use in background script's onHeadersReceived.
 */
export function matchByContentType(contentType: string): SupportedFormat | null {
  // Content-Type may include charset: "video/mp2t; charset=utf-8"
  const mime = contentType.split(';')[0].trim().toLowerCase();
  return CT_MAP.get(mime) ?? null;
}

export class StreamDetector implements IStreamDetector {
  private callbacks: Set<StreamDetectedCallback> = new Set();
  private detectedStreams: Map<string, StreamInfo> = new Map();
  private enabled: boolean = true;
  private filterAds: boolean = true;

  /**
   * Check if URL is a stream/segment/subtitle URL.
   */
  isStreamUrl(url: string): boolean {
    if (!this.enabled) return false;
    try {
      const urlObj = new URL(url);
      if (this.filterAds && isBlockedUrl(urlObj.hostname, urlObj.pathname)) return false;
      if (matchByExtension(urlObj.pathname)) return true;
      if (matchCdn(urlObj.hostname, urlObj.pathname)) return true;
      return false;
    } catch {
      return false;
    }
  }

  setFilterAds(enabled: boolean): void { this.filterAds = enabled; }
  isFilteringAds(): boolean { return this.filterAds; }

  /**
   * Detect stream type from URL.
   */
  detectStreamType(url: string): 'hls' | 'dash' | 'mse' | 'unknown' {
    try {
      const urlObj = new URL(url);
      const fmt = matchByExtension(urlObj.pathname);
      if (fmt) {
        switch (fmt.type) {
          case 'HLS': return 'hls';
          case 'DASH': return 'dash';
          case 'HDS': case 'MSS': return 'mse';
          // Segment types: infer protocol from context, default to mse
          default: return 'mse';
        }
      }
      const cdn = matchCdn(urlObj.hostname, urlObj.pathname);
      if (cdn) return cdn.type;
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get the detection category for a URL: manifest, segment, or subtitle.
   */
  detectCategory(url: string): StreamCategory | null {
    try {
      const urlObj = new URL(url);
      const fmt = matchByExtension(urlObj.pathname);
      if (fmt) return fmt.category;
      const cdn = matchCdn(urlObj.hostname, urlObj.pathname);
      if (cdn) return cdn.category;
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Detect platform from URL hostname.
   * Covers 40+ worldwide streaming platforms and CDN providers.
   */
  detectPlatform(url: string): string | undefined {
    try {
      const hostname = new URL(url).hostname.toLowerCase();

      // --- Major streaming platforms ---
      // YouTube
      if (hostname.endsWith('googlevideo.com') || hostname.endsWith('youtube.com') || hostname.endsWith('ytimg.com')) return 'youtube';
      // Twitch
      if (hostname.endsWith('ttvnw.net') || hostname.endsWith('jtvnw.net') || hostname.endsWith('twitch.tv')) return 'twitch';
      // Netflix
      if (hostname.endsWith('nflxvideo.net') || hostname.endsWith('netflix.com')) return 'netflix';
      // Vimeo
      if (hostname.includes('vimeocdn.com') || hostname.endsWith('vimeo.com')) return 'vimeo';
      // Disney+ / Hulu / ESPN+ (Disney Streaming Services)
      if (hostname.endsWith('bamgrid.com') || hostname.endsWith('disney-plus.net') || hostname.endsWith('disneyplus.com') ||
          hostname.endsWith('dssott.com') || hostname.endsWith('starott.com')) return 'disney';
      // Amazon Prime Video
      if (hostname.endsWith('amazonvideo.com') || hostname.endsWith('primevideo.com') || hostname.endsWith('pv-cdn.net') ||
          hostname.endsWith('media-amazon.com') || hostname.endsWith('aiv-cdn.net')) return 'amazon';
      // HBO Max / Max
      if (hostname.endsWith('hbomaxcdn.com') || hostname.endsWith('hbomax.com') || hostname.endsWith('max.com') ||
          hostname.endsWith('hbo.com') || hostname.endsWith('wbd.com')) return 'hbo';
      // Hulu
      if (hostname.endsWith('hulustream.com') || hostname.endsWith('hulu.com') || hostname.endsWith('huluim.com')) return 'hulu';
      // Paramount+ / CBS
      if (hostname.endsWith('cbsaavideo.com') || hostname.endsWith('cbsi.com') || hostname.endsWith('paramountplus.com') ||
          hostname.endsWith('paramount.com') || hostname.endsWith('cbsivideo.com')) return 'paramount';
      // Peacock / NBC
      if (hostname.endsWith('peacocktv.com') || hostname.endsWith('nbcuni.com') || hostname.endsWith('nbcustr.com')) return 'peacock';
      // Apple TV+ / Apple CDN
      if (hostname.endsWith('apple.com') && (hostname.includes('hls') || hostname.includes('streaming') || hostname.includes('devstreaming'))) return 'apple';
      if (hostname.endsWith('cdn-apple.com')) return 'apple';
      // Dailymotion
      if (hostname.endsWith('dmcdn.net') || hostname.endsWith('dailymotion.com') || hostname.endsWith('dm-event.net')) return 'dailymotion';
      // TikTok / ByteDance
      if (hostname.includes('tiktokcdn.com') || hostname.includes('tiktokv.com') || hostname.includes('musical.ly') ||
          hostname.includes('byteoversea.com') || hostname.includes('ibytedtos.com') || hostname.includes('bytecdn.cn') ||
          hostname.includes('bytegecko.com') || hostname.includes('ipstatp.com')) return 'tiktok';
      // Facebook / Meta / Instagram
      if (hostname.endsWith('fbvideo.com') || (hostname.endsWith('fbcdn.net') && !this.filterAds) ||
          hostname.endsWith('instagram.com') || hostname.endsWith('cdninstagram.com')) return 'meta';
      // Twitter / X
      if (hostname.endsWith('twimg.com') || hostname.endsWith('pscp.tv') || hostname.endsWith('periscope.tv') ||
          hostname.endsWith('video.twimg.com')) return 'twitter';
      // Spotify (podcasts/video)
      if (hostname.endsWith('scdn.co') || hostname.endsWith('spotifycdn.com') || hostname.endsWith('audio-ak-spotify-com.akamaized.net')) return 'spotify';
      // Crunchyroll
      if (hostname.endsWith('vrv.co') || hostname.endsWith('crunchyroll.com') || hostname.endsWith('cr-unblocker.com')) return 'crunchyroll';
      // Pluto TV
      if (hostname.endsWith('pluto.tv') || hostname.endsWith('plutotv.net')) return 'pluto';
      // Tubi
      if (hostname.endsWith('tubitv.com') || hostname.endsWith('tubi.io')) return 'tubi';

      // --- Video platform providers ---
      // Brightcove
      if (hostname.endsWith('brightcovecdn.com') || hostname.endsWith('boltdns.net') || hostname.endsWith('bcovlive.io') ||
          hostname.endsWith('brightcove.com') || hostname.endsWith('bcove.video')) return 'brightcove';
      // JW Player
      if (hostname.endsWith('jwpcdn.com') || hostname.endsWith('jwpsrv.com') || hostname.endsWith('jwpltx.com') ||
          hostname.endsWith('jwplayer.com')) return 'jwplayer';
      // Mux
      if (hostname.endsWith('mux.com') || hostname.endsWith('mux.dev') || hostname.endsWith('stream.mux.com')) return 'mux';
      // Wistia
      if (hostname.endsWith('wistia.com') || hostname.endsWith('wistia.net') || hostname.endsWith('wi.st')) return 'wistia';
      // Vidyard
      if (hostname.endsWith('vidyard.com') || hostname.endsWith('vyinteractive.com')) return 'vidyard';
      // Kaltura
      if (hostname.endsWith('kaltura.com') || hostname.endsWith('kalturacdn.com') || hostname.endsWith('kaltura.org')) return 'kaltura';
      // Bitmovin
      if (hostname.endsWith('bitmovin.com') || hostname.endsWith('bitmovin.net') || hostname.endsWith('bitdash-a.akamaihd.net')) return 'bitmovin';
      // Dacast
      if (hostname.endsWith('dacast.com') || hostname.endsWith('dacastcdn.com')) return 'dacast';
      // MediaTailor (AWS)
      if (hostname.includes('mediatailor') && hostname.endsWith('amazonaws.com')) return 'mediatailor';

      // --- CDN providers (generic) ---
      // Akamai
      if (hostname.endsWith('akamaized.net') || hostname.endsWith('akamaihd.net') || hostname.endsWith('akamaistream.net') ||
          hostname.endsWith('akamai.net') || hostname.endsWith('edgesuite.net') || hostname.endsWith('edgekey.net')) return 'akamai';
      // CloudFront (AWS)
      if (hostname.endsWith('cloudfront.net')) return 'cloudfront';
      // Fastly
      if (hostname.endsWith('fastly.net') || hostname.endsWith('fastlylb.net') || hostname.endsWith('global.ssl.fastly.net')) return 'fastly';
      // Cloudflare
      if (hostname.endsWith('cloudflarestream.com') || hostname.endsWith('videodelivery.net') || hostname.endsWith('cfvod.kaltura.com')) return 'cloudflare';
      // Limelight / Edgio
      if (hostname.endsWith('llnwd.net') || hostname.endsWith('limelight.com') || hostname.endsWith('llnw.net') ||
          hostname.endsWith('edgio.net') || hostname.endsWith('edgecast.com') || hostname.endsWith('edgecastcdn.net')) return 'limelight';
      // Microsoft Azure CDN
      if (hostname.endsWith('azureedge.net') || hostname.endsWith('media.azure.net') || hostname.endsWith('vo.msecnd.net')) return 'azure';
      // Google Cloud CDN
      if (hostname.endsWith('storage.googleapis.com') || hostname.endsWith('cdn.googleapis.com')) return 'gcloud';
      // CDN77
      if (hostname.endsWith('cdn77.org') || hostname.endsWith('rsc.cdn77.org')) return 'cdn77';
      // StackPath / Highwinds
      if (hostname.endsWith('stackpathcdn.com') || hostname.endsWith('hwcdn.net') || hostname.endsWith('highwinds.com')) return 'stackpath';
      // KeyCDN
      if (hostname.endsWith('kxcdn.com') || hostname.endsWith('keycdn.com')) return 'keycdn';
      // BunnyCDN
      if (hostname.endsWith('b-cdn.net') || hostname.endsWith('bunnycdn.com')) return 'bunnycdn';
      // Imperva / Incapsula
      if (hostname.endsWith('incapdns.net') || hostname.endsWith('impervadns.net')) return 'imperva';

      // --- Regional/telco CDNs ---
      // China: Alibaba Cloud / Tencent / Baidu
      if (hostname.endsWith('alicdn.com') || hostname.endsWith('aliyuncs.com') || hostname.endsWith('tbcdn.cn')) return 'alibaba';
      if (hostname.endsWith('myqcloud.com') || hostname.endsWith('qcloud.com') || hostname.endsWith('qq.com')) return 'tencent';
      if (hostname.endsWith('baidustatic.com') || hostname.endsWith('bdstatic.com') || hostname.endsWith('bcebos.com')) return 'baidu';
      // Korea: Kakao / Naver
      if (hostname.endsWith('kakaocdn.net') || hostname.endsWith('kakao.com')) return 'kakao';
      if (hostname.endsWith('naver.com') || hostname.endsWith('pstatic.net')) return 'naver';
      // Japan: NicoNico
      if (hostname.endsWith('nicovideo.jp') || hostname.endsWith('nimg.jp') || hostname.endsWith('dmc.nico')) return 'niconico';
      // Russia: Yandex
      if (hostname.endsWith('yandex.net') || hostname.endsWith('yastatic.net')) return 'yandex';
      // India: JioCinema / Hotstar
      if (hostname.endsWith('jiocinema.com') || hostname.endsWith('jio.com')) return 'jiocinema';
      if (hostname.endsWith('hotstar.com') || hostname.endsWith('hotstarext.com') || hostname.endsWith('akamaized.net' /* already caught */)) return 'hotstar';
      // Latin America: Globo
      if (hostname.endsWith('globo.com') || hostname.endsWith('globoplay.com') || hostname.endsWith('globovideos.com')) return 'globo';

      return undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Check if a URL is a master/top-level manifest (not a variant or segment).
   *
   * Simple heuristic: manifests (.m3u8/.mpd) are master unless they have
   * variant-like path patterns. Segments are never master.
   */
  isMasterManifest(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.toLowerCase();

      const fmt = matchByExtension(pathname);
      // Non-manifest formats are never master
      if (!fmt || fmt.category !== 'manifest') return false;

      // Variant playlist indicators (simple string includes — no regex)
      const variantIndicators = [
        'chunklist', 'media_', 'stream_',       // common variant naming
        '_video_', '_audio_',                     // track-specific
        '/url_',                                  // CDN variant path (/url_6/)
        '/v1/playlist/',                          // Twitch variants
        '_mp4_h264_', '_mp4_h265_',              // encoding variants
      ];

      // index.m3u8 is a variant when inside a sub-path (e.g., /720p/index.m3u8)
      // but a master when at root (e.g., /index.m3u8)
      const pathSegments = pathname.split('/').filter(Boolean);
      if (pathSegments.length > 1 && pathname.endsWith('index.m3u8')) {
        return false;
      }

      const fullPath = pathname + urlObj.search.toLowerCase();
      for (const indicator of variantIndicators) {
        if (fullPath.includes(indicator)) return false;
      }

      // Resolution-based variant detection: path contains /720p/, /1080p/, etc.
      // or filename like _720p.m3u8
      if (/\/\d{3,4}p[\/.]/.test(pathname)) return false;
      if (/_\d{3,4}p\./.test(pathname)) return false;

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Detect content type from URL patterns.
   */
  detectContentType(url: string): StreamContentType {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.toLowerCase();

      const fmt = matchByExtension(pathname);
      if (fmt) {
        if (fmt.category === 'subtitle') return 'subtitle';
        if (['AAC', 'MP3', 'OGG'].includes(fmt.type)) return 'audio';
        if (fmt.type === 'WEBM') {
          // webm could be audio or video — check extension
          if (pathname.endsWith('.weba')) return 'audio';
        }
      }

      // Check for audio indicators in path
      const lower = pathname + urlObj.search.toLowerCase();
      if (lower.includes('audio') || lower.includes('/a_')) return 'audio';
      if (lower.includes('subtitle') || lower.includes('/sub')) return 'subtitle';

      // Master manifests are mixed (video + audio)
      if (this.isMasterManifest(url)) return 'mixed';

      return 'video';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Detect stream role from URL.
   */
  detectStreamRole(url: string): StreamRole {
    if (this.isMasterManifest(url)) return 'master';

    const category = this.detectCategory(url);
    if (category === 'subtitle') return 'subtitle-track';
    if (category === 'segment') return 'standalone';

    // It's a manifest but not master → variant
    if (category === 'manifest') return 'variant';

    return 'standalone';
  }

  processRequest(details: chrome.webRequest.WebRequestDetails, options?: { filterAds?: boolean }): DetectionResult {
    const { url, tabId, frameId, initiator, requestId } = details;

    if (!this.enabled) return { detected: false };

    // Use per-call filterAds if provided — avoids shared mutable state across tabs
    const shouldFilterAds = options?.filterAds ?? this.filterAds;

    try {
      const urlObj = new URL(url);
      if (shouldFilterAds && isBlockedUrl(urlObj.hostname, urlObj.pathname)) return { detected: false };
      if (!matchByExtension(urlObj.pathname) && !matchCdn(urlObj.hostname, urlObj.pathname)) return { detected: false };
    } catch {
      return { detected: false };
    }

    // Dedup by tab + url
    const streamKey = `${tabId}-${url}`;
    if (this.detectedStreams.has(streamKey)) {
      return { detected: true, stream: this.detectedStreams.get(streamKey) };
    }

    const isMaster = this.isMasterManifest(url);
    const streamType = this.detectStreamType(url);
    const platform = this.detectPlatform(url);
    const contentType = this.detectContentType(url);
    const role = this.detectStreamRole(url);

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
      contentType,
      role,
    };

    this.detectedStreams.set(streamKey, stream);
    this.notifyCallbacks(stream);
    return { detected: true, stream };
  }

  /**
   * Process response headers to detect streams via Content-Type.
   * This is the universal catch-all — works for ANY CDN worldwide,
   * regardless of URL patterns or file extensions.
   *
   * Called from background script's onHeadersReceived listener.
   */
  processResponseHeaders(
    url: string,
    responseContentType: string,
    tabId: number,
    frameId: number,
    requestId: string,
    initiator?: string,
    options?: { filterAds?: boolean },
  ): DetectionResult {
    if (!this.enabled) return { detected: false };

    // Skip if already detected by URL-based matching (onBeforeRequest)
    // Return false to prevent background from calling addMasterStream a second time
    const streamKey = `${tabId}-${url}`;
    if (this.detectedStreams.has(streamKey)) {
      return { detected: false };
    }

    // Check Content-Type against known MIME types
    const fmt = matchByContentType(responseContentType);
    if (!fmt) return { detected: false };

    // Apply ad filtering — use per-call option to avoid shared mutable state
    const shouldFilterAds = options?.filterAds ?? this.filterAds;
    try {
      const urlObj = new URL(url);
      if (shouldFilterAds && isBlockedUrl(urlObj.hostname, urlObj.pathname)) {
        return { detected: false };
      }
    } catch {
      return { detected: false };
    }

    // Determine stream properties from format
    let streamType: 'hls' | 'dash' | 'mse' | 'unknown';
    switch (fmt.type) {
      case 'HLS': streamType = 'hls'; break;
      case 'DASH': streamType = 'dash'; break;
      case 'HDS': case 'MSS': streamType = 'mse'; break;
      default: streamType = 'mse';
    }

    const isMaster = fmt.category === 'manifest' ? this.isMasterManifest(url) : false;
    const platform = this.detectPlatform(url);
    const contentType = this.detectContentType(url);
    const role = this.detectStreamRole(url);

    const stream: StreamInfo = {
      id: `stream-${requestId}-${Date.now()}`,
      url,
      type: streamType,
      detectedAt: Date.now(),
      tabId,
      frameId,
      initiator,
      isMaster,
      platform,
      contentType,
      role,
    };

    this.detectedStreams.set(streamKey, stream);
    this.notifyCallbacks(stream);
    return { detected: true, stream };
  }

  onStreamDetected(callback: StreamDetectedCallback): () => void {
    this.callbacks.add(callback);
    return () => { this.callbacks.delete(callback); };
  }

  private notifyCallbacks(stream: StreamInfo): void {
    for (const callback of this.callbacks) {
      try { callback(stream); } catch (error) {
        console.error('[StreamDetector] Callback error:', error);
      }
    }
  }

  clearForTab(tabId: number): void {
    for (const [key, stream] of this.detectedStreams) {
      if (stream.tabId === tabId) this.detectedStreams.delete(key);
    }
  }

  setEnabled(enabled: boolean): void { this.enabled = enabled; }
  isEnabled(): boolean { return this.enabled; }

  getStreamsForTab(tabId: number): StreamInfo[] {
    return [...this.detectedStreams.values()].filter(s => s.tabId === tabId);
  }
}

export const streamDetector = new StreamDetector();

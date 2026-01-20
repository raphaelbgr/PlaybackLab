/**
 * PageScanner - Scans page content for stream URLs
 * Extracted from content script for testability
 */

// Blocked domains for scanner
export const SCANNER_BLOCKED_DOMAINS = [
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'googleads',
  'imasdk.googleapis.com',
  'google-analytics.com',
  'googletagmanager.com',
  'facebook.com',
  'facebook.net',
  'twitter.com',
  'adsrvr.org',
  'criteo.com',
  'pubmatic.com',
  'outbrain.com',
  'taboola.com',
  'moatads.com',
  'serving-sys.com',
  'adnxs.com',
];

export interface ScannedStream {
  url: string;
  type: 'hls' | 'dash' | 'mse';
  source: string;
  platform?: string;
}

/**
 * Check if a URL is from a blocked ad domain
 */
export function isBlockedUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return SCANNER_BLOCKED_DOMAINS.some(domain => hostname.includes(domain));
  } catch {
    return false;
  }
}

/**
 * Validate if URL is a stream URL and return type
 * Detects HLS, DASH, and MSE (YouTube, Vimeo, etc.) streams
 */
export function isValidStreamUrl(url: string): 'hls' | 'dash' | 'mse' | null {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    const hostname = urlObj.hostname.toLowerCase();

    // Standard manifest files
    if (pathname.endsWith('.m3u8')) return 'hls';
    if (pathname.endsWith('.mpd')) return 'dash';

    // YouTube video streams (googlevideo.com)
    if (hostname.includes('googlevideo.com') &&
        (pathname.includes('/videoplayback') || url.includes('itag='))) {
      return 'mse';
    }

    // Vimeo CDN
    if ((hostname.includes('vimeocdn.com') || hostname.includes('akamaized.net')) &&
        (pathname.includes('/video/') || pathname.includes('/sep/'))) {
      return 'mse';
    }

    // Twitch (uses HLS under the hood)
    if (hostname.includes('ttvnw.net') || hostname.includes('jtvnw.net')) {
      return 'hls';
    }

    // Netflix
    if (hostname.includes('nflxvideo.net')) {
      return 'mse';
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Detect platform from URL
 */
export function detectPlatform(url: string): string | undefined {
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
 * Extract stream URLs from HTML content using regex
 */
export function extractUrlsFromContent(content: string): string[] {
  const urls: string[] = [];
  const urlPatterns = [
    /https?:\/\/[^\s"'<>\\]+\.m3u8(?:\?[^\s"'<>\\]*)?/gi,
    /https?:\/\/[^\s"'<>\\]+\.mpd(?:\?[^\s"'<>\\]*)?/gi,
  ];

  for (const pattern of urlPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(url => {
        // Clean up the URL - remove trailing quotes and backslashes
        const cleanUrl = url.replace(/[\\'"]+$/g, '');
        if (!urls.includes(cleanUrl)) {
          urls.push(cleanUrl);
        }
      });
    }
  }

  return urls;
}

/**
 * Scan an array of URLs and filter/validate them
 */
export function scanUrls(
  urls: string[],
  filterAds: boolean = true
): ScannedStream[] {
  const streams: ScannedStream[] = [];
  const seenUrls = new Set<string>();

  for (const url of urls) {
    if (seenUrls.has(url)) continue;
    if (filterAds && isBlockedUrl(url)) continue;

    const type = isValidStreamUrl(url);
    if (type) {
      seenUrls.add(url);
      const platform = detectPlatform(url);
      streams.push({ url, type, source: 'scan', platform });
    }
  }

  return streams;
}

/**
 * Full page scanner - to be called from content script
 */
export class PageScanner {
  private filterAds: boolean = true;

  setFilterAds(enabled: boolean): void {
    this.filterAds = enabled;
  }

  /**
   * Scan page content for stream URLs
   */
  scanContent(htmlContent: string): ScannedStream[] {
    const urls = extractUrlsFromContent(htmlContent);
    return scanUrls(urls, this.filterAds);
  }

  /**
   * Process a single URL
   */
  processUrl(url: string, source: string): ScannedStream | null {
    if (this.filterAds && isBlockedUrl(url)) {
      return null;
    }

    const type = isValidStreamUrl(url);
    if (type) {
      const platform = detectPlatform(url);
      return { url, type, source, platform };
    }

    return null;
  }
}

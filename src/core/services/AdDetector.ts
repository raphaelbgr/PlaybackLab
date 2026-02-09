/**
 * AdDetector - Detects video ad requests (VAST/VMAP)
 * SOLID: Single Responsibility - Only detects ad URLs
 */

import type {
  IAdDetector,
  DetectedAd,
  AdDetectionResult,
  AdFormat,
  AdSource,
  AdDetectedCallback,
} from '../interfaces/IAdDetector';

// Ad server domains to detect
const AD_DOMAINS = [
  // Google IMA SDK / DoubleClick / Ad Manager
  'pubads.g.doubleclick.net',
  'securepubads.g.doubleclick.net',
  'imasdk.googleapis.com',
  'googleads.g.doubleclick.net',
  'pagead2.googlesyndication.com',
  'ad.doubleclick.net',
  'googleads4.g.doubleclick.net',

  // FreeWheel
  'fwmrm.net',
  'v.fwmrm.net',
  'adm.fwmrm.net',

  // SpotX
  'search.spotxchange.com',
  'spotx.tv',
  'spotxcdn.com',

  // SpringServe
  'ads.springserve.com',
  'vid.springserve.com',

  // AppNexus/Xandr
  'ib.adnxs.com',
  'prebid.adnxs.com',

  // Other ad servers
  'ads.adaptv.advertising.com',
  'rtr.innovid.com',
  'ads.serving-sys.com',
  'bs.serving-sys.com',
  'tag.1rx.io',
  'sync.1rx.io',
];

// URL patterns for VAST/VMAP
const AD_URL_PATTERNS = [
  /\.vast\.xml/i,
  /\.vmap\.xml/i,
  /[?&]output=vast/i,
  /[?&]output=xml_vast/i,
  /[?&]output=vmap/i,
  /\/vast\?/i,
  /\/vmap\?/i,
  /\/adtag\?/i,
  /\/adpod\?/i,
  /\/ad\/vast/i,
  /\/vast\/\d/i, // /vast/3.0, /vast/4.0 etc.
  /\/gampad\/ads/i, // Google Ad Manager
  /\/ondemand\/vast/i,
];

// Content-Type patterns for VAST/VMAP (reserved for future response-type detection)
const _AD_CONTENT_TYPES = [
  'application/xml',
  'text/xml',
  'application/vnd.google.dfp',
];
void _AD_CONTENT_TYPES;

export class AdDetector implements IAdDetector {
  private callbacks: Set<AdDetectedCallback> = new Set();
  private detectedAds: Map<string, DetectedAd> = new Map();

  /**
   * Check if URL is an ad request
   */
  isAdUrl(url: string): boolean {
    // Check domain
    if (this.matchesAdDomain(url)) {
      return true;
    }

    // Check URL patterns
    if (this.matchesAdPattern(url)) {
      return true;
    }

    return false;
  }

  /**
   * Check if URL hostname matches any ad domain
   */
  private matchesAdDomain(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return AD_DOMAINS.some((domain) => hostname.includes(domain));
    } catch {
      return false;
    }
  }

  /**
   * Check if URL matches any ad pattern
   */
  private matchesAdPattern(url: string): boolean {
    return AD_URL_PATTERNS.some((pattern) => pattern.test(url));
  }

  /**
   * Detect ad format from URL
   */
  detectAdFormat(url: string): AdFormat {
    const lowerUrl = url.toLowerCase();

    if (lowerUrl.includes('vmap') || lowerUrl.includes('output=vmap')) {
      return 'vmap';
    }

    if (
      lowerUrl.includes('vast') ||
      lowerUrl.includes('output=vast') ||
      lowerUrl.includes('output=xml_vast') ||
      lowerUrl.includes('/gampad/ads')
    ) {
      return 'vast';
    }

    // Default to VAST for ad domains (most common)
    if (this.matchesAdDomain(url)) {
      return 'vast';
    }

    return 'unknown';
  }

  /**
   * Detect ad source (IMA, FreeWheel, etc.)
   */
  detectAdSource(url: string): AdSource {
    try {
      const hostname = new URL(url).hostname.toLowerCase();

      // Google IMA / DoubleClick
      if (
        hostname.includes('doubleclick.net') ||
        hostname.includes('googlesyndication.com') ||
        hostname.includes('imasdk.googleapis.com') ||
        hostname.includes('googleads')
      ) {
        return 'ima';
      }

      // FreeWheel
      if (hostname.includes('fwmrm.net')) {
        return 'freewheel';
      }

      // SpotX
      if (hostname.includes('spotx')) {
        return 'spotx';
      }

      // SpringServe
      if (hostname.includes('springserve')) {
        return 'springserve';
      }

      return 'generic';
    } catch {
      return 'generic';
    }
  }

  /**
   * Process a network request and extract ad info
   */
  processRequest(details: chrome.webRequest.WebRequestDetails): AdDetectionResult {
    const { url, tabId, requestId } = details;

    if (!this.isAdUrl(url)) {
      return { detected: false };
    }

    // Create unique key for deduplication
    const adKey = `${tabId}-${url}`;
    if (this.detectedAds.has(adKey)) {
      return {
        detected: true,
        ad: this.detectedAds.get(adKey),
      };
    }

    const format = this.detectAdFormat(url);
    const source = this.detectAdSource(url);

    const ad: DetectedAd = {
      id: `ad-${requestId}-${Date.now()}`,
      url,
      format,
      source,
      detectedAt: Date.now(),
      tabId,
      isLoading: true,
      pods: [],
    };

    this.detectedAds.set(adKey, ad);
    this.notifyCallbacks(ad);

    return { detected: true, ad };
  }

  /**
   * Subscribe to ad detection events
   */
  onAdDetected(callback: AdDetectedCallback): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Notify all subscribers
   */
  private notifyCallbacks(ad: DetectedAd): void {
    for (const callback of this.callbacks) {
      try {
        callback(ad);
      } catch (error) {
        console.error('[AdDetector] Callback error:', error);
      }
    }
  }

  /**
   * Clear detected ads for a tab
   */
  clearForTab(tabId: number): void {
    for (const [key, ad] of this.detectedAds) {
      if (ad.tabId === tabId) {
        this.detectedAds.delete(key);
      }
    }
  }

  /**
   * Get all detected ads for a tab
   */
  getAdsForTab(tabId: number): DetectedAd[] {
    const ads: DetectedAd[] = [];
    for (const ad of this.detectedAds.values()) {
      if (ad.tabId === tabId) {
        ads.push(ad);
      }
    }
    return ads;
  }

  /**
   * Update ad with parsed content
   */
  updateAd(adId: string, tabId: number, update: Partial<DetectedAd>): void {
    for (const [key, ad] of this.detectedAds) {
      if (ad.id === adId && ad.tabId === tabId) {
        this.detectedAds.set(key, { ...ad, ...update });
        break;
      }
    }
  }
}

// Singleton instance
export const adDetector = new AdDetector();

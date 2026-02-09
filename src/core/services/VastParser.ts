/**
 * VastParser - Parses VAST and VMAP XML
 * Uses @dailymotion/vast-client for parsing
 * SOLID: Single Responsibility - Only parses ad manifests
 */

import type {
  IVastParser,
  VastParseResult,
  AdPod,
  ParsedAd,
  AdCreative,
  AdMediaFile,
  TrackingEvent,
  AdPosition,
} from '../interfaces/IAdDetector';

// Type definitions for vast-client library
interface VastClientAd {
  id?: string;
  system?: { value?: string };
  title?: string;
  description?: string;
  advertiser?: { value?: string };
  creatives?: VastClientCreative[];
  impressionURLTemplates?: Array<{ url: string }>;
  errorURLTemplates?: Array<{ url: string }>;
  pricing?: { value: string; model: string; currency: string };
}

interface VastClientCreative {
  id?: string;
  sequence?: number;
  adId?: string;
  type: string;
  duration?: number;
  skipDelay?: number;
  mediaFiles?: VastClientMediaFile[];
  trackingURLTemplates?: Record<string, string[]>;
  videoClickThroughURLTemplate?: { url: string };
  videoClickTrackingURLTemplates?: Array<{ url: string }>;
}

interface VastClientMediaFile {
  fileURL?: string;
  mimeType?: string;
  codec?: string;
  width?: number;
  height?: number;
  bitrate?: number;
  delivery?: string;
  apiFramework?: string;
  fileSize?: number;
}

interface VastClientResponse {
  ads?: VastClientAd[];
  errorURLTemplates?: string[];
  version?: string;
}

export class VastParser implements IVastParser {
  private vastClientModule: typeof import('@dailymotion/vast-client') | null = null;

  /**
   * Lazy load the VAST client to avoid bundling issues
   */
  private async getVastClient() {
    if (!this.vastClientModule) {
      this.vastClientModule = await import('@dailymotion/vast-client');
    }
    return this.vastClientModule;
  }

  /**
   * Check if content is valid VAST/VMAP
   */
  supports(content: string): boolean {
    return (
      content.includes('<VAST') ||
      content.includes('<vmap:VMAP') ||
      content.includes('<VMAP')
    );
  }

  /**
   * Parse VAST/VMAP XML content
   */
  async parse(content: string, baseUrl: string): Promise<VastParseResult> {
    const vastClient = await this.getVastClient();

    // Detect if this is VMAP (playlist of ads) or VAST (single ad/pod)
    if (content.includes('<vmap:VMAP') || content.includes('<VMAP')) {
      return this.parseVmap(content, baseUrl);
    } else {
      return this.parseVast(content, vastClient, baseUrl);
    }
  }

  /**
   * Parse VAST XML content
   */
  private async parseVast(
    content: string,
    vastClient: typeof import('@dailymotion/vast-client'),
    _baseUrl: string
  ): Promise<VastParseResult> {
    try {
      const parser = new vastClient.VASTParser();
      const parsedVast = await parser.parseVAST(content) as unknown as VastClientResponse;

      // Extract version from XML
      const versionMatch = content.match(/<VAST[^>]*version="([^"]+)"/i);
      const vastVersion = versionMatch ? versionMatch[1] : parsedVast.version;

      // Convert parsed VAST to our data structure
      const pods: AdPod[] = [
        {
          id: `pod-${Date.now()}`,
          position: 'unknown', // VAST doesn't specify position
          ads: this.convertVastAds(parsedVast.ads || []),
        },
      ];

      return {
        format: 'vast',
        vastVersion,
        pods,
      };
    } catch (error) {
      console.error('[VastParser] VAST parse error:', error);
      throw new Error(`Failed to parse VAST: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse VMAP XML content
   */
  private async parseVmap(content: string, _baseUrl: string): Promise<VastParseResult> {
    // Extract VMAP version
    const versionMatch = content.match(/<(?:vmap:)?VMAP[^>]*version="([^"]+)"/i);
    const vmapVersion = versionMatch ? versionMatch[1] : '1.0';

    // Parse VMAP manually since vast-client doesn't support VMAP directly
    const pods: AdPod[] = [];

    // Use DOMParser to parse VMAP XML
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/xml');

    // Find all AdBreak elements
    const adBreaks = doc.querySelectorAll('AdBreak, vmap\\:AdBreak');

    for (let i = 0; i < adBreaks.length; i++) {
      const adBreak = adBreaks[i];
      const timeOffset = adBreak.getAttribute('timeOffset') || 'unknown';
      const breakId = adBreak.getAttribute('breakId') || `break-${i}`;

      // Determine position from timeOffset
      const position = this.parseTimeOffset(timeOffset);

      // Get VAST content from AdSource
      const adSource = adBreak.querySelector('AdSource, vmap\\:AdSource');
      const vastData = adSource?.querySelector('VASTAdData, vmap\\:VASTAdData');
      const vastElement = vastData?.querySelector('VAST');

      let ads: ParsedAd[] = [];

      if (vastElement) {
        // Parse inline VAST
        const vastClient = await this.getVastClient();
        const innerParser = new vastClient.VASTParser();
        const innerVast = await innerParser.parseVAST(vastElement.outerHTML) as unknown as VastClientResponse;
        ads = this.convertVastAds(innerVast.ads || []);
      }

      pods.push({
        id: breakId,
        position,
        timeOffsetString: timeOffset,
        timeOffset: this.parseTimeOffsetToSeconds(timeOffset),
        ads,
      });
    }

    return {
      format: 'vmap',
      vmapVersion,
      pods,
    };
  }

  /**
   * Parse timeOffset string to AdPosition
   */
  private parseTimeOffset(timeOffset: string): AdPosition {
    if (timeOffset === 'start' || timeOffset === '0' || timeOffset === '00:00:00') {
      return 'pre-roll';
    }
    if (timeOffset === 'end') {
      return 'post-roll';
    }
    if (timeOffset.includes('%') || timeOffset.includes(':') || !isNaN(parseInt(timeOffset))) {
      return 'mid-roll';
    }
    return 'unknown';
  }

  /**
   * Parse timeOffset string to seconds
   */
  private parseTimeOffsetToSeconds(timeOffset: string): number | undefined {
    if (timeOffset === 'start') return 0;
    if (timeOffset === 'end') return undefined;

    // HH:MM:SS format
    const timeMatch = timeOffset.match(/^(\d+):(\d+):(\d+)$/);
    if (timeMatch) {
      const [, hours, minutes, seconds] = timeMatch;
      return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
    }

    // Percentage format (can't convert without video duration)
    if (timeOffset.includes('%')) {
      return undefined;
    }

    // Plain seconds
    const secs = parseInt(timeOffset);
    if (!isNaN(secs)) {
      return secs;
    }

    return undefined;
  }

  /**
   * Convert VAST client ads to our ParsedAd format
   */
  private convertVastAds(vastAds: VastClientAd[]): ParsedAd[] {
    return vastAds.map((ad, index) => ({
      id: ad.id || `ad-${index}`,
      adSystem: ad.system?.value,
      adTitle: ad.title,
      description: ad.description,
      advertiser: ad.advertiser?.value,
      creatives: this.convertCreatives(ad.creatives || []),
      impressionUrls: (ad.impressionURLTemplates || []).map((t) => t.url),
      errorUrls: (ad.errorURLTemplates || []).map((t) => t.url),
      pricing: ad.pricing,
    }));
  }

  /**
   * Convert VAST client creatives to our AdCreative format
   */
  private convertCreatives(creatives: VastClientCreative[]): AdCreative[] {
    return creatives.map((creative) => ({
      id: creative.id,
      sequence: creative.sequence,
      adId: creative.adId,
      type: this.normalizeCreativeType(creative.type),
      duration: creative.duration,
      skipDelay: creative.skipDelay,
      mediaFiles: this.convertMediaFiles(creative.mediaFiles || []),
      trackingEvents: this.convertTrackingEvents(creative.trackingURLTemplates || {}),
      clickThroughUrl: creative.videoClickThroughURLTemplate?.url,
      clickTrackingUrls: (creative.videoClickTrackingURLTemplates || []).map((t) => t.url),
    }));
  }

  /**
   * Normalize creative type
   */
  private normalizeCreativeType(type: string): 'linear' | 'nonlinear' | 'companion' {
    const normalizedType = type.toLowerCase();
    if (normalizedType === 'linear') return 'linear';
    if (normalizedType === 'nonlinear' || normalizedType === 'nonlinearads') return 'nonlinear';
    if (normalizedType === 'companion' || normalizedType === 'companionads') return 'companion';
    return 'linear'; // Default
  }

  /**
   * Convert VAST client media files to our AdMediaFile format
   */
  private convertMediaFiles(mediaFiles: VastClientMediaFile[]): AdMediaFile[] {
    return mediaFiles.map((mf) => ({
      url: mf.fileURL || '',
      mimeType: mf.mimeType || 'video/mp4',
      codec: mf.codec,
      width: mf.width,
      height: mf.height,
      bitrate: mf.bitrate,
      delivery: mf.delivery === 'streaming' ? 'streaming' : 'progressive',
      apiFramework: mf.apiFramework,
      fileSize: mf.fileSize,
    }));
  }

  /**
   * Convert VAST client tracking events to our TrackingEvent format
   */
  private convertTrackingEvents(
    trackingTemplates: Record<string, string[]>
  ): TrackingEvent[] {
    const events: TrackingEvent[] = [];

    for (const [eventType, urls] of Object.entries(trackingTemplates)) {
      for (const url of urls) {
        events.push({
          type: eventType,
          url,
        });
      }
    }

    return events;
  }
}

// Singleton instance
export const vastParser = new VastParser();

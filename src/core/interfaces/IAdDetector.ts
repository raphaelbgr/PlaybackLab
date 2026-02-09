/**
 * IAdDetector - Interface for ad detection and parsing
 * SOLID: Interface Segregation - Focused interfaces for different concerns
 */

// Ad format types
export type AdFormat = 'vast' | 'vmap' | 'unknown';
export type AdPosition = 'pre-roll' | 'mid-roll' | 'post-roll' | 'unknown';
export type AdSource = 'ima' | 'freewheel' | 'spotx' | 'springserve' | 'generic';

// Tracking event types from VAST spec
export type TrackingEventType =
  | 'creativeView'
  | 'start'
  | 'firstQuartile'
  | 'midpoint'
  | 'thirdQuartile'
  | 'complete'
  | 'mute'
  | 'unmute'
  | 'pause'
  | 'resume'
  | 'rewind'
  | 'skip'
  | 'playerExpand'
  | 'playerCollapse'
  | 'impression'
  | 'clickThrough'
  | 'error'
  | 'close'
  | 'progress'
  | 'acceptInvitation'
  | 'loaded';

// Individual tracking event
export interface TrackingEvent {
  type: TrackingEventType | string;
  url: string;
  offset?: string; // Time offset for progress events
}

// Media file (creative)
export interface AdMediaFile {
  url: string;
  mimeType: string;
  codec?: string;
  width?: number;
  height?: number;
  bitrate?: number;
  delivery: 'progressive' | 'streaming';
  apiFramework?: string; // VPAID, OMID, etc.
  fileSize?: number;
}

// Single Ad Creative
export interface AdCreative {
  id?: string;
  sequence?: number;
  adId?: string;
  type: 'linear' | 'nonlinear' | 'companion';
  duration?: number; // seconds
  skipDelay?: number; // seconds after which skip is allowed (-1 = not skippable)
  mediaFiles: AdMediaFile[];
  trackingEvents: TrackingEvent[];
  clickThroughUrl?: string;
  clickTrackingUrls: string[];
}

// Single Ad (may have multiple creatives)
export interface ParsedAd {
  id: string;
  adSystem?: string;
  adTitle?: string;
  description?: string;
  advertiser?: string;
  creatives: AdCreative[];
  impressionUrls: string[];
  errorUrls: string[];
  pricing?: {
    value: string;
    model: string;
    currency: string;
  };
}

// Ad Pod (sequence of ads)
export interface AdPod {
  id: string;
  position: AdPosition;
  timeOffset?: number; // For VMAP - when to play (seconds)
  timeOffsetString?: string; // Original format (start, end, 00:00:30, 50%)
  ads: ParsedAd[];
}

// Detected Ad Request
export interface DetectedAd {
  id: string;
  url: string;
  format: AdFormat;
  source: AdSource;
  detectedAt: number;
  tabId: number;

  // Request info
  requestHeaders?: Record<string, string>;

  // Parsing status
  isLoading: boolean;
  error?: string;

  // Parsed content
  vastVersion?: string; // VAST 2.0, 3.0, 4.0, 4.1, 4.2
  vmapVersion?: string; // VMAP 1.0, 1.0.1
  pods: AdPod[];

  // Raw XML
  rawXml?: string;

  // Linked stream (if we can determine which stream this ad is for)
  linkedStreamId?: string;
}

// Ad Detection Result
export interface AdDetectionResult {
  detected: boolean;
  ad?: DetectedAd;
  error?: string;
}

// Callback type for ad detection
export type AdDetectedCallback = (ad: DetectedAd) => void;

// Interface for Ad Detector service
export interface IAdDetector {
  /**
   * Check if URL is an ad request
   */
  isAdUrl(url: string): boolean;

  /**
   * Detect ad format from URL
   */
  detectAdFormat(url: string): AdFormat;

  /**
   * Detect ad source (IMA, FreeWheel, etc.)
   */
  detectAdSource(url: string): AdSource;

  /**
   * Process a network request and extract ad info
   */
  processRequest(details: chrome.webRequest.WebRequestDetails): AdDetectionResult;

  /**
   * Subscribe to ad detection events
   */
  onAdDetected(callback: AdDetectedCallback): () => void;

  /**
   * Clear detected ads for a tab
   */
  clearForTab(tabId: number): void;

  /**
   * Get all detected ads for a tab
   */
  getAdsForTab(tabId: number): DetectedAd[];
}

// Parsed VAST/VMAP result
export interface VastParseResult {
  format: AdFormat;
  vastVersion?: string;
  vmapVersion?: string;
  pods: AdPod[];
}

// Interface for VAST/VMAP Parser
export interface IVastParser {
  /**
   * Check if content is valid VAST/VMAP
   */
  supports(content: string): boolean;

  /**
   * Parse VAST/VMAP XML content
   */
  parse(content: string, baseUrl: string): Promise<VastParseResult>;
}

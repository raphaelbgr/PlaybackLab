/**
 * SOLID: Single Responsibility - Only parses manifests
 * SOLID: Open/Closed - Extend with new parsers without modification
 */

export interface VideoVariant {
  bandwidth: number;
  width?: number;
  height?: number;
  codecs?: string;
  url: string;
  frameRate?: number;
}

export interface AudioVariant {
  bandwidth?: number;
  language?: string;
  name?: string;
  codecs?: string;
  url: string;
  channels?: number;
}

export interface SubtitleTrack {
  language?: string;
  name?: string;
  url: string;
  forced?: boolean;
}

export interface DrmInfo {
  type: 'widevine' | 'playready' | 'fairplay' | 'clearkey' | 'unknown';
  keyId?: string;
  licenseUrl?: string;
  pssh?: string;
}

export interface ParsedManifest {
  type: 'hls' | 'dash';
  duration?: number;
  isLive: boolean;
  videoVariants: VideoVariant[];
  audioVariants: AudioVariant[];
  subtitles: SubtitleTrack[];
  drm: DrmInfo[];
  segments: SegmentInfo[];
  raw: string;
}

export interface SegmentInfo {
  url: string;
  duration: number;
  startTime: number;
  index: number;
  byteRange?: { start: number; end: number };
}

export interface IManifestParser {
  /**
   * Check if parser supports this manifest type
   */
  supports(content: string, url: string): boolean;

  /**
   * Parse manifest content
   */
  parse(content: string, baseUrl: string): Promise<ParsedManifest>;

  /**
   * Get parser type identifier
   */
  getType(): 'hls' | 'dash';
}

/**
 * SOLID: Single Responsibility - Only parses manifests
 * SOLID: Open/Closed - Extend with new parsers without modification
 */

export interface VideoVariant {
  bandwidth: number;
  averageBandwidth?: number;  // More accurate than peak bandwidth
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
  // Enhanced audio info
  isMuxed?: boolean;        // true if audio is embedded in video segments (no separate URL)
  isDefault?: boolean;      // true if this is the default audio track
  autoSelect?: boolean;     // true if player should auto-select this track
  sampleRate?: number;      // Audio sample rate in Hz (e.g., 48000)
  groupId?: string;         // Audio group identifier
  characteristics?: string; // Accessibility characteristics (e.g., 'public.accessibility.describes-video')
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
  /**
   * Manifest classification:
   * - 'master': Contains video variants (EXT-X-STREAM-INF with resolution/codecs)
   * - 'media': Contains segments only (media playlist / segment playlist)
   */
  playlistType: 'master' | 'media';
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

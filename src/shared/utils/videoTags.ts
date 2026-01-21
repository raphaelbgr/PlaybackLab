/**
 * Video/Audio Tag Utilities
 *
 * Central utility for parsing codec strings and generating standardized tags
 * for video quality, HDR, codecs, audio formats, resolutions, etc.
 *
 * Features:
 * - Video codec parsing (H.264, HEVC, VP9, AV1)
 * - Audio codec parsing with branded names (Dolby Digital, Dolby Atmos, etc.)
 * - Resolution tags (Full HD, 4K UHD, etc.)
 * - HDR detection (HDR10, Dolby Vision, HLG)
 * - Comprehensive tooltips for all tags
 *
 * Used across the app for consistent badge/tag display.
 */

// ============================================
// Types
// ============================================

export type TagCategory =
  | 'codec'
  | 'quality'
  | 'resolution'
  | 'hdr'
  | 'framerate'
  | 'audio-codec'
  | 'audio-channels'
  | 'feature';

export interface Tag {
  id: string;
  label: string;
  category: TagCategory;
  color: string;
  bgColor: string;
  tooltip: string;
  /** If true, this tag should show rich tooltip component */
  richTooltip?: boolean;
}

export interface VideoCodecInfo {
  codec: string;        // Short name: H.264, HEVC, VP9, AV1
  profile?: string;     // Main, High, Baseline
  level?: string;       // 4.0, 4.1, 5.1
  fullCodec: string;    // Original codec string
}

export interface AudioCodecInfo {
  codec: string;        // Technical name: AAC, AC-3, E-AC-3, Opus
  brandedName: string;  // Marketing name: Dolby Digital, Dolby Digital+
  profile?: string;     // LC, HE-AAC, etc.
  fullCodec: string;    // Original codec string
}

// ============================================
// Tooltip Content Map
// ============================================

/**
 * Comprehensive tooltip content for all tag types.
 * Used by both CSS tooltips (simple) and React Tooltip component (rich).
 */
export const TOOLTIP_MAP = {
  // Video Codecs
  videoCodec: {
    'H.264': {
      title: 'H.264 / AVC',
      description: 'The most widely supported video codec. Works on virtually all devices and browsers.',
      details: 'Also known as AVC (Advanced Video Coding) or MPEG-4 Part 10. Released in 2003.',
      efficiency: 'Baseline - Good compatibility',
      support: 'Universal',
    },
    'HEVC': {
      title: 'H.265 / HEVC',
      description: 'High Efficiency Video Coding. 50% better compression than H.264 at the same quality.',
      details: 'Also known as H.265 or MPEG-H Part 2. Released in 2013.',
      efficiency: '50% more efficient than H.264',
      support: 'Modern devices (2015+)',
    },
    'VP9': {
      title: 'VP9',
      description: "Google's open and royalty-free video codec. The standard for YouTube.",
      details: 'Developed by Google as successor to VP8. Released in 2013.',
      efficiency: 'Similar to HEVC',
      support: 'Chrome, Firefox, Android, YouTube',
    },
    'AV1': {
      title: 'AV1',
      description: 'Next-generation open codec. 30% more efficient than HEVC, completely royalty-free.',
      details: 'Developed by Alliance for Open Media (Google, Netflix, Amazon, etc.). Released in 2018.',
      efficiency: '30% better than HEVC',
      support: 'Growing - Chrome, Firefox, newer devices',
    },
  },

  // HDR Types
  hdr: {
    'HDR10': {
      title: 'HDR10',
      description: 'Open HDR standard with static metadata. The most widely supported HDR format.',
      details: 'Uses PQ (Perceptual Quantizer) transfer function with static metadata for the entire video.',
      colorDepth: '10-bit',
      brightness: 'Up to 1,000 nits typical, 4,000 max',
      metadata: 'Static (whole video)',
    },
    'HDR10+': {
      title: 'HDR10+',
      description: "Samsung's dynamic HDR format with scene-by-scene optimization.",
      details: 'Royalty-free extension of HDR10 with dynamic metadata.',
      colorDepth: '10-bit',
      brightness: 'Up to 4,000 nits',
      metadata: 'Dynamic (per-scene)',
    },
    'Dolby Vision': {
      title: 'Dolby Vision',
      description: 'Premium HDR format with dynamic metadata that optimizes every frame.',
      details: 'Proprietary format by Dolby. Supports dual-layer encoding for backward compatibility.',
      colorDepth: 'Up to 12-bit',
      brightness: 'Up to 10,000 nits',
      metadata: 'Dynamic (per-frame)',
    },
    'HLG': {
      title: 'HLG (Hybrid Log-Gamma)',
      description: 'Broadcast-friendly HDR format that works on both SDR and HDR displays.',
      details: 'Developed by BBC and NHK. No metadata required - backward compatible with SDR.',
      colorDepth: '10-bit',
      brightness: 'Up to 1,000 nits',
      metadata: 'None (backward compatible)',
    },
  },

  // Resolutions
  resolution: {
    '8K UHD': {
      title: '8K Ultra HD',
      description: 'Highest consumer resolution available. 33.2 megapixels.',
      dimensions: '7680 x 4320',
      pixels: '33.2 million',
      aspect: '16:9',
    },
    '4K UHD': {
      title: '4K Ultra HD',
      description: 'Cinema-quality resolution. The standard for premium content.',
      dimensions: '3840 x 2160',
      pixels: '8.3 million',
      aspect: '16:9',
    },
    'Cinema 4K': {
      title: 'DCI 4K (Cinema 4K)',
      description: 'Professional digital cinema standard used in movie theaters.',
      dimensions: '4096 x 2160',
      pixels: '8.8 million',
      aspect: '1.9:1 (17:9)',
    },
    'QHD': {
      title: 'QHD (Quad HD)',
      description: '4x the resolution of 720p. Popular for gaming monitors.',
      dimensions: '2560 x 1440',
      pixels: '3.7 million',
      aspect: '16:9',
    },
    'Full HD': {
      title: 'Full HD (1080p)',
      description: 'The standard for HD content. Perfect balance of quality and bandwidth.',
      dimensions: '1920 x 1080',
      pixels: '2.1 million',
      aspect: '16:9',
    },
    'HD': {
      title: 'HD Ready (720p)',
      description: 'Entry-level high definition. Good for smaller screens and limited bandwidth.',
      dimensions: '1280 x 720',
      pixels: '0.9 million',
      aspect: '16:9',
    },
    'SD': {
      title: 'Standard Definition',
      description: 'Legacy resolution for older content or very limited bandwidth.',
      dimensions: '720 x 480 or lower',
      pixels: '< 0.5 million',
      aspect: 'Varies (4:3 or 16:9)',
    },
  },

  // Frame Rates
  frameRate: {
    '24fps': {
      title: '24 fps',
      description: 'Cinema standard frame rate. Classic film look with natural motion blur.',
      use: 'Movies, cinematic content',
    },
    '25fps': {
      title: '25 fps',
      description: 'PAL broadcast standard used in Europe, Australia, and parts of Asia.',
      use: 'European TV, broadcast',
    },
    '30fps': {
      title: '30 fps',
      description: 'NTSC broadcast standard used in North America and Japan.',
      use: 'American TV, web video',
    },
    '50fps': {
      title: '50 fps',
      description: 'High frame rate PAL. Smoother motion for sports and action.',
      use: 'European sports, live events',
    },
    '60fps': {
      title: '60 fps',
      description: 'Smooth motion ideal for sports, gaming, and action content.',
      use: 'Sports, gaming, action',
    },
    '120fps': {
      title: '120 fps',
      description: 'Ultra-smooth motion. Requires compatible display for full benefit.',
      use: 'High-end gaming, VR, slow-motion',
    },
  },

  // Audio Codecs (with branded names)
  audioCodec: {
    'AAC-LC': {
      title: 'AAC-LC (Low Complexity)',
      brandedName: 'AAC',
      description: 'Standard efficient audio codec. The most common format for streaming.',
      details: 'Part of MPEG-4 standard. Successor to MP3 with better quality at same bitrate.',
      quality: 'Good at 128-256 kbps',
      support: 'Universal',
    },
    'HE-AAC': {
      title: 'HE-AAC (High Efficiency)',
      brandedName: 'AAC+',
      description: 'Enhanced AAC for low bitrate streaming. Great quality at 48-80 kbps.',
      details: 'Uses Spectral Band Replication (SBR) to reconstruct high frequencies.',
      quality: 'Excellent at 48-96 kbps',
      support: 'Most modern devices',
    },
    'HE-AACv2': {
      title: 'HE-AAC v2',
      brandedName: 'eAAC+',
      description: 'Adds Parametric Stereo for ultra-low bitrate streaming (24-48 kbps).',
      details: 'Combines SBR with Parametric Stereo for maximum efficiency.',
      quality: 'Good at 24-48 kbps',
      support: 'Most modern devices',
    },
    'xHE-AAC': {
      title: 'xHE-AAC (Extended HE)',
      brandedName: 'xHE-AAC',
      description: 'Latest AAC variant. Adaptive for variable network conditions.',
      details: 'Combines multiple tools for seamless quality transitions.',
      quality: 'Excellent across all bitrates',
      support: 'iOS 13+, Android 9+',
    },
    'AC-3': {
      title: 'Dolby Digital (AC-3)',
      brandedName: 'Dolby Digital',
      description: 'Classic surround sound codec. Supports up to 5.1 channels.',
      details: 'Developed by Dolby Laboratories. Standard for DVD and broadcast.',
      quality: '384-640 kbps for 5.1',
      support: 'Universal',
    },
    'E-AC-3': {
      title: 'Dolby Digital Plus (E-AC-3)',
      brandedName: 'Dolby Digital+',
      description: 'Enhanced Dolby Digital. Higher quality and supports Dolby Atmos.',
      details: 'Evolution of AC-3 with higher bitrates and more channels.',
      quality: 'Up to 6 Mbps',
      support: 'Most streaming devices',
    },
    'Atmos': {
      title: 'Dolby Atmos',
      brandedName: 'Dolby Atmos',
      description: 'Immersive 3D spatial audio. Sound moves around and above you.',
      details: 'Object-based audio supporting up to 128 simultaneous tracks.',
      quality: 'E-AC-3 JOC extension',
      support: 'Atmos-enabled devices',
    },
    'Opus': {
      title: 'Opus',
      brandedName: 'Opus',
      description: 'Open-source codec with excellent quality at any bitrate.',
      details: 'Developed by Xiph.Org. Combines SILK and CELT codecs.',
      quality: 'Excellent 6-510 kbps',
      support: 'Chrome, Firefox, WebRTC',
    },
    'FLAC': {
      title: 'FLAC',
      brandedName: 'FLAC',
      description: 'Free Lossless Audio Codec. Perfect quality, no compression artifacts.',
      details: 'Open format. Compresses without any quality loss.',
      quality: 'Lossless (bit-perfect)',
      support: 'Most devices',
    },
    'MP3': {
      title: 'MP3',
      brandedName: 'MP3',
      description: 'Legacy compressed audio format with universal compatibility.',
      details: 'MPEG-1 Audio Layer III. Released in 1993.',
      quality: '128-320 kbps typical',
      support: 'Universal',
    },
  },

  // Audio Channels
  channels: {
    'Mono': {
      title: 'Mono',
      description: 'Single audio channel. Same sound in all speakers.',
      layout: '1.0',
      channels: 1,
    },
    'Stereo': {
      title: 'Stereo',
      description: 'Two channels (Left + Right). Standard for music and most content.',
      layout: '2.0',
      channels: 2,
    },
    '5.1': {
      title: '5.1 Surround',
      description: 'Six channels for immersive surround sound experience.',
      layout: 'Front L/C/R, Surround L/R, LFE (subwoofer)',
      channels: 6,
    },
    '7.1': {
      title: '7.1 Surround',
      description: 'Eight channels with additional rear speakers.',
      layout: '5.1 + Rear L/R',
      channels: 8,
    },
    '7.1.4': {
      title: 'Dolby Atmos 7.1.4',
      description: 'Immersive audio with 4 overhead speakers for 3D sound.',
      layout: '7.1 + 4 height speakers',
      channels: 12,
    },
  },

  // Features
  features: {
    'Muxed': {
      title: 'Muxed Audio',
      description: 'Audio is embedded within video segments (not separate files).',
      details: 'Common in HLS/DASH. Audio and video download together.',
    },
    'Spatial': {
      title: 'Spatial Audio',
      description: 'Immersive 3D audio that positions sound in space around you.',
      details: 'Head tracking enabled on supported devices.',
    },
    'Lossless': {
      title: 'Lossless Audio',
      description: 'Audio without any quality loss from compression.',
      details: 'Bit-perfect reproduction of original recording.',
    },
    'Hi-Res': {
      title: 'Hi-Res Audio',
      description: 'Audio quality exceeding CD standard (16-bit/44.1kHz).',
      details: 'Typically 24-bit and/or 96kHz or higher sample rate.',
    },
  },
} as const;

// ============================================
// Color Palette for Tags
// ============================================

export const TAG_COLORS = {
  // Video Codecs
  h264: { color: '#4fc3f7', bg: 'rgba(79, 195, 247, 0.15)' },
  hevc: { color: '#81c784', bg: 'rgba(129, 199, 132, 0.15)' },
  vp9: { color: '#ffb74d', bg: 'rgba(255, 183, 77, 0.15)' },
  av1: { color: '#ba68c8', bg: 'rgba(186, 104, 200, 0.15)' },

  // Quality/Resolution Tiers
  quality8k: { color: '#ff4081', bg: 'rgba(255, 64, 129, 0.15)' },
  quality4k: { color: '#e040fb', bg: 'rgba(224, 64, 251, 0.15)' },
  qualityCinema4k: { color: '#d500f9', bg: 'rgba(213, 0, 249, 0.15)' },
  quality2k: { color: '#7c4dff', bg: 'rgba(124, 77, 255, 0.15)' },
  quality1080: { color: '#448aff', bg: 'rgba(68, 138, 255, 0.15)' },
  quality720: { color: '#69f0ae', bg: 'rgba(105, 240, 174, 0.15)' },
  qualitySD: { color: '#9e9e9e', bg: 'rgba(158, 158, 158, 0.15)' },

  // HDR
  hdr10: { color: '#ffd54f', bg: 'rgba(255, 213, 79, 0.15)' },
  hdr10plus: { color: '#ffab40', bg: 'rgba(255, 171, 64, 0.15)' },
  dolbyVision: { color: '#ff4081', bg: 'rgba(255, 64, 129, 0.15)' },
  hlg: { color: '#40c4ff', bg: 'rgba(64, 196, 255, 0.15)' },

  // Frame Rate
  fps24: { color: '#90a4ae', bg: 'rgba(144, 164, 174, 0.15)' },
  fps30: { color: '#a5d6a7', bg: 'rgba(165, 214, 167, 0.15)' },
  fpsHigh: { color: '#ff6e40', bg: 'rgba(255, 110, 64, 0.15)' },

  // Audio Codecs
  aac: { color: '#4db6ac', bg: 'rgba(77, 182, 172, 0.15)' },
  dolbyDigital: { color: '#78909c', bg: 'rgba(120, 144, 156, 0.15)' },
  dolbyDigitalPlus: { color: '#9575cd', bg: 'rgba(149, 117, 205, 0.15)' },
  dolbyAtmos: { color: '#ffd740', bg: 'rgba(255, 215, 64, 0.2)' },
  opus: { color: '#4dd0e1', bg: 'rgba(77, 208, 225, 0.15)' },
  flac: { color: '#26a69a', bg: 'rgba(38, 166, 154, 0.15)' },
  mp3: { color: '#8d6e63', bg: 'rgba(141, 110, 99, 0.15)' },

  // Audio Channels
  stereo: { color: '#90a4ae', bg: 'rgba(144, 164, 174, 0.15)' },
  surround51: { color: '#ffab91', bg: 'rgba(255, 171, 145, 0.15)' },
  surround71: { color: '#f48fb1', bg: 'rgba(244, 143, 177, 0.15)' },
  atmos: { color: '#ffd740', bg: 'rgba(255, 215, 64, 0.2)' },

  // Features
  muxed: { color: '#a1887f', bg: 'rgba(161, 136, 127, 0.15)' },
  spatial: { color: '#b39ddb', bg: 'rgba(179, 157, 219, 0.15)' },
  lossless: { color: '#80deea', bg: 'rgba(128, 222, 234, 0.15)' },
  hires: { color: '#ffe082', bg: 'rgba(255, 224, 130, 0.15)' },

  // Default
  default: { color: '#90a4ae', bg: 'rgba(144, 164, 174, 0.15)' },
} as const;

// ============================================
// Video Codec Parsing
// ============================================

/**
 * Parse a video codec string into structured info
 * @example parseVideoCodec('avc1.640028') => { codec: 'H.264', profile: 'High', level: '4.0', fullCodec: 'avc1.640028' }
 */
export function parseVideoCodec(codecString: string | undefined): VideoCodecInfo | null {
  if (!codecString) return null;

  const codec = codecString.toLowerCase();

  // H.264/AVC
  if (codec.startsWith('avc1') || codec.startsWith('avc3')) {
    const profile = parseAvcProfile(codec);
    const level = parseAvcLevel(codec);
    return {
      codec: 'H.264',
      profile,
      level,
      fullCodec: codecString,
    };
  }

  // H.265/HEVC
  if (codec.startsWith('hev1') || codec.startsWith('hvc1')) {
    const profile = parseHevcProfile(codec);
    const level = parseHevcLevel(codec);
    return {
      codec: 'HEVC',
      profile,
      level,
      fullCodec: codecString,
    };
  }

  // VP9
  if (codec.startsWith('vp09') || codec.startsWith('vp9')) {
    return {
      codec: 'VP9',
      profile: parseVp9Profile(codec),
      fullCodec: codecString,
    };
  }

  // AV1
  if (codec.startsWith('av01') || codec.startsWith('av1')) {
    return {
      codec: 'AV1',
      profile: parseAv1Profile(codec),
      fullCodec: codecString,
    };
  }

  return {
    codec: codecString.split('.')[0].toUpperCase(),
    fullCodec: codecString,
  };
}

function parseAvcProfile(codec: string): string | undefined {
  const match = codec.match(/avc[13]\.([0-9a-f]{2})/i);
  if (match) {
    const profileIdc = parseInt(match[1], 16);
    switch (profileIdc) {
      case 66: return 'Baseline';
      case 77: return 'Main';
      case 88: return 'Extended';
      case 100: return 'High';
      case 110: return 'High 10';
      case 122: return 'High 4:2:2';
      case 244: return 'High 4:4:4';
      default: return undefined;
    }
  }
  return undefined;
}

function parseAvcLevel(codec: string): string | undefined {
  const match = codec.match(/avc[13]\.[0-9a-f]{4}([0-9a-f]{2})/i);
  if (match) {
    const levelIdc = parseInt(match[1], 16);
    return (levelIdc / 10).toFixed(1);
  }
  return undefined;
}

function parseHevcProfile(codec: string): string | undefined {
  const match = codec.match(/h[ev]c1\.(\d)/i);
  if (match) {
    const profileSpace = parseInt(match[1]);
    switch (profileSpace) {
      case 1: return 'Main';
      case 2: return 'Main 10';
      case 3: return 'Main Still';
      default: return undefined;
    }
  }
  return undefined;
}

function parseHevcLevel(codec: string): string | undefined {
  const match = codec.match(/\.L(\d+)/i);
  if (match) {
    const level = parseInt(match[1]);
    return (level / 30).toFixed(1);
  }
  return undefined;
}

function parseVp9Profile(codec: string): string | undefined {
  const match = codec.match(/vp09\.(\d{2})/);
  if (match) {
    const profile = parseInt(match[1]);
    switch (profile) {
      case 0: return 'Profile 0';
      case 1: return 'Profile 1';
      case 2: return 'Profile 2 (10-bit)';
      case 3: return 'Profile 3 (10-bit)';
      default: return undefined;
    }
  }
  return undefined;
}

function parseAv1Profile(codec: string): string | undefined {
  const match = codec.match(/av01\.(\d)/);
  if (match) {
    const profile = parseInt(match[1]);
    switch (profile) {
      case 0: return 'Main';
      case 1: return 'High';
      case 2: return 'Professional';
      default: return undefined;
    }
  }
  return undefined;
}

// ============================================
// Audio Codec Parsing
// ============================================

/**
 * Parse an audio codec string into structured info with branded names
 * @example parseAudioCodec('mp4a.40.2') => { codec: 'AAC', brandedName: 'AAC-LC', profile: 'LC', fullCodec: 'mp4a.40.2' }
 */
export function parseAudioCodec(codecString: string | undefined): AudioCodecInfo | null {
  if (!codecString) return null;

  const codec = codecString.toLowerCase();

  // AAC variants
  if (codec.startsWith('mp4a.40')) {
    const { profile, brandedName } = parseAacProfile(codec);
    return {
      codec: 'AAC',
      brandedName: brandedName || 'AAC',
      profile,
      fullCodec: codecString,
    };
  }

  // Dolby AC-3 (Dolby Digital)
  if (codec === 'ac-3' || codec.startsWith('ac-3')) {
    return {
      codec: 'AC-3',
      brandedName: 'Dolby Digital',
      fullCodec: codecString,
    };
  }

  // Dolby E-AC-3 (Dolby Digital Plus) - may also be Atmos
  if (codec === 'ec-3' || codec.startsWith('ec-3')) {
    return {
      codec: 'E-AC-3',
      brandedName: 'Dolby Digital+',
      fullCodec: codecString,
    };
  }

  // Opus
  if (codec.startsWith('opus')) {
    return {
      codec: 'Opus',
      brandedName: 'Opus',
      fullCodec: codecString,
    };
  }

  // Vorbis
  if (codec.startsWith('vorbis')) {
    return {
      codec: 'Vorbis',
      brandedName: 'Vorbis',
      fullCodec: codecString,
    };
  }

  // FLAC
  if (codec.startsWith('flac') || codec === 'flac') {
    return {
      codec: 'FLAC',
      brandedName: 'FLAC',
      fullCodec: codecString,
    };
  }

  // MP3
  if (codec.startsWith('mp4a.40.34') || codec === 'mp3') {
    return {
      codec: 'MP3',
      brandedName: 'MP3',
      fullCodec: codecString,
    };
  }

  return {
    codec: codecString.split('.')[0].toUpperCase(),
    brandedName: codecString.split('.')[0].toUpperCase(),
    fullCodec: codecString,
  };
}

function parseAacProfile(codec: string): { profile?: string; brandedName?: string } {
  const match = codec.match(/mp4a\.40\.(\d+)/);
  if (match) {
    const objectType = parseInt(match[1]);
    switch (objectType) {
      case 2: return { profile: 'LC', brandedName: 'AAC-LC' };
      case 5: return { profile: 'HE-AAC', brandedName: 'HE-AAC' };
      case 29: return { profile: 'HE-AAC v2', brandedName: 'HE-AACv2' };
      case 23: return { profile: 'LD', brandedName: 'AAC-LD' };
      case 39: return { profile: 'ELD', brandedName: 'AAC-ELD' };
      case 42: return { profile: 'xHE-AAC', brandedName: 'xHE-AAC' };
      default: return { brandedName: 'AAC' };
    }
  }
  return { brandedName: 'AAC' };
}

/**
 * Extract audio codec from a combined video+audio codec string
 * @example extractAudioFromCodecs('avc1.640028,mp4a.40.2') => { codec: 'AAC', brandedName: 'AAC-LC', ... }
 */
export function extractAudioFromCodecs(codecString: string | undefined): AudioCodecInfo | null {
  if (!codecString) return null;

  // Split by comma and find audio codec
  const codecs = codecString.split(',').map(c => c.trim());

  for (const c of codecs) {
    const lower = c.toLowerCase();
    if (lower.startsWith('mp4a') || lower.startsWith('ac-3') || lower.startsWith('ec-3') ||
        lower.startsWith('opus') || lower.startsWith('flac') || lower.startsWith('vorbis')) {
      return parseAudioCodec(c);
    }
  }

  return null;
}

// ============================================
// Quality Tier Detection
// ============================================

export type QualityTier = '8K' | '4K' | 'Cinema 4K' | '2K' | '1440p' | '1080p' | '720p' | '480p' | '360p' | '240p' | 'SD';

/**
 * Get quality tier label from resolution height
 */
export function getQualityTier(height: number | undefined): QualityTier {
  if (!height) return 'SD';
  if (height >= 4320) return '8K';
  if (height >= 2160) return '4K';
  if (height >= 1440) return '1440p';
  if (height >= 1080) return '1080p';
  if (height >= 720) return '720p';
  if (height >= 480) return '480p';
  if (height >= 360) return '360p';
  if (height >= 240) return '240p';
  return 'SD';
}

/**
 * Get quality tier with marketing name
 */
export function getQualityLabel(height: number | undefined): string {
  if (!height) return 'SD';
  if (height >= 4320) return '8K UHD';
  if (height >= 2160) return '4K UHD';
  if (height >= 1440) return '2K QHD';
  if (height >= 1080) return '1080p Full HD';
  if (height >= 720) return '720p HD';
  if (height >= 480) return '480p SD';
  if (height >= 360) return '360p';
  if (height >= 240) return '240p';
  return 'SD';
}

// ============================================
// Resolution Tag Detection
// ============================================

export type ResolutionTag = '8K UHD' | '4K UHD' | 'Cinema 4K' | 'QHD' | 'Full HD' | 'HD' | 'SD';

/**
 * Get resolution tag based on exact width and height
 */
export function getResolutionName(width: number | undefined, height: number | undefined): ResolutionTag | null {
  if (!width || !height) return null;

  // Check for exact or near-exact matches
  // 8K UHD
  if (width >= 7680 && height >= 4320) return '8K UHD';

  // Cinema 4K (DCI)
  if (width >= 4096 && width < 7680 && height >= 2160) return 'Cinema 4K';

  // 4K UHD
  if (width >= 3840 && height >= 2160) return '4K UHD';

  // QHD / 2K
  if (width >= 2560 && height >= 1440) return 'QHD';

  // Full HD
  if (width >= 1920 && height >= 1080) return 'Full HD';

  // HD
  if (width >= 1280 && height >= 720) return 'HD';

  // SD
  if (height < 720) return 'SD';

  return null;
}

// ============================================
// HDR Detection
// ============================================

export type HdrType = 'HDR10' | 'HDR10+' | 'Dolby Vision' | 'HLG' | 'SDR';

/**
 * Detect HDR type from codec string and attributes
 */
export function detectHdrType(
  codecString: string | undefined,
  transferCharacteristics?: string,
  _colorPrimaries?: string
): HdrType {
  if (!codecString) return 'SDR';

  const codec = codecString.toLowerCase();

  // Dolby Vision detection
  if (codec.includes('dvh') || codec.includes('dvhe') || codec.includes('dva')) {
    return 'Dolby Vision';
  }

  // HDR10+ detection
  if (codec.includes('hdr10+') || codec.includes('hdr10plus')) {
    return 'HDR10+';
  }

  // HEVC Main 10 profiles
  if (codec.includes('hev1.2') || codec.includes('hvc1.2')) {
    if (transferCharacteristics === 'smpte2084' || transferCharacteristics === 'PQ') {
      return 'HDR10';
    }
    if (transferCharacteristics === 'arib-std-b67' || transferCharacteristics === 'HLG') {
      return 'HLG';
    }
    return 'HDR10';
  }

  // VP9 Profile 2 is 10-bit
  if (codec.includes('vp09.02')) {
    return 'HDR10';
  }

  // AV1 with high bit depth
  if (codec.includes('av01') && (codec.includes('.10.') || codec.includes('.12.'))) {
    return 'HDR10';
  }

  return 'SDR';
}

// ============================================
// Aspect Ratio
// ============================================

/**
 * Calculate aspect ratio from dimensions
 */
export function getAspectRatio(width: number | undefined, height: number | undefined): string {
  if (!width || !height) return '—';

  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  const divisor = gcd(width, height);
  const w = width / divisor;
  const h = height / divisor;

  const ratio = width / height;
  if (Math.abs(ratio - 16/9) < 0.02) return '16:9';
  if (Math.abs(ratio - 4/3) < 0.02) return '4:3';
  if (Math.abs(ratio - 21/9) < 0.02) return '21:9';
  if (Math.abs(ratio - 2.35) < 0.05) return '2.35:1';
  if (Math.abs(ratio - 2.39) < 0.05) return '2.39:1';
  if (Math.abs(ratio - 1.85) < 0.05) return '1.85:1';
  if (Math.abs(ratio - 1) < 0.02) return '1:1';

  return `${w}:${h}`;
}

// ============================================
// Tag Generation Functions
// ============================================

/**
 * Generate video codec tag with tooltip
 */
export function getVideoCodecTag(codecString: string | undefined): Tag | null {
  const info = parseVideoCodec(codecString);
  if (!info) return null;

  const colorKey = info.codec === 'H.264' ? 'h264'
    : info.codec === 'HEVC' ? 'hevc'
    : info.codec === 'VP9' ? 'vp9'
    : info.codec === 'AV1' ? 'av1'
    : 'default';

  const colors = TAG_COLORS[colorKey];
  const tooltipData = TOOLTIP_MAP.videoCodec[info.codec as keyof typeof TOOLTIP_MAP.videoCodec];

  const tooltip = tooltipData
    ? `${tooltipData.title}: ${tooltipData.description}`
    : (info.profile ? `${info.codec} ${info.profile}${info.level ? ` Level ${info.level}` : ''}` : info.fullCodec);

  return {
    id: `codec-${info.codec.toLowerCase()}`,
    label: info.codec,
    category: 'codec',
    color: colors.color,
    bgColor: colors.bg,
    tooltip,
    richTooltip: true,
  };
}

/**
 * Generate resolution tag (Full HD, 4K UHD, etc.)
 */
export function getResolutionTag(width: number | undefined, height: number | undefined): Tag | null {
  const resolutionName = getResolutionName(width, height);
  if (!resolutionName) return null;

  const colorKey = resolutionName === '8K UHD' ? 'quality8k'
    : resolutionName === '4K UHD' ? 'quality4k'
    : resolutionName === 'Cinema 4K' ? 'qualityCinema4k'
    : resolutionName === 'QHD' ? 'quality2k'
    : resolutionName === 'Full HD' ? 'quality1080'
    : resolutionName === 'HD' ? 'quality720'
    : 'qualitySD';

  const colors = TAG_COLORS[colorKey];
  const tooltipData = TOOLTIP_MAP.resolution[resolutionName as keyof typeof TOOLTIP_MAP.resolution];

  const tooltip = tooltipData
    ? `${tooltipData.title}: ${tooltipData.description} (${tooltipData.dimensions})`
    : `${resolutionName} - ${width}x${height}`;

  return {
    id: `resolution-${resolutionName.toLowerCase().replace(/\s+/g, '-')}`,
    label: resolutionName,
    category: 'resolution',
    color: colors.color,
    bgColor: colors.bg,
    tooltip,
    richTooltip: true,
  };
}

/**
 * Generate quality tier tag (for backward compatibility)
 */
export function getQualityTag(height: number | undefined): Tag | null {
  if (!height) return null;

  const tier = getQualityTier(height);
  const label = getQualityLabel(height);

  let colorKey: keyof typeof TAG_COLORS = 'qualitySD';
  if (height >= 4320) colorKey = 'quality8k';
  else if (height >= 2160) colorKey = 'quality4k';
  else if (height >= 1440) colorKey = 'quality2k';
  else if (height >= 1080) colorKey = 'quality1080';
  else if (height >= 720) colorKey = 'quality720';

  const colors = TAG_COLORS[colorKey];

  return {
    id: `quality-${tier}`,
    label: tier,
    category: 'quality',
    color: colors.color,
    bgColor: colors.bg,
    tooltip: label,
  };
}

/**
 * Generate HDR tag with tooltip
 */
export function getHdrTag(
  codecString: string | undefined,
  transferCharacteristics?: string
): Tag | null {
  const hdrType = detectHdrType(codecString, transferCharacteristics);
  if (hdrType === 'SDR') return null;

  const colorMap: Record<HdrType, keyof typeof TAG_COLORS> = {
    'HDR10': 'hdr10',
    'HDR10+': 'hdr10plus',
    'Dolby Vision': 'dolbyVision',
    'HLG': 'hlg',
    'SDR': 'default',
  };

  const colors = TAG_COLORS[colorMap[hdrType]];
  const tooltipData = TOOLTIP_MAP.hdr[hdrType as keyof typeof TOOLTIP_MAP.hdr];

  const tooltip = tooltipData
    ? `${tooltipData.title}: ${tooltipData.description}`
    : hdrType;

  return {
    id: `hdr-${hdrType.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
    label: hdrType,
    category: 'hdr',
    color: colors.color,
    bgColor: colors.bg,
    tooltip,
    richTooltip: true,
  };
}

/**
 * Generate frame rate tag with tooltip
 */
export function getFrameRateTag(frameRate: number | undefined): Tag | null {
  if (!frameRate) return null;

  // Only create tags for notable frame rates
  const rounded = Math.round(frameRate);
  let label: string;
  let colorKey: keyof typeof TAG_COLORS;
  let tooltipKey: keyof typeof TOOLTIP_MAP.frameRate | null = null;

  if (rounded >= 120) {
    label = '120fps';
    colorKey = 'fpsHigh';
    tooltipKey = '120fps';
  } else if (rounded >= 60) {
    label = '60fps';
    colorKey = 'fpsHigh';
    tooltipKey = '60fps';
  } else if (rounded >= 50) {
    label = '50fps';
    colorKey = 'fpsHigh';
    tooltipKey = '50fps';
  } else if (rounded === 30 || rounded === 29) {
    label = '30fps';
    colorKey = 'fps30';
    tooltipKey = '30fps';
  } else if (rounded === 25) {
    label = '25fps';
    colorKey = 'fps30';
    tooltipKey = '25fps';
  } else if (rounded === 24 || rounded === 23) {
    label = '24fps';
    colorKey = 'fps24';
    tooltipKey = '24fps';
  } else {
    // Only show tag for frame rates > 30
    if (rounded <= 30) return null;
    label = `${rounded}fps`;
    colorKey = 'fpsHigh';
  }

  const colors = TAG_COLORS[colorKey];
  const tooltipData = tooltipKey ? TOOLTIP_MAP.frameRate[tooltipKey] : null;

  const tooltip = tooltipData
    ? `${tooltipData.title}: ${tooltipData.description}`
    : `${frameRate} frames per second`;

  return {
    id: `fps-${rounded}`,
    label,
    category: 'framerate',
    color: colors.color,
    bgColor: colors.bg,
    tooltip,
    richTooltip: !!tooltipData,
  };
}

/**
 * Generate audio codec tag with branded name and tooltip
 */
export function getAudioCodecTag(codecString: string | undefined, isAtmos?: boolean): Tag | null {
  const info = parseAudioCodec(codecString);
  if (!info) return null;

  // Special case for Dolby Atmos
  if (isAtmos || (info.codec === 'E-AC-3' && isAtmos)) {
    const colors = TAG_COLORS.dolbyAtmos;
    const tooltipData = TOOLTIP_MAP.audioCodec['Atmos'];
    return {
      id: 'audio-dolby-atmos',
      label: 'Dolby Atmos',
      category: 'audio-codec',
      color: colors.color,
      bgColor: colors.bg,
      tooltip: `${tooltipData.title}: ${tooltipData.description}`,
      richTooltip: true,
    };
  }

  // Determine color based on codec
  let colorKey: keyof typeof TAG_COLORS = 'default';
  if (info.codec === 'AAC') colorKey = 'aac';
  else if (info.codec === 'AC-3') colorKey = 'dolbyDigital';
  else if (info.codec === 'E-AC-3') colorKey = 'dolbyDigitalPlus';
  else if (info.codec === 'Opus') colorKey = 'opus';
  else if (info.codec === 'FLAC') colorKey = 'flac';
  else if (info.codec === 'MP3') colorKey = 'mp3';

  const colors = TAG_COLORS[colorKey];

  // Get tooltip from map
  const tooltipKeyMap: Record<string, keyof typeof TOOLTIP_MAP.audioCodec> = {
    'AAC-LC': 'AAC-LC',
    'HE-AAC': 'HE-AAC',
    'HE-AACv2': 'HE-AACv2',
    'xHE-AAC': 'xHE-AAC',
    'AC-3': 'AC-3',
    'E-AC-3': 'E-AC-3',
    'Opus': 'Opus',
    'FLAC': 'FLAC',
    'MP3': 'MP3',
  };

  const tooltipKey = info.brandedName && tooltipKeyMap[info.brandedName]
    ? tooltipKeyMap[info.brandedName]
    : (tooltipKeyMap[info.codec] || null);

  const tooltipData = tooltipKey ? TOOLTIP_MAP.audioCodec[tooltipKey] : null;

  const tooltip = tooltipData
    ? `${tooltipData.title}: ${tooltipData.description}`
    : info.fullCodec;

  return {
    id: `audio-${info.codec.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
    label: info.brandedName,
    category: 'audio-codec',
    color: colors.color,
    bgColor: colors.bg,
    tooltip,
    richTooltip: !!tooltipData,
  };
}

/**
 * Generate audio channels tag with tooltip
 */
export function getAudioChannelsTag(channels: number | undefined, isAtmos?: boolean): Tag | null {
  if (channels === undefined) return null;

  let label: string;
  let colorKey: keyof typeof TAG_COLORS;
  let tooltipKey: keyof typeof TOOLTIP_MAP.channels;

  if (isAtmos || channels >= 12) {
    label = '7.1.4';
    colorKey = 'atmos';
    tooltipKey = '7.1.4';
  } else if (channels === 8) {
    label = '7.1';
    colorKey = 'surround71';
    tooltipKey = '7.1';
  } else if (channels === 6) {
    label = '5.1';
    colorKey = 'surround51';
    tooltipKey = '5.1';
  } else if (channels === 2) {
    label = 'Stereo';
    colorKey = 'stereo';
    tooltipKey = 'Stereo';
  } else if (channels === 1) {
    label = 'Mono';
    colorKey = 'default';
    tooltipKey = 'Mono';
  } else {
    label = `${channels}ch`;
    colorKey = 'default';
    tooltipKey = 'Stereo'; // fallback
  }

  const colors = TAG_COLORS[colorKey];
  const tooltipData = TOOLTIP_MAP.channels[tooltipKey];

  const tooltip = tooltipData
    ? `${tooltipData.title}: ${tooltipData.description}`
    : `${channels} audio channels`;

  return {
    id: `channels-${channels}`,
    label,
    category: 'audio-channels',
    color: colors.color,
    bgColor: colors.bg,
    tooltip,
    richTooltip: true,
  };
}

/**
 * Generate feature tag (Muxed, Spatial, Lossless, Hi-Res)
 */
export function getFeatureTag(feature: 'Muxed' | 'Spatial' | 'Lossless' | 'Hi-Res'): Tag {
  const colorMap: Record<string, keyof typeof TAG_COLORS> = {
    'Muxed': 'muxed',
    'Spatial': 'spatial',
    'Lossless': 'lossless',
    'Hi-Res': 'hires',
  };

  const colors = TAG_COLORS[colorMap[feature] || 'default'];
  const tooltipData = TOOLTIP_MAP.features[feature];

  return {
    id: `feature-${feature.toLowerCase()}`,
    label: feature,
    category: 'feature',
    color: colors.color,
    bgColor: colors.bg,
    tooltip: tooltipData
      ? `${tooltipData.title}: ${tooltipData.description}`
      : feature,
    richTooltip: true,
  };
}

/**
 * Generate muxed audio tag (convenience function)
 */
export function getMuxedAudioTag(hasMuxedAudio: boolean): Tag | null {
  if (!hasMuxedAudio) return null;
  return getFeatureTag('Muxed');
}

// ============================================
// Muxed Audio Info Extraction
// ============================================

export interface MuxedAudioInfo {
  codec: AudioCodecInfo | null;
  codecTag: Tag | null;
  channelsTag: Tag | null;
  estimatedBitrate?: string;
}

/**
 * Extract muxed audio info from video codec string
 */
export function getMuxedAudioInfo(videoCodecString: string | undefined, channels?: number): MuxedAudioInfo {
  const audioCodec = extractAudioFromCodecs(videoCodecString);
  const codecTag = audioCodec ? getAudioCodecTag(audioCodec.fullCodec) : null;
  const channelsTag = getAudioChannelsTag(channels || 2);

  // Estimate bitrate based on codec
  let estimatedBitrate: string | undefined;
  if (audioCodec) {
    switch (audioCodec.codec) {
      case 'AAC':
        estimatedBitrate = audioCodec.profile === 'HE-AAC' ? '~64-96 kbps' : '~128-192 kbps';
        break;
      case 'AC-3':
        estimatedBitrate = '~384-640 kbps';
        break;
      case 'E-AC-3':
        estimatedBitrate = '~256-1024 kbps';
        break;
      case 'Opus':
        estimatedBitrate = '~64-128 kbps';
        break;
    }
  }

  return {
    codec: audioCodec,
    codecTag,
    channelsTag,
    estimatedBitrate,
  };
}

// ============================================
// Batch Tag Generation
// ============================================

export interface VideoVariantTags {
  codec: Tag | null;
  resolution: Tag | null;
  quality: Tag | null;
  hdr: Tag | null;
  frameRate: Tag | null;
  muxedAudio: Tag | null;
  muxedAudioInfo: MuxedAudioInfo | null;
  all: Tag[];
}

/**
 * Generate all relevant tags for a video variant
 */
export function getVideoVariantTags(
  codecString: string | undefined,
  height: number | undefined,
  frameRate: number | undefined,
  width?: number,
  transferCharacteristics?: string
): VideoVariantTags {
  const codec = getVideoCodecTag(codecString);
  const resolution = getResolutionTag(width, height);
  const quality = getQualityTag(height);
  const hdr = getHdrTag(codecString, transferCharacteristics);
  const fps = getFrameRateTag(frameRate);

  // Check for muxed audio in codec string
  const hasMuxedAudio = codecString
    ? /mp4a|ac-3|ec-3|opus/i.test(codecString)
    : false;
  const muxedAudio = getMuxedAudioTag(hasMuxedAudio);
  const muxedAudioInfo = hasMuxedAudio ? getMuxedAudioInfo(codecString) : null;

  const all = [codec, resolution, hdr, fps, muxedAudio].filter((t): t is Tag => t !== null);

  return { codec, resolution, quality, hdr, frameRate: fps, muxedAudio, muxedAudioInfo, all };
}

export interface AudioVariantTags {
  codec: Tag | null;
  channels: Tag | null;
  features: Tag[];
  all: Tag[];
}

/**
 * Generate all relevant tags for an audio variant
 */
export function getAudioVariantTags(
  codecString: string | undefined,
  channels: number | undefined,
  isAtmos?: boolean,
  isLossless?: boolean,
  isHiRes?: boolean
): AudioVariantTags {
  const codec = getAudioCodecTag(codecString, isAtmos);
  const channelsTag = getAudioChannelsTag(channels, isAtmos);

  const features: Tag[] = [];
  if (isAtmos) features.push(getFeatureTag('Spatial'));
  if (isLossless) features.push(getFeatureTag('Lossless'));
  if (isHiRes) features.push(getFeatureTag('Hi-Res'));

  const all = [codec, channelsTag, ...features].filter((t): t is Tag => t !== null);

  return { codec, channels: channelsTag, features, all };
}

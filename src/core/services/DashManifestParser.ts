/**
 * DashManifestParser - Implements IManifestParser for DASH
 * SOLID: Single Responsibility - Only parses DASH manifests
 * SOLID: Liskov Substitution - Can replace any IManifestParser
 */

import { parse as parseMpd } from 'mpd-parser';
import type {
  IManifestParser,
  ParsedManifest,
  VideoVariant,
  AudioVariant,
  SubtitleTrack,
  DrmInfo,
  SegmentInfo,
} from '../interfaces/IManifestParser';

// Helper to convert Uint8Array to base64
function uint8ArrayToBase64(bytes: Uint8Array | undefined): string | undefined {
  if (!bytes) return undefined;
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export class DashManifestParser implements IManifestParser {
  getType(): 'dash' {
    return 'dash';
  }

  supports(content: string, url: string): boolean {
    return content.includes('<MPD') || url.toLowerCase().includes('.mpd');
  }

  async parse(content: string, baseUrl: string): Promise<ParsedManifest> {
    const manifest = parseMpd(content, { manifestUri: baseUrl });

    const videoVariants: VideoVariant[] = [];
    const audioVariants: AudioVariant[] = [];
    const subtitles: SubtitleTrack[] = [];
    const drm: DrmInfo[] = [];
    const segments: SegmentInfo[] = [];

    // Track if video has muxed audio (for detecting muxed audio)
    let videoHasMuxedAudio = false;

    // Process playlists from mpd-parser
    for (const playlist of manifest.playlists || []) {
      const attrs = playlist.attributes || {};

      if (attrs.mimeType?.includes('video') || attrs.CODECS?.includes('avc') || attrs.CODECS?.includes('hev')) {
        videoVariants.push({
          bandwidth: attrs.BANDWIDTH || 0,
          width: attrs.RESOLUTION?.width,
          height: attrs.RESOLUTION?.height,
          codecs: attrs.CODECS,
          url: playlist.uri || '',
          frameRate: attrs.FRAME_RATE,
        });
        // Check if video codec string includes audio codec (muxed)
        if (attrs.CODECS?.includes('mp4a') || attrs.CODECS?.includes('ac-3') || attrs.CODECS?.includes('ec-3')) {
          videoHasMuxedAudio = true;
        }
      } else if (attrs.mimeType?.includes('audio')) {
        audioVariants.push({
          bandwidth: attrs.BANDWIDTH,
          language: attrs.LANGUAGE,
          name: attrs.NAME || attrs.LABEL,
          codecs: attrs.CODECS,
          url: playlist.uri || '',
          // Enhanced fields
          isMuxed: false, // Separate AdaptationSet means not muxed
          isDefault: attrs.DEFAULT === 'true' || attrs.DEFAULT === true,
          sampleRate: attrs.audioSamplingRate ? parseInt(attrs.audioSamplingRate, 10) : undefined,
          channels: attrs.audioChannels ? parseInt(attrs.audioChannels, 10) : undefined,
        });
      }

      // Extract ContentProtection (DRM)
      if (playlist.contentProtection) {
        for (const key in playlist.contentProtection) {
          const protection = playlist.contentProtection[key];
          if (key.includes('edef8ba9-79d6-4ace-a3c8-27dcd51d21ed')) {
            drm.push({
              type: 'widevine',
              pssh: uint8ArrayToBase64(protection.pssh),
              licenseUrl: protection['ms:laurl']?.licenseUrl,
            });
          } else if (key.includes('9a04f079-9840-4286-ab92-e65be0885f95')) {
            drm.push({
              type: 'playready',
              pssh: uint8ArrayToBase64(protection.pssh),
              licenseUrl: protection['ms:laurl']?.licenseUrl,
            });
          }
        }
      }

      // Extract segments
      if (playlist.segments) {
        let startTime = 0;
        for (let i = 0; i < playlist.segments.length; i++) {
          const seg = playlist.segments[i];
          segments.push({
            url: seg.uri || '',
            duration: seg.duration || 0,
            startTime,
            index: i,
          });
          startTime += seg.duration || 0;
        }
      }
    }

    // Process media groups for audio/subtitles
    if (manifest.mediaGroups) {
      const audioGroups = manifest.mediaGroups.AUDIO || {};
      for (const groupId in audioGroups) {
        const group = audioGroups[groupId];
        for (const name in group) {
          const audio = group[name] as any;
          audioVariants.push({
            language: audio.language,
            name: audio.name || name,
            url: audio.uri || '',
            codecs: audio.codecs,
            // Enhanced fields
            isMuxed: !audio.uri,
            isDefault: audio.default === true,
            autoSelect: audio.autoselect === true,
            groupId,
          });
        }
      }

      const subtitleGroups = manifest.mediaGroups.SUBTITLES || {};
      for (const groupId in subtitleGroups) {
        const group = subtitleGroups[groupId];
        for (const name in group) {
          const sub = group[name];
          if (sub.uri) {
            subtitles.push({
              language: sub.language,
              name: sub.name || name,
              url: sub.uri,
              forced: sub.forced,
            });
          }
        }
      }
    }

    // If no audio variants found but video has muxed audio codecs, add a muxed audio entry
    if (audioVariants.length === 0 && videoHasMuxedAudio) {
      audioVariants.push({
        name: 'Default Audio',
        url: '',
        isMuxed: true,
        isDefault: true,
        channels: 2,
      });
    }

    return {
      type: 'dash',
      duration: manifest.duration,
      isLive: manifest.minimumUpdatePeriod !== undefined,
      videoVariants,
      audioVariants,
      subtitles,
      drm,
      segments,
      raw: content,
    };
  }
}

export const dashParser = new DashManifestParser();

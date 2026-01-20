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
      } else if (attrs.mimeType?.includes('audio')) {
        audioVariants.push({
          bandwidth: attrs.BANDWIDTH,
          language: attrs.LANGUAGE,
          name: attrs.NAME,
          codecs: attrs.CODECS,
          url: playlist.uri || '',
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
      const audioGroup = manifest.mediaGroups.AUDIO?.audio || {};
      for (const name in audioGroup) {
        const audio = audioGroup[name];
        if (audio.uri) {
          audioVariants.push({
            language: audio.language,
            name: audio.name || name,
            url: audio.uri,
          });
        }
      }

      const subtitleGroup = manifest.mediaGroups.SUBTITLES?.subs || {};
      for (const name in subtitleGroup) {
        const sub = subtitleGroup[name];
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

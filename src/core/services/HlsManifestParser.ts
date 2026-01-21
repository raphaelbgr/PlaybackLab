/**
 * HlsManifestParser - Implements IManifestParser for HLS
 * SOLID: Single Responsibility - Only parses HLS manifests
 * SOLID: Open/Closed - Can be extended, doesn't need modification
 */

import { Parser } from 'm3u8-parser';
import type {
  IManifestParser,
  ParsedManifest,
  VideoVariant,
  AudioVariant,
  SubtitleTrack,
  DrmInfo,
  SegmentInfo,
} from '../interfaces/IManifestParser';

export class HlsManifestParser implements IManifestParser {
  getType(): 'hls' {
    return 'hls';
  }

  supports(content: string, url: string): boolean {
    return content.includes('#EXTM3U') || url.toLowerCase().includes('.m3u8');
  }

  async parse(content: string, baseUrl: string): Promise<ParsedManifest> {
    const parser = new Parser();
    parser.push(content);
    parser.end();

    const manifest = parser.manifest;
    const baseUrlObj = new URL(baseUrl);

    const resolveUrl = (uri: string): string => {
      if (uri.startsWith('http://') || uri.startsWith('https://')) {
        return uri;
      }
      return new URL(uri, baseUrlObj).toString();
    };

    // Extract video variants
    const videoVariants: VideoVariant[] = (manifest.playlists || []).map((playlist: any) => ({
      bandwidth: playlist.attributes?.BANDWIDTH || 0,
      width: playlist.attributes?.RESOLUTION?.width,
      height: playlist.attributes?.RESOLUTION?.height,
      codecs: playlist.attributes?.CODECS,
      url: resolveUrl(playlist.uri),
      frameRate: playlist.attributes?.['FRAME-RATE'],
    }));

    // Extract audio variants
    const audioVariants: AudioVariant[] = [];
    const audioGroups = manifest.mediaGroups?.AUDIO || {};
    for (const groupId in audioGroups) {
      for (const name in audioGroups[groupId]) {
        const audio = audioGroups[groupId][name] as any;
        // Include both muxed (no URI) and separate (has URI) audio tracks
        const isMuxed = !audio.uri;
        audioVariants.push({
          language: audio.language,
          name: audio.name || name,
          codecs: audio.attributes?.CODECS || audio.codecs,
          url: audio.uri ? resolveUrl(audio.uri) : '',
          channels: audio.channels ? parseInt(audio.channels, 10) : undefined,
          // Enhanced fields
          isMuxed,
          isDefault: audio.default === true || audio.default === 'YES',
          autoSelect: audio.autoselect === true || audio.autoselect === 'YES',
          groupId,
          characteristics: audio.characteristics,
        });
      }
    }

    // If no audio groups found but we have video variants, check if audio might be muxed
    // by looking at video variant codecs (if they include audio codec like mp4a)
    if (audioVariants.length === 0 && videoVariants.length > 0) {
      const hasAudioCodec = videoVariants.some(v =>
        v.codecs?.includes('mp4a') || v.codecs?.includes('ac-3') || v.codecs?.includes('ec-3')
      );
      if (hasAudioCodec) {
        audioVariants.push({
          name: 'Default Audio',
          url: '',
          isMuxed: true,
          isDefault: true,
          channels: 2, // Assume stereo for muxed
        });
      }
    }

    // Extract subtitles
    const subtitles: SubtitleTrack[] = [];
    const subtitleGroups = manifest.mediaGroups?.SUBTITLES || {};
    for (const groupId in subtitleGroups) {
      for (const name in subtitleGroups[groupId]) {
        const sub = subtitleGroups[groupId][name];
        if (sub.uri) {
          subtitles.push({
            language: sub.language,
            name: sub.name || name,
            url: resolveUrl(sub.uri),
            forced: sub.forced === 'YES',
          });
        }
      }
    }

    // Extract DRM info
    const drm: DrmInfo[] = this.extractDrmInfo(manifest);

    // Extract segments (if media playlist)
    const segments: SegmentInfo[] = (manifest.segments || []).map((seg: any, index: number) => ({
      url: resolveUrl(seg.uri),
      duration: seg.duration,
      startTime: seg.start || 0,
      index,
      byteRange: seg.byterange
        ? { start: seg.byterange.offset, end: seg.byterange.offset + seg.byterange.length - 1 }
        : undefined,
    }));

    // Determine if stream is live or VOD
    // VOD indicators: #EXT-X-ENDLIST present, or #EXT-X-PLAYLIST-TYPE:VOD in raw content
    // Live indicators: no endList AND no VOD playlist type
    const hasEndList = manifest.endList === true;
    // m3u8-parser doesn't expose playlistType directly, so check raw content
    const isPlaylistTypeVod = content.includes('#EXT-X-PLAYLIST-TYPE:VOD');
    const totalDuration = manifest.segments?.reduce((acc: number, s: any) => acc + (s.duration || 0), 0);

    // It's VOD if:
    // 1. Has #EXT-X-ENDLIST tag, OR
    // 2. Has #EXT-X-PLAYLIST-TYPE:VOD
    // It's Live if none of these conditions are met
    const isLive = !hasEndList && !isPlaylistTypeVod;

    return {
      type: 'hls',
      duration: totalDuration,
      isLive,
      videoVariants,
      audioVariants,
      subtitles,
      drm,
      segments,
      raw: content,
    };
  }

  private extractDrmInfo(manifest: any): DrmInfo[] {
    const drm: DrmInfo[] = [];

    // Check for EXT-X-KEY tags
    const segments = manifest.segments || [];
    for (const segment of segments) {
      if (segment.key) {
        const keyMethod = segment.key.method;
        if (keyMethod === 'SAMPLE-AES' || keyMethod === 'SAMPLE-AES-CTR') {
          // Check for Widevine/FairPlay
          if (segment.key.keyformat?.includes('urn:uuid:edef8ba9')) {
            drm.push({
              type: 'widevine',
              licenseUrl: segment.key.uri,
            });
          } else if (segment.key.keyformat?.includes('com.apple.streamingkeydelivery')) {
            drm.push({
              type: 'fairplay',
              licenseUrl: segment.key.uri,
            });
          }
        }
      }
    }

    return drm;
  }
}

export const hlsParser = new HlsManifestParser();

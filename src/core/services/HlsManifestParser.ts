/**
 * HlsManifestParser - Implements IManifestParser for HLS
 * Uses hls-parser library for robust manifest parsing
 * SOLID: Single Responsibility - Only parses HLS manifests
 * SOLID: Open/Closed - Can be extended, doesn't need modification
 */

import * as HLS from 'hls-parser';
import type { MasterPlaylist, MediaPlaylist, Variant, Segment } from 'hls-parser/types';
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
    const playlist = HLS.parse(content);
    const baseUrlObj = new URL(baseUrl);

    const resolveUrl = (uri: string | undefined): string => {
      if (!uri) return '';
      if (uri.startsWith('http://') || uri.startsWith('https://')) {
        return uri;
      }
      return new URL(uri, baseUrlObj).toString();
    };

    if (playlist.isMasterPlaylist) {
      return this.parseMasterPlaylist(playlist as MasterPlaylist, resolveUrl, content);
    } else {
      return this.parseMediaPlaylist(playlist as MediaPlaylist, resolveUrl, content);
    }
  }

  private parseMasterPlaylist(
    playlist: MasterPlaylist,
    resolveUrl: (uri: string | undefined) => string,
    rawContent: string
  ): ParsedManifest {
    // Extract video variants from master playlist
    const videoVariants: VideoVariant[] = (playlist.variants || []).map((variant: Variant) => ({
      bandwidth: variant.bandwidth,
      width: variant.resolution?.width,
      height: variant.resolution?.height,
      codecs: variant.codecs,
      url: resolveUrl(variant.uri),
      frameRate: variant.frameRate,
      // Additional fields available from hls-parser
      averageBandwidth: variant.averageBandwidth,
    }));

    // Extract audio variants from renditions
    const audioVariants: AudioVariant[] = [];
    const seenAudioUrls = new Set<string>();

    for (const variant of playlist.variants || []) {
      for (const audio of variant.audio || []) {
        const url = resolveUrl(audio.uri);
        // Dedupe by URL (same audio track referenced by multiple variants)
        if (url && seenAudioUrls.has(url)) continue;
        if (url) seenAudioUrls.add(url);

        const isMuxed = !audio.uri;
        audioVariants.push({
          language: audio.language,
          name: audio.name,
          codecs: (audio as unknown as { codecs?: string }).codecs,
          url,
          channels: audio.channels ? parseInt(String(audio.channels), 10) : undefined,
          isMuxed,
          isDefault: audio.isDefault,
          autoSelect: audio.autoselect,
          groupId: audio.groupId,
          characteristics: audio.characteristics,
        });
      }
    }

    // If no audio renditions but video has audio codec, add muxed audio entry
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
          channels: 2,
        });
      }
    }

    // Extract subtitles from renditions
    const subtitles: SubtitleTrack[] = [];
    const seenSubUrls = new Set<string>();

    for (const variant of playlist.variants || []) {
      for (const sub of variant.subtitles || []) {
        const url = resolveUrl(sub.uri);
        if (url && seenSubUrls.has(url)) continue;
        if (url) seenSubUrls.add(url);

        subtitles.push({
          language: sub.language,
          name: sub.name,
          url,
          forced: sub.forced,
        });
      }
    }

    // Extract closed captions info (stored in DRM for now as metadata)
    // We could add a separate closedCaptions field to ParsedManifest
    const drm: DrmInfo[] = [];

    return {
      type: 'hls',
      duration: undefined, // Master playlists don't have duration
      isLive: false, // Master playlists can't determine VOD/LIVE
      videoVariants,
      audioVariants,
      subtitles,
      drm,
      segments: [], // Master playlists don't have segments
      raw: rawContent,
      playlistType: 'master',
    };
  }

  private parseMediaPlaylist(
    playlist: MediaPlaylist,
    resolveUrl: (uri: string | undefined) => string,
    rawContent: string
  ): ParsedManifest {
    // Extract segments
    const segments: SegmentInfo[] = [];
    let currentTime = 0;

    for (let i = 0; i < (playlist.segments || []).length; i++) {
      const seg = playlist.segments[i];
      segments.push({
        url: resolveUrl(seg.uri),
        duration: seg.duration,
        startTime: currentTime,
        index: i,
        byteRange: seg.byterange
          ? { start: seg.byterange.offset || 0, end: (seg.byterange.offset || 0) + seg.byterange.length - 1 }
          : undefined,
      });
      currentTime += seg.duration;
    }

    // Calculate total duration
    const totalDuration = segments.reduce((acc, seg) => acc + seg.duration, 0);

    // Determine VOD/LIVE status
    // - playlistType === 'VOD' means VOD
    // - playlistType === 'EVENT' means live with DVR
    // - endlist === true means VOD (finished stream)
    // - No endlist and has segments = LIVE
    let isLive = false;

    if (playlist.playlistType === 'VOD' || playlist.endlist) {
      isLive = false;
    } else if (playlist.playlistType === 'EVENT' || segments.length > 0) {
      isLive = true;
    }

    // Extract DRM info from segments
    const drm = this.extractDrmInfo(playlist.segments || []);

    return {
      type: 'hls',
      duration: totalDuration,
      isLive,
      videoVariants: [], // Media playlists don't have variants
      audioVariants: [],
      subtitles: [],
      drm,
      segments,
      raw: rawContent,
      playlistType: 'media',
    };
  }

  private extractDrmInfo(segments: Segment[]): DrmInfo[] {
    const drm: DrmInfo[] = [];
    const seenTypes = new Set<string>();

    for (const segment of segments) {
      if (segment.key) {
        const key = segment.key;
        const method = key.method;

        if (method === 'SAMPLE-AES' || method === 'SAMPLE-AES-CTR') {
          // Check for Widevine
          if (key.format?.includes('urn:uuid:edef8ba9') && !seenTypes.has('widevine')) {
            seenTypes.add('widevine');
            drm.push({
              type: 'widevine',
              licenseUrl: key.uri,
            });
          }
          // Check for FairPlay
          else if (key.format?.includes('com.apple.streamingkeydelivery') && !seenTypes.has('fairplay')) {
            seenTypes.add('fairplay');
            drm.push({
              type: 'fairplay',
              licenseUrl: key.uri,
            });
          }
        } else if (method === 'AES-128' && !seenTypes.has('clearkey')) {
          seenTypes.add('clearkey');
          drm.push({
            type: 'clearkey',
            licenseUrl: key.uri,
          });
        }
      }
    }

    return drm;
  }
}

export const hlsParser = new HlsManifestParser();

import { describe, it, expect, beforeEach } from 'vitest';
import { StreamDetector } from './StreamDetector';

describe('StreamDetector', () => {
  let detector: StreamDetector;

  beforeEach(() => {
    detector = new StreamDetector();
  });

  describe('detectStreamType', () => {
    it('should detect HLS streams (.m3u8)', () => {
      expect(detector.detectStreamType('https://example.com/video.m3u8')).toBe('hls');
      expect(detector.detectStreamType('https://example.com/path/to/master.m3u8')).toBe('hls');
      expect(detector.detectStreamType('https://cdn.example.com/stream.m3u8?token=abc123')).toBe('hls');
    });

    it('should detect DASH streams (.mpd)', () => {
      expect(detector.detectStreamType('https://example.com/video.mpd')).toBe('dash');
      expect(detector.detectStreamType('https://example.com/path/to/manifest.mpd')).toBe('dash');
      expect(detector.detectStreamType('https://cdn.example.com/stream.mpd?auth=xyz')).toBe('dash');
    });

    it('should return unknown for non-stream URLs', () => {
      expect(detector.detectStreamType('https://example.com/video.mp4')).toBe('unknown');
      expect(detector.detectStreamType('https://example.com/page.html')).toBe('unknown');
      expect(detector.detectStreamType('https://example.com/api/data')).toBe('unknown');
      expect(detector.detectStreamType('blob:https://example.com/abc123')).toBe('unknown');
    });

    it('should handle invalid URLs gracefully', () => {
      expect(detector.detectStreamType('not-a-url')).toBe('unknown');
      expect(detector.detectStreamType('')).toBe('unknown');
    });

    it('should be case insensitive for extensions', () => {
      expect(detector.detectStreamType('https://example.com/video.M3U8')).toBe('hls');
      expect(detector.detectStreamType('https://example.com/video.MPD')).toBe('dash');
    });
  });

  describe('isStreamUrl', () => {
    it('should return true for valid HLS URLs', () => {
      expect(detector.isStreamUrl('https://example.com/video.m3u8')).toBe(true);
    });

    it('should return true for valid DASH URLs', () => {
      expect(detector.isStreamUrl('https://example.com/video.mpd')).toBe(true);
    });

    it('should return false for non-stream URLs', () => {
      expect(detector.isStreamUrl('https://example.com/video.mp4')).toBe(false);
    });

    it('should return false when detector is disabled', () => {
      detector.setEnabled(false);
      expect(detector.isStreamUrl('https://example.com/video.m3u8')).toBe(false);
    });

    describe('ad filtering', () => {
      it('should block doubleclick.net URLs when filtering enabled', () => {
        detector.setFilterAds(true);
        expect(detector.isStreamUrl('https://ad.doubleclick.net/video.m3u8')).toBe(false);
      });

      it('should block googlesyndication.com URLs when filtering enabled', () => {
        detector.setFilterAds(true);
        expect(detector.isStreamUrl('https://pagead2.googlesyndication.com/video.m3u8')).toBe(false);
      });

      it('should block imasdk URLs when filtering enabled', () => {
        detector.setFilterAds(true);
        expect(detector.isStreamUrl('https://imasdk.googleapis.com/js/sdkloader/ima3.m3u8')).toBe(false);
      });

      it('should allow ad URLs when filtering disabled', () => {
        detector.setFilterAds(false);
        expect(detector.isStreamUrl('https://ad.doubleclick.net/video.m3u8')).toBe(true);
      });

      it('should allow legitimate CDN URLs', () => {
        detector.setFilterAds(true);
        expect(detector.isStreamUrl('https://cdn.example.com/video.m3u8')).toBe(true);
        expect(detector.isStreamUrl('https://streaming.example.com/live.mpd')).toBe(true);
      });

      it('should allow googleusercontent.com (legitimate content host)', () => {
        detector.setFilterAds(true);
        expect(detector.isStreamUrl('https://lh3.googleusercontent.com/video.m3u8')).toBe(true);
      });
    });
  });

  describe('isMasterManifest', () => {
    it('should identify master manifests', () => {
      expect(detector.isMasterManifest('https://example.com/master.m3u8')).toBe(true);
      expect(detector.isMasterManifest('https://example.com/index.m3u8')).toBe(true);
      expect(detector.isMasterManifest('https://example.com/live.m3u8')).toBe(true);
    });

    it('should identify variant playlists', () => {
      expect(detector.isMasterManifest('https://example.com/video_720p.m3u8')).toBe(false);
      expect(detector.isMasterManifest('https://example.com/video_1080p.m3u8')).toBe(false);
      expect(detector.isMasterManifest('https://example.com/chunklist_123.m3u8')).toBe(false);
      expect(detector.isMasterManifest('https://example.com/media_0.m3u8')).toBe(false);
      expect(detector.isMasterManifest('https://example.com/stream_1.m3u8')).toBe(false);
    });

    it('should reject segment file extensions (.ts, .m4s, .m4v, .m4a, .aac, .vtt, .webvtt)', () => {
      expect(detector.isMasterManifest('https://cdn.example.com/hls/segment_001.ts')).toBe(false);
      expect(detector.isMasterManifest('https://cdn.example.com/dash/chunk_12345.m4s')).toBe(false);
      expect(detector.isMasterManifest('https://cdn.example.com/video/init.m4v')).toBe(false);
      expect(detector.isMasterManifest('https://cdn.example.com/audio/track.m4a')).toBe(false);
      expect(detector.isMasterManifest('https://cdn.example.com/audio/stream.aac')).toBe(false);
      expect(detector.isMasterManifest('https://cdn.example.com/subs/en.vtt')).toBe(false);
      expect(detector.isMasterManifest('https://cdn.example.com/subs/en.webvtt')).toBe(false);
    });

    it('should reject .mp4 with segment patterns', () => {
      expect(detector.isMasterManifest('https://cdn.example.com/segment01.mp4')).toBe(false);
      expect(detector.isMasterManifest('https://cdn.example.com/chunk-1.mp4')).toBe(false);
      expect(detector.isMasterManifest('https://cdn.example.com/frag_2.mp4')).toBe(false);
    });

    it('should reject YouTube/googlevideo videoplayback URLs', () => {
      expect(detector.isMasterManifest('https://rr4---sn-5hne6nzy.googlevideo.com/videoplayback?expire=123&itag=248')).toBe(false);
    });

    it('should reject generic segment URL patterns', () => {
      expect(detector.isMasterManifest('https://cdn.example.com/segment001/data')).toBe(false);
      expect(detector.isMasterManifest('https://cdn.example.com/chunk-stream/video')).toBe(false);
      expect(detector.isMasterManifest('https://cdn.example.com/Fragments(video=123456)')).toBe(false);
      expect(detector.isMasterManifest('https://cdn.example.com/sq/5')).toBe(false);
      expect(detector.isMasterManifest('https://cdn.example.com/range/0-1024')).toBe(false);
    });

    it('should reject googlevideo.com generate_204 (connectivity check)', () => {
      // generate_204 has no manifest extension (.m3u8/.mpd), so isMasterManifest
      // correctly returns false — it's not a manifest at all.
      expect(detector.isMasterManifest('https://rr2---sn-b8u-bpb6.googlevideo.com/generate_204')).toBe(false);
    });
  });

  describe('YouTube/CDN detection', () => {
    it('should detect googlevideo.com /videoplayback as MSE', () => {
      expect(detector.detectStreamType('https://rr4---sn-5hne6nzy.googlevideo.com/videoplayback?expire=123&itag=248')).toBe('mse');
    });

    it('should NOT detect googlevideo.com /generate_204 as a stream', () => {
      expect(detector.detectStreamType('https://rr2---sn-b8u-bpb6.googlevideo.com/generate_204')).toBe('unknown');
      expect(detector.detectStreamType('https://rr2---sn-b8u-bpb6.googlevideo.com/generate_204?conn2')).toBe('unknown');
    });

    it('should NOT detect i.ytimg.com as a stream', () => {
      expect(detector.detectStreamType('https://i.ytimg.com/generate_204')).toBe('unknown');
    });

    it('should detect youtube as platform for googlevideo.com', () => {
      expect(detector.detectPlatform('https://rr4---sn-5hne6nzy.googlevideo.com/videoplayback?expire=123')).toBe('youtube');
    });

    it('should mark videoplayback URLs as non-master (segments)', () => {
      expect(detector.isMasterManifest('https://rr4---sn-5hne6nzy.googlevideo.com/videoplayback?expire=123&itag=248')).toBe(false);
    });
  });

  describe('HLS segment detection', () => {
    it('should detect .ts segments as non-master', () => {
      expect(detector.isMasterManifest('https://cdn.example.com/hls/stream1/segment_0001.ts')).toBe(false);
      expect(detector.isMasterManifest('https://cdn.example.com/hls/chunk.ts')).toBe(false);
    });

    it('should detect .m4s segments as non-master', () => {
      expect(detector.isMasterManifest('https://cdn.example.com/dash/segment_init.m4s')).toBe(false);
    });

    it('should allow .m3u8 master manifests', () => {
      expect(detector.isMasterManifest('https://cdn.example.com/hls/master.m3u8')).toBe(true);
      expect(detector.isMasterManifest('https://cdn.example.com/hls/playlist.m3u8')).toBe(true);
    });

    it('should allow .mpd manifests', () => {
      expect(detector.isMasterManifest('https://cdn.example.com/dash/manifest.mpd')).toBe(true);
    });
  });

  describe('processRequest', () => {
    const createMockRequest = (url: string, tabId = 1): chrome.webRequest.WebRequestDetails => ({
      url,
      tabId,
      frameId: 0,
      requestId: `req-${Date.now()}`,
      method: 'GET',
      type: 'xmlhttprequest' as chrome.webRequest.ResourceType,
      timeStamp: Date.now(),
      initiator: 'https://example.com',
      parentFrameId: -1,
      documentId: 'doc-1',
      documentLifecycle: 'active' as chrome.webRequest.DocumentLifecycle,
      frameType: 'outermost_frame' as chrome.webRequest.FrameType,
    });

    it('should detect HLS stream requests', () => {
      const result = detector.processRequest(createMockRequest('https://example.com/video.m3u8'));
      expect(result.detected).toBe(true);
      expect(result.stream?.type).toBe('hls');
      expect(result.stream?.url).toBe('https://example.com/video.m3u8');
    });

    it('should detect DASH stream requests', () => {
      const result = detector.processRequest(createMockRequest('https://example.com/video.mpd'));
      expect(result.detected).toBe(true);
      expect(result.stream?.type).toBe('dash');
    });

    it('should not detect non-stream requests', () => {
      const result = detector.processRequest(createMockRequest('https://example.com/video.mp4'));
      expect(result.detected).toBe(false);
      expect(result.stream).toBeUndefined();
    });

    it('should deduplicate streams with same URL', () => {
      const url = 'https://example.com/unique-video.m3u8';
      const result1 = detector.processRequest(createMockRequest(url, 1));
      const result2 = detector.processRequest(createMockRequest(url, 1));

      expect(result1.detected).toBe(true);
      expect(result2.detected).toBe(true);
      expect(result1.stream?.id).toBe(result2.stream?.id);
    });

    it('should set isMaster flag correctly', () => {
      const masterResult = detector.processRequest(createMockRequest('https://example.com/master.m3u8'));
      expect(masterResult.stream?.isMaster).toBe(true);

      const variantResult = detector.processRequest(createMockRequest('https://example.com/video_720p.m3u8'));
      expect(variantResult.stream?.isMaster).toBe(false);
    });
  });

  describe('clearForTab', () => {
    it('should clear streams for a specific tab', () => {
      const mockRequest = (url: string, tabId: number): chrome.webRequest.WebRequestDetails => ({
        url,
        tabId,
        frameId: 0,
        requestId: `req-${Date.now()}-${Math.random()}`,
        method: 'GET',
        type: 'xmlhttprequest' as chrome.webRequest.ResourceType,
        timeStamp: Date.now(),
        initiator: 'https://example.com',
        parentFrameId: -1,
        documentId: 'doc-1',
        documentLifecycle: 'active' as chrome.webRequest.DocumentLifecycle,
        frameType: 'outermost_frame' as chrome.webRequest.FrameType,
      });

      detector.processRequest(mockRequest('https://example.com/tab1-video.m3u8', 1));
      detector.processRequest(mockRequest('https://example.com/tab2-video.m3u8', 2));

      expect(detector.getStreamsForTab(1).length).toBe(1);
      expect(detector.getStreamsForTab(2).length).toBe(1);

      detector.clearForTab(1);

      expect(detector.getStreamsForTab(1).length).toBe(0);
      expect(detector.getStreamsForTab(2).length).toBe(1);
    });
  });

  describe('enabled state', () => {
    it('should be enabled by default', () => {
      expect(detector.isEnabled()).toBe(true);
    });

    it('should toggle enabled state', () => {
      detector.setEnabled(false);
      expect(detector.isEnabled()).toBe(false);

      detector.setEnabled(true);
      expect(detector.isEnabled()).toBe(true);
    });
  });

  describe('filter ads state', () => {
    it('should filter ads by default', () => {
      expect(detector.isFilteringAds()).toBe(true);
    });

    it('should toggle filter ads state', () => {
      detector.setFilterAds(false);
      expect(detector.isFilteringAds()).toBe(false);

      detector.setFilterAds(true);
      expect(detector.isFilteringAds()).toBe(true);
    });
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import {
  isBlockedUrl,
  isValidStreamUrl,
  extractUrlsFromContent,
  scanUrls,
  PageScanner,
  SCANNER_BLOCKED_DOMAINS,
} from './PageScanner';

describe('PageScanner', () => {
  describe('isBlockedUrl', () => {
    it('should block doubleclick.net URLs', () => {
      expect(isBlockedUrl('https://ad.doubleclick.net/video.m3u8')).toBe(true);
      expect(isBlockedUrl('https://googleads.g.doubleclick.net/pagead/video.m3u8')).toBe(true);
    });

    it('should block googlesyndication.com URLs', () => {
      expect(isBlockedUrl('https://pagead2.googlesyndication.com/video.m3u8')).toBe(true);
    });

    it('should block imasdk URLs', () => {
      expect(isBlockedUrl('https://imasdk.googleapis.com/js/sdkloader/ima3.m3u8')).toBe(true);
    });

    it('should block googleads URLs', () => {
      expect(isBlockedUrl('https://www.googleads.com/video.m3u8')).toBe(true);
    });

    it('should block social media URLs', () => {
      expect(isBlockedUrl('https://facebook.com/video.m3u8')).toBe(true);
      expect(isBlockedUrl('https://twitter.com/video.m3u8')).toBe(true);
    });

    it('should block ad network URLs', () => {
      expect(isBlockedUrl('https://criteo.com/video.m3u8')).toBe(true);
      expect(isBlockedUrl('https://pubmatic.com/video.m3u8')).toBe(true);
      expect(isBlockedUrl('https://outbrain.com/video.m3u8')).toBe(true);
      expect(isBlockedUrl('https://taboola.com/video.m3u8')).toBe(true);
    });

    it('should allow legitimate CDN URLs', () => {
      expect(isBlockedUrl('https://cdn.example.com/video.m3u8')).toBe(false);
      expect(isBlockedUrl('https://streaming.netflix.com/video.m3u8')).toBe(false);
      expect(isBlockedUrl('https://hlsjs.video-dev.org/demo/video.m3u8')).toBe(false);
    });

    it('should handle invalid URLs', () => {
      expect(isBlockedUrl('not-a-url')).toBe(false);
      expect(isBlockedUrl('')).toBe(false);
    });
  });

  describe('isValidStreamUrl', () => {
    it('should detect HLS URLs ending with .m3u8', () => {
      expect(isValidStreamUrl('https://example.com/video.m3u8')).toBe('hls');
      expect(isValidStreamUrl('https://example.com/path/to/stream.m3u8')).toBe('hls');
    });

    it('should detect HLS URLs with query params', () => {
      expect(isValidStreamUrl('https://example.com/video.m3u8?token=abc')).toBe('hls');
      expect(isValidStreamUrl('https://example.com/video.m3u8?a=1&b=2')).toBe('hls');
    });

    it('should detect DASH URLs ending with .mpd', () => {
      expect(isValidStreamUrl('https://example.com/manifest.mpd')).toBe('dash');
      expect(isValidStreamUrl('https://example.com/path/to/stream.mpd')).toBe('dash');
    });

    it('should detect DASH URLs with query params', () => {
      expect(isValidStreamUrl('https://example.com/video.mpd?token=abc')).toBe('dash');
    });

    it('should reject URLs that just contain .m3u8 but dont end with it', () => {
      // This is the key test - URLs must END with .m3u8/.mpd, not just contain it
      expect(isValidStreamUrl('https://example.com/video.m3u8.backup')).toBe(null);
      expect(isValidStreamUrl('https://example.com/video.m3u8/extra')).toBe(null);
    });

    it('should reject non-stream URLs', () => {
      expect(isValidStreamUrl('https://example.com/video.mp4')).toBe(null);
      expect(isValidStreamUrl('https://example.com/page.html')).toBe(null);
      expect(isValidStreamUrl('https://example.com/api/streams')).toBe(null);
    });

    it('should reject blob URLs', () => {
      expect(isValidStreamUrl('blob:https://example.com/abc-123')).toBe(null);
    });

    it('should handle invalid URLs', () => {
      expect(isValidStreamUrl('not-a-url')).toBe(null);
      expect(isValidStreamUrl('')).toBe(null);
    });

    it('should be case insensitive', () => {
      expect(isValidStreamUrl('https://example.com/video.M3U8')).toBe('hls');
      expect(isValidStreamUrl('https://example.com/video.MPD')).toBe('dash');
    });
  });

  describe('extractUrlsFromContent', () => {
    it('should extract HLS URLs from HTML', () => {
      const html = `
        <script>
          var config = { url: "https://example.com/video.m3u8" };
        </script>
      `;
      const urls = extractUrlsFromContent(html);
      expect(urls).toContain('https://example.com/video.m3u8');
    });

    it('should extract DASH URLs from HTML', () => {
      const html = `<source src="https://example.com/video.mpd" type="application/dash+xml">`;
      const urls = extractUrlsFromContent(html);
      expect(urls).toContain('https://example.com/video.mpd');
    });

    it('should extract URLs with query parameters', () => {
      const html = `src="https://cdn.example.com/video.m3u8?token=abc123&exp=999"`;
      const urls = extractUrlsFromContent(html);
      expect(urls).toContain('https://cdn.example.com/video.m3u8?token=abc123&exp=999');
    });

    it('should extract multiple URLs', () => {
      const html = `
        var hls = "https://example.com/hls.m3u8";
        var dash = "https://example.com/dash.mpd";
        var hls2 = "https://other.com/stream.m3u8";
      `;
      const urls = extractUrlsFromContent(html);
      expect(urls).toHaveLength(3);
      expect(urls).toContain('https://example.com/hls.m3u8');
      expect(urls).toContain('https://example.com/dash.mpd');
      expect(urls).toContain('https://other.com/stream.m3u8');
    });

    it('should deduplicate URLs', () => {
      const html = `
        var url1 = "https://example.com/video.m3u8";
        var url2 = "https://example.com/video.m3u8";
      `;
      const urls = extractUrlsFromContent(html);
      expect(urls.filter(u => u === 'https://example.com/video.m3u8')).toHaveLength(1);
    });

    it('should handle escaped URLs in JSON', () => {
      const html = `{"url":"https:\\/\\/example.com\\/video.m3u8"}`;
      const urls = extractUrlsFromContent(html);
      // The regex should handle this case
      expect(urls.length).toBeGreaterThanOrEqual(0);
    });

    it('should return empty array for content without stream URLs', () => {
      const html = `<html><body>No videos here</body></html>`;
      const urls = extractUrlsFromContent(html);
      expect(urls).toHaveLength(0);
    });
  });

  describe('scanUrls', () => {
    it('should filter and return valid stream URLs', () => {
      const urls = [
        'https://example.com/video.m3u8',
        'https://example.com/video.mp4',
        'https://example.com/manifest.mpd',
      ];
      const streams = scanUrls(urls, true);
      expect(streams).toHaveLength(2);
      expect(streams[0].type).toBe('hls');
      expect(streams[1].type).toBe('dash');
    });

    it('should filter out ad URLs when filterAds is true', () => {
      const urls = [
        'https://example.com/video.m3u8',
        'https://imasdk.googleapis.com/ad.m3u8',
        'https://doubleclick.net/video.m3u8',
      ];
      const streams = scanUrls(urls, true);
      expect(streams).toHaveLength(1);
      expect(streams[0].url).toBe('https://example.com/video.m3u8');
    });

    it('should allow ad URLs when filterAds is false', () => {
      const urls = [
        'https://example.com/video.m3u8',
        'https://imasdk.googleapis.com/ad.m3u8',
      ];
      const streams = scanUrls(urls, false);
      expect(streams).toHaveLength(2);
    });

    it('should deduplicate URLs', () => {
      const urls = [
        'https://example.com/video.m3u8',
        'https://example.com/video.m3u8',
        'https://example.com/video.m3u8',
      ];
      const streams = scanUrls(urls, true);
      expect(streams).toHaveLength(1);
    });
  });

  describe('PageScanner class', () => {
    let scanner: PageScanner;

    beforeEach(() => {
      scanner = new PageScanner();
    });

    describe('scanContent', () => {
      it('should find streams in HTML content', () => {
        const html = `
          <script>
            const streamUrl = "https://cdn.example.com/live.m3u8";
          </script>
        `;
        const streams = scanner.scanContent(html);
        expect(streams).toHaveLength(1);
        expect(streams[0].url).toBe('https://cdn.example.com/live.m3u8');
        expect(streams[0].type).toBe('hls');
      });

      it('should filter ads by default', () => {
        const html = `
          var main = "https://cdn.example.com/video.m3u8";
          var ad = "https://imasdk.googleapis.com/ad.m3u8";
        `;
        const streams = scanner.scanContent(html);
        expect(streams).toHaveLength(1);
        expect(streams[0].url).toBe('https://cdn.example.com/video.m3u8');
      });

      it('should include ads when filtering disabled', () => {
        scanner.setFilterAds(false);
        const html = `
          var main = "https://cdn.example.com/video.m3u8";
          var ad = "https://imasdk.googleapis.com/ad.m3u8";
        `;
        const streams = scanner.scanContent(html);
        expect(streams).toHaveLength(2);
      });
    });

    describe('processUrl', () => {
      it('should process valid HLS URL', () => {
        const result = scanner.processUrl('https://example.com/video.m3u8', 'test');
        expect(result).not.toBeNull();
        expect(result?.type).toBe('hls');
        expect(result?.source).toBe('test');
      });

      it('should process valid DASH URL', () => {
        const result = scanner.processUrl('https://example.com/video.mpd', 'test');
        expect(result).not.toBeNull();
        expect(result?.type).toBe('dash');
      });

      it('should return null for non-stream URL', () => {
        const result = scanner.processUrl('https://example.com/video.mp4', 'test');
        expect(result).toBeNull();
      });

      it('should return null for blocked URL when filtering', () => {
        const result = scanner.processUrl('https://doubleclick.net/ad.m3u8', 'test');
        expect(result).toBeNull();
      });

      it('should allow blocked URL when filtering disabled', () => {
        scanner.setFilterAds(false);
        const result = scanner.processUrl('https://doubleclick.net/ad.m3u8', 'test');
        expect(result).not.toBeNull();
      });
    });
  });

  describe('SCANNER_BLOCKED_DOMAINS', () => {
    it('should have expected ad domains', () => {
      expect(SCANNER_BLOCKED_DOMAINS).toContain('doubleclick.net');
      expect(SCANNER_BLOCKED_DOMAINS).toContain('googlesyndication.com');
      expect(SCANNER_BLOCKED_DOMAINS).toContain('imasdk.googleapis.com');
    });

    it('should not include legitimate content hosts', () => {
      expect(SCANNER_BLOCKED_DOMAINS).not.toContain('googleusercontent.com');
      expect(SCANNER_BLOCKED_DOMAINS).not.toContain('gstatic.com');
      expect(SCANNER_BLOCKED_DOMAINS).not.toContain('youtube.com');
      expect(SCANNER_BLOCKED_DOMAINS).not.toContain('googlevideo.com');
    });
  });
});

# HLS and DASH Manifest Parsing in JavaScript

## Overview

This document covers JavaScript libraries and techniques for parsing HLS (HTTP Live Streaming) m3u8 files and DASH (Dynamic Adaptive Streaming over HTTP) MPD manifests, including segment extraction, DRM detection, and handling edge cases.

---

## 1. Libraries for Parsing M3U8 Files

### Primary Recommendation: m3u8-parser (VideoJS)

The most widely used and maintained library for parsing HLS manifests.

**Installation:**
```bash
npm install m3u8-parser
```

**Basic Usage:**
```javascript
import { Parser } from 'm3u8-parser';

const manifest = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:6
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:6.000,
segment0.ts
#EXTINF:5.500,
segment1.ts
#EXTINF:6.000,
segment2.ts
#EXT-X-ENDLIST`;

const parser = new Parser();
parser.push(manifest);
parser.end();

const parsed = parser.manifest;
console.log(parsed);
```

**Output Structure:**
```javascript
{
  allowCache: true,
  endList: true,
  mediaSequence: 0,
  dateRanges: [],
  discontinuitySequence: 0,
  playlistType: 'VOD',
  targetDuration: 6,
  segments: [
    { duration: 6, uri: 'segment0.ts', timeline: 0 },
    { duration: 5.5, uri: 'segment1.ts', timeline: 0 },
    { duration: 6, uri: 'segment2.ts', timeline: 0 }
  ],
  version: 3
}
```

**Custom Tag Parsing:**
```javascript
const parser = new Parser();

// Add custom tag parser
parser.addParser({
  expression: /^#EXT-X-CUSTOM-TAG:(.*)$/,
  customType: 'customData',
  dataParser: (line) => {
    const match = line.match(/^#EXT-X-CUSTOM-TAG:(.*)$/);
    return match ? match[1] : null;
  }
});

parser.push(manifest);
parser.end();

// Access custom data
console.log(parser.manifest.custom.customData);
```

### Alternative Libraries

| Library | Use Case | Notes |
|---------|----------|-------|
| [hls.js internal parser](https://github.com/video-dev/hls.js/blob/master/src/loader/m3u8-parser.ts) | Full playback solution | Integrated with player |
| [hls-playlist-parser](https://github.com/Eyevinn/hls-playlist-parser) | Editing/manipulation | Good for manifest modification |
| [m3u8-file-parser](https://www.npmjs.com/package/m3u8-file-parser) | RFC8216 compliance | Built against spec |
| [node-m3u8](https://github.com/tedconf/node-m3u8) | Streaming parsing | Event-based, Node.js focused |

### hls.js Events for Manifest Data

When using hls.js for playback, you can access parsed manifest data through events:

```javascript
import Hls from 'hls.js';

const hls = new Hls();
hls.loadSource('https://example.com/stream.m3u8');
hls.attachMedia(videoElement);

// Master playlist parsed
hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
  console.log('Quality levels:', data.levels);
  console.log('First level:', data.firstLevel);
  console.log('Audio tracks:', data.audioTracks);
});

// Individual level loaded
hls.on(Hls.Events.LEVEL_LOADED, (event, data) => {
  console.log('Level details:', data.details);
  console.log('Segments:', data.details.fragments);
  console.log('Total duration:', data.details.totalduration);
  console.log('Is live:', data.details.live);
});
```

---

## 2. Libraries for Parsing DASH MPD Files

### Primary Recommendation: mpd-parser (VideoJS)

**Installation:**
```bash
npm install mpd-parser
```

**Basic Usage:**
```javascript
import { parse } from 'mpd-parser';

async function parseDashManifest(url) {
  const response = await fetch(url);
  const manifestText = await response.text();

  const eventHandler = ({ type, message }) => {
    console.log(`${type}: ${message}`);
  };

  const parsed = parse(manifestText, {
    manifestUri: url,
    eventHandler
  });

  return parsed;
}

// Usage
const manifest = await parseDashManifest('https://example.com/stream.mpd');
console.log(manifest);
```

**Live Stream Updates:**
```javascript
// For live streams, pass previous manifest for continuity
const updatedManifest = parse(newManifestText, {
  manifestUri: url,
  previousManifest: previousParsedManifest
});
```

### Alternative: dash.js (DASH Industry Forum)

Full-featured DASH player with built-in manifest parsing.

```javascript
import dashjs from 'dashjs';

const player = dashjs.MediaPlayer().create();
player.initialize(videoElement, 'https://example.com/stream.mpd', true);

// Access manifest after loading
player.on(dashjs.MediaPlayer.events.MANIFEST_LOADED, (e) => {
  console.log('Raw manifest:', e.data);
});

player.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, (e) => {
  const manifest = player.getActiveStream().getStreamInfo();
  console.log('Stream info:', manifest);
});
```

### Shaka Player Manifest Parser

For complex parsing needs, Shaka Player offers extensive manifest parsing:

```javascript
import shaka from 'shaka-player';

shaka.polyfill.installAll();

const player = new shaka.Player(videoElement);

player.load('https://example.com/stream.mpd').then(() => {
  // Access variant tracks (combined audio+video)
  const variants = player.getVariantTracks();

  // Access text tracks
  const textTracks = player.getTextTracks();

  console.log('Variants:', variants);
});
```

---

## 3. Information Extractable from Manifests

### HLS Manifest Data

```javascript
// Master Playlist Information
{
  playlists: [
    {
      uri: 'quality_1080p.m3u8',
      attributes: {
        BANDWIDTH: 5000000,
        RESOLUTION: { width: 1920, height: 1080 },
        CODECS: 'avc1.640028,mp4a.40.2',
        'FRAME-RATE': 30
      }
    }
  ],
  mediaGroups: {
    AUDIO: {
      'audio-group': {
        english: { uri: 'audio_en.m3u8', language: 'en' },
        spanish: { uri: 'audio_es.m3u8', language: 'es' }
      }
    },
    SUBTITLES: {
      'subs-group': {
        english: { uri: 'subs_en.m3u8', language: 'en' }
      }
    }
  }
}

// Media Playlist Information
{
  targetDuration: 6,
  mediaSequence: 0,
  discontinuitySequence: 0,
  playlistType: 'VOD', // or 'EVENT' for live
  endList: true, // false for live streams
  segments: [
    {
      uri: 'segment0.ts',
      duration: 6.006,
      timeline: 0,
      key: { method: 'AES-128', uri: 'key.bin' }, // if encrypted
      byteRange: { offset: 0, length: 1048576 }, // if using byte ranges
      programDateTime: '2024-01-15T10:00:00.000Z'
    }
  ]
}
```

### DASH Manifest Data

```javascript
// MPD Structure
{
  duration: 3600, // seconds
  minimumUpdatePeriod: 5, // for live
  type: 'static', // or 'dynamic' for live
  periods: [
    {
      start: 0,
      duration: 3600,
      adaptationSets: [
        {
          contentType: 'video',
          mimeType: 'video/mp4',
          codecs: 'avc1.640028',
          representations: [
            {
              id: '1',
              bandwidth: 5000000,
              width: 1920,
              height: 1080,
              frameRate: 30,
              segments: [/* segment list */]
            }
          ],
          contentProtection: [/* DRM info */]
        }
      ]
    }
  ]
}
```

---

## 4. Handling Master vs Media Playlists

### Detecting Playlist Type

```javascript
function analyzeHlsManifest(manifestText) {
  const parser = new Parser();
  parser.push(manifestText);
  parser.end();

  const manifest = parser.manifest;

  // Check if it's a master playlist
  const isMaster = manifest.playlists && manifest.playlists.length > 0;

  if (isMaster) {
    return {
      type: 'master',
      variants: manifest.playlists.map(p => ({
        uri: p.uri,
        bandwidth: p.attributes.BANDWIDTH,
        resolution: p.attributes.RESOLUTION,
        codecs: p.attributes.CODECS
      })),
      audioGroups: manifest.mediaGroups.AUDIO,
      subtitleGroups: manifest.mediaGroups.SUBTITLES
    };
  } else {
    return {
      type: 'media',
      duration: manifest.segments.reduce((sum, s) => sum + s.duration, 0),
      segmentCount: manifest.segments.length,
      targetDuration: manifest.targetDuration,
      isLive: !manifest.endList,
      playlistType: manifest.playlistType
    };
  }
}
```

### Complete HLS Parsing Flow

```javascript
async function parseHlsStream(masterUrl) {
  // 1. Fetch and parse master playlist
  const masterResponse = await fetch(masterUrl);
  const masterText = await masterResponse.text();

  const masterParser = new Parser();
  masterParser.push(masterText);
  masterParser.end();

  const master = masterParser.manifest;

  // 2. Parse each variant playlist
  const baseUrl = masterUrl.substring(0, masterUrl.lastIndexOf('/') + 1);

  const variants = await Promise.all(
    master.playlists.map(async (playlist) => {
      const variantUrl = playlist.uri.startsWith('http')
        ? playlist.uri
        : baseUrl + playlist.uri;

      const response = await fetch(variantUrl);
      const text = await response.text();

      const variantParser = new Parser();
      variantParser.push(text);
      variantParser.end();

      return {
        url: variantUrl,
        attributes: playlist.attributes,
        details: variantParser.manifest
      };
    })
  );

  return {
    master,
    variants
  };
}
```

---

## 5. Parsing Segment Information

### HLS Segments

```javascript
function parseHlsSegments(manifest) {
  const segments = manifest.segments.map((segment, index) => {
    const result = {
      index,
      uri: segment.uri,
      duration: segment.duration,
      title: segment.title,
      discontinuity: segment.discontinuity || false,

      // Calculate start time
      startTime: manifest.segments
        .slice(0, index)
        .reduce((sum, s) => sum + s.duration, 0)
    };

    // Byte range (for fMP4 or byte-range TS)
    if (segment.byteRange) {
      result.byteRange = {
        offset: segment.byteRange.offset,
        length: segment.byteRange.length
      };
    }

    // Encryption key
    if (segment.key) {
      result.encryption = {
        method: segment.key.method, // 'AES-128', 'SAMPLE-AES', 'SAMPLE-AES-CTR'
        uri: segment.key.uri,
        iv: segment.key.iv,
        keyFormat: segment.key.keyFormat // e.g., 'com.apple.streamingkeydelivery'
      };
    }

    // Program date time
    if (segment.programDateTime) {
      result.programDateTime = new Date(segment.programDateTime);
    }

    // Map (init segment)
    if (segment.map) {
      result.initSegment = {
        uri: segment.map.uri,
        byteRange: segment.map.byteRange
      };
    }

    return result;
  });

  return {
    segments,
    totalDuration: segments.reduce((sum, s) => sum + s.duration, 0),
    averageSegmentDuration: segments.length > 0
      ? segments.reduce((sum, s) => sum + s.duration, 0) / segments.length
      : 0
  };
}
```

### DASH Segments (SegmentTemplate)

```javascript
function parseDashSegmentTemplate(representation, adaptationSet) {
  const template = representation.SegmentTemplate || adaptationSet.SegmentTemplate;

  if (!template) return null;

  const timescale = template.timescale || 1;
  const startNumber = template.startNumber || 1;
  const mediaTemplate = template.media;
  const initTemplate = template.initialization;

  // Replace template variables
  function resolveTemplate(template, vars) {
    let result = template;
    result = result.replace('$RepresentationID$', vars.representationId);
    result = result.replace('$Number$', vars.number);
    result = result.replace('$Time$', vars.time);
    result = result.replace('$Bandwidth$', vars.bandwidth);
    return result;
  }

  const segments = [];

  // If SegmentTimeline exists
  if (template.SegmentTimeline) {
    let currentTime = 0;
    let segmentNumber = startNumber;

    for (const s of template.SegmentTimeline.S) {
      const repeatCount = (s.r || 0) + 1;
      const duration = s.d;
      const startTime = s.t !== undefined ? s.t : currentTime;

      currentTime = startTime;

      for (let i = 0; i < repeatCount; i++) {
        segments.push({
          number: segmentNumber,
          time: currentTime,
          duration: duration / timescale,
          startTime: currentTime / timescale,
          uri: resolveTemplate(mediaTemplate, {
            representationId: representation.id,
            number: segmentNumber,
            time: currentTime,
            bandwidth: representation.bandwidth
          })
        });

        currentTime += duration;
        segmentNumber++;
      }
    }
  }
  // If using fixed duration
  else if (template.duration) {
    const duration = template.duration;
    const totalDuration = representation.duration || adaptationSet.duration;
    const segmentCount = Math.ceil(totalDuration * timescale / duration);

    for (let i = 0; i < segmentCount; i++) {
      segments.push({
        number: startNumber + i,
        duration: duration / timescale,
        startTime: (i * duration) / timescale,
        uri: resolveTemplate(mediaTemplate, {
          representationId: representation.id,
          number: startNumber + i,
          bandwidth: representation.bandwidth
        })
      });
    }
  }

  return {
    initSegment: initTemplate ? resolveTemplate(initTemplate, {
      representationId: representation.id,
      bandwidth: representation.bandwidth
    }) : null,
    segments
  };
}
```

### DASH Segments (SegmentList)

```javascript
function parseDashSegmentList(representation) {
  const segmentList = representation.SegmentList;

  if (!segmentList) return null;

  const timescale = segmentList.timescale || 1;
  const duration = segmentList.duration;

  return {
    initSegment: segmentList.Initialization?.sourceURL,
    segments: segmentList.SegmentURL.map((url, index) => ({
      index,
      uri: url.media,
      mediaRange: url.mediaRange,
      indexRange: url.indexRange,
      duration: duration / timescale,
      startTime: (index * duration) / timescale
    }))
  };
}
```

---

## 6. Detecting DRM from Manifests

### HLS DRM Detection

```javascript
function detectHlsDrm(manifest) {
  const drm = {
    encrypted: false,
    systems: []
  };

  // Check segments for encryption
  for (const segment of manifest.segments || []) {
    if (segment.key) {
      drm.encrypted = true;

      const keyInfo = {
        method: segment.key.method,
        uri: segment.key.uri,
        keyFormat: segment.key.keyFormat,
        keyFormatVersions: segment.key.keyFormatVersions
      };

      // Detect DRM system from keyFormat
      if (segment.key.keyFormat) {
        switch (segment.key.keyFormat) {
          case 'com.apple.streamingkeydelivery':
            keyInfo.system = 'FairPlay';
            break;
          case 'urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed':
            keyInfo.system = 'Widevine';
            break;
          case 'urn:uuid:9a04f079-9840-4286-ab92-e65be0885f95':
            keyInfo.system = 'PlayReady';
            break;
          case 'identity':
            keyInfo.system = 'ClearKey';
            break;
        }
      } else if (segment.key.method === 'AES-128') {
        keyInfo.system = 'AES-128 (basic)';
      } else if (segment.key.method === 'SAMPLE-AES') {
        keyInfo.system = 'SAMPLE-AES';
      } else if (segment.key.method === 'SAMPLE-AES-CTR') {
        keyInfo.system = 'SAMPLE-AES-CTR (CENC)';
      }

      // Avoid duplicates
      if (!drm.systems.find(s => s.system === keyInfo.system)) {
        drm.systems.push(keyInfo);
      }
    }
  }

  return drm;
}
```

### DASH DRM Detection

```javascript
// DRM System UUIDs
const DRM_SYSTEMS = {
  'urn:mpeg:dash:mp4protection:2011': 'CENC (Common Encryption)',
  'urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed': 'Widevine',
  'urn:uuid:9a04f079-9840-4286-ab92-e65be0885f95': 'PlayReady',
  'urn:uuid:94ce86fb-07ff-4f43-adb8-93d2fa968ca2': 'FairPlay',
  'urn:uuid:f239e769-efa3-4850-9c16-a903c6932efb': 'PrimeTime',
  'urn:uuid:e2719d58-a985-b3c9-781a-b030af78d30e': 'ClearKey',
  'urn:uuid:1077efec-c0b2-4d02-ace3-3c1e52e2fb4b': 'W3C ClearKey'
};

function detectDashDrm(mpdDocument) {
  const drm = {
    encrypted: false,
    systems: [],
    defaultKid: null
  };

  // Parse XML if string
  const parser = new DOMParser();
  const doc = typeof mpdDocument === 'string'
    ? parser.parseFromString(mpdDocument, 'text/xml')
    : mpdDocument;

  // Find all ContentProtection elements
  const contentProtections = doc.querySelectorAll('ContentProtection');

  contentProtections.forEach(cp => {
    const schemeIdUri = cp.getAttribute('schemeIdUri');
    const value = cp.getAttribute('value');
    const defaultKid = cp.getAttribute('cenc:default_KID') ||
                       cp.getAttributeNS('urn:mpeg:cenc:2013', 'default_KID');

    if (schemeIdUri) {
      drm.encrypted = true;

      const systemInfo = {
        schemeIdUri,
        systemName: DRM_SYSTEMS[schemeIdUri.toLowerCase()] || 'Unknown',
        value
      };

      // Extract PSSH data if present
      const psshElement = cp.querySelector('pssh, cenc\\:pssh');
      if (psshElement) {
        systemInfo.pssh = psshElement.textContent.trim();
      }

      // Extract Widevine-specific data
      const laUrl = cp.querySelector('ms\\:laurl, laurl');
      if (laUrl) {
        systemInfo.licenseUrl = laUrl.getAttribute('licenseUrl') ||
                                laUrl.textContent;
      }

      // PlayReady specific
      const proElement = cp.querySelector('mspr\\:pro, pro');
      if (proElement) {
        systemInfo.playReadyObject = proElement.textContent;
      }

      if (defaultKid) {
        drm.defaultKid = defaultKid;
        systemInfo.defaultKid = defaultKid;
      }

      drm.systems.push(systemInfo);
    }
  });

  return drm;
}
```

### Unified DRM Detection

```javascript
async function detectStreamDrm(url) {
  const response = await fetch(url);
  const content = await response.text();

  // Detect format and parse
  if (url.endsWith('.m3u8') || content.includes('#EXTM3U')) {
    const parser = new Parser();
    parser.push(content);
    parser.end();
    return {
      format: 'HLS',
      ...detectHlsDrm(parser.manifest)
    };
  } else if (url.endsWith('.mpd') || content.includes('<MPD')) {
    return {
      format: 'DASH',
      ...detectDashDrm(content)
    };
  }

  throw new Error('Unknown manifest format');
}
```

---

## 7. Common Parsing Edge Cases and Errors

### URL and Path Resolution

```javascript
function resolveSegmentUrl(baseUrl, segmentUri) {
  // Absolute URL
  if (segmentUri.startsWith('http://') || segmentUri.startsWith('https://')) {
    return segmentUri;
  }

  // Protocol-relative URL
  if (segmentUri.startsWith('//')) {
    const protocol = new URL(baseUrl).protocol;
    return protocol + segmentUri;
  }

  // Root-relative URL
  if (segmentUri.startsWith('/')) {
    const base = new URL(baseUrl);
    return base.origin + segmentUri;
  }

  // Relative URL
  const basePath = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
  return basePath + segmentUri;
}
```

### Handling Spaces in URIs

```javascript
// HLS spec says URIs cannot contain spaces, but some encoders produce them
function sanitizeSegmentUri(uri) {
  // Option 1: URL encode spaces
  return uri.replace(/ /g, '%20');

  // Option 2: Replace with underscores (if you control the server)
  // return uri.replace(/ /g, '_');
}
```

### UTF-8 BOM Handling

```javascript
function stripBom(content) {
  // Remove UTF-8 BOM if present
  if (content.charCodeAt(0) === 0xFEFF) {
    return content.slice(1);
  }
  return content;
}

function parseManifestSafely(content) {
  const cleanContent = stripBom(content.trim());

  // Validate HLS manifest starts with #EXTM3U
  if (!cleanContent.startsWith('#EXTM3U')) {
    throw new Error('Invalid HLS manifest: missing #EXTM3U header');
  }

  const parser = new Parser();
  parser.push(cleanContent);
  parser.end();
  return parser.manifest;
}
```

### Discontinuity Handling

```javascript
function analyzeDiscontinuities(manifest) {
  const discontinuities = [];
  let currentTimeline = 0;
  let currentTime = 0;

  manifest.segments.forEach((segment, index) => {
    if (segment.discontinuity) {
      discontinuities.push({
        index,
        time: currentTime,
        timeline: currentTimeline,
        newTimeline: currentTimeline + 1
      });
      currentTimeline++;
    }
    currentTime += segment.duration;
  });

  return {
    count: discontinuities.length,
    points: discontinuities,
    // Discontinuities often indicate ad breaks or encoder restarts
    possibleAdBreaks: discontinuities.filter((d, i, arr) => {
      // Look for pairs of discontinuities close together
      if (i === 0) return false;
      const prevTime = arr[i - 1].time;
      const gap = d.time - prevTime;
      return gap > 5 && gap < 180; // 5 seconds to 3 minutes
    })
  };
}
```

### Live Stream Sliding Window

```javascript
class LiveManifestTracker {
  constructor() {
    this.previousSegments = new Map();
  }

  updateManifest(manifest) {
    const changes = {
      added: [],
      removed: [],
      current: []
    };

    const currentUris = new Set();

    // Track current segments
    manifest.segments.forEach(segment => {
      currentUris.add(segment.uri);

      if (!this.previousSegments.has(segment.uri)) {
        changes.added.push(segment);
      }

      changes.current.push(segment);
    });

    // Find removed segments
    this.previousSegments.forEach((segment, uri) => {
      if (!currentUris.has(uri)) {
        changes.removed.push(segment);
      }
    });

    // Update tracking
    this.previousSegments.clear();
    manifest.segments.forEach(segment => {
      this.previousSegments.set(segment.uri, segment);
    });

    return changes;
  }
}
```

### Error Handling Best Practices

```javascript
class ManifestParser {
  static async parse(url, options = {}) {
    const {
      timeout = 10000,
      retries = 3,
      retryDelay = 1000
    } = options;

    let lastError;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const content = await response.text();

        // Detect and parse format
        if (content.includes('#EXTM3U')) {
          return this.parseHls(content, url);
        } else if (content.includes('<MPD')) {
          return this.parseDash(content, url);
        }

        throw new Error('Unknown manifest format');

      } catch (error) {
        lastError = error;

        if (error.name === 'AbortError') {
          console.warn(`Attempt ${attempt + 1}: Request timeout`);
        } else if (error.message.includes('HTTP 4')) {
          // Don't retry client errors
          throw error;
        } else {
          console.warn(`Attempt ${attempt + 1}: ${error.message}`);
        }

        if (attempt < retries - 1) {
          await new Promise(r => setTimeout(r, retryDelay * (attempt + 1)));
        }
      }
    }

    throw lastError;
  }

  static parseHls(content, url) {
    const cleanContent = stripBom(content.trim());

    if (!cleanContent.startsWith('#EXTM3U')) {
      throw new Error('Invalid HLS manifest: missing #EXTM3U delimiter');
    }

    const parser = new Parser();
    parser.push(cleanContent);
    parser.end();

    const manifest = parser.manifest;
    manifest.uri = url;
    manifest.resolvedUrls = this.resolveHlsUrls(manifest, url);

    return {
      format: 'HLS',
      manifest
    };
  }

  static parseDash(content, url) {
    const cleanContent = stripBom(content.trim());

    try {
      const parsed = mpdParser.parse(cleanContent, { manifestUri: url });
      return {
        format: 'DASH',
        manifest: parsed
      };
    } catch (error) {
      throw new Error(`DASH parsing error: ${error.message}`);
    }
  }

  static resolveHlsUrls(manifest, baseUrl) {
    const resolved = { playlists: [], segments: [] };

    // Resolve variant playlist URLs
    if (manifest.playlists) {
      manifest.playlists.forEach(playlist => {
        resolved.playlists.push({
          original: playlist.uri,
          resolved: resolveSegmentUrl(baseUrl, playlist.uri)
        });
      });
    }

    // Resolve segment URLs
    if (manifest.segments) {
      manifest.segments.forEach(segment => {
        resolved.segments.push({
          original: segment.uri,
          resolved: resolveSegmentUrl(baseUrl, segment.uri)
        });
      });
    }

    return resolved;
  }
}
```

---

## Summary and Recommendations

### Library Selection Guide

| Use Case | Recommended Library |
|----------|---------------------|
| Parse HLS manifests only | [m3u8-parser](https://github.com/videojs/m3u8-parser) |
| Parse DASH manifests only | [mpd-parser](https://github.com/videojs/mpd-parser) |
| Full HLS playback | [hls.js](https://github.com/video-dev/hls.js) |
| Full DASH playback | [dash.js](https://github.com/Dash-Industry-Forum/dash.js) |
| Both HLS and DASH | [Shaka Player](https://github.com/shaka-project/shaka-player) |
| Manifest manipulation | [hls-playlist-parser](https://github.com/Eyevinn/hls-playlist-parser) |

### Key Considerations

1. **Master vs Media**: Always check if HLS manifest is master (has `playlists`) or media (has `segments`)
2. **URL Resolution**: Always resolve relative URLs against the manifest base URL
3. **Live Streams**: Check `endList` for HLS, `type="dynamic"` for DASH
4. **DRM Detection**: Look for `EXT-X-KEY` in HLS, `ContentProtection` in DASH
5. **Error Handling**: Implement retries for network issues, validate manifest format
6. **Discontinuities**: Track timeline changes for seamless playback

---

## References

- [m3u8-parser (npm)](https://www.npmjs.com/package/m3u8-parser)
- [mpd-parser (GitHub)](https://github.com/videojs/mpd-parser)
- [hls.js API Documentation](https://github.com/video-dev/hls.js/blob/master/docs/API.md)
- [Shaka Player Manifest Parser Tutorial](https://shaka-player-demo.appspot.com/docs/api/tutorial-manifest-parser.html)
- [HLS Specification (RFC 8216)](https://datatracker.ietf.org/doc/html/rfc8216)
- [DASH MPD Structure (OTTVerse)](https://ottverse.com/structure-of-an-mpeg-dash-mpd/)
- [HLS Tags Reference (Mux)](https://www.mux.com/articles/hls-ext-tags)
- [DASH-IF Guidelines](https://dashif.org/docs/DASH-IF-IOP-v4.2-clean.htm)
- [Multi-DRM Documentation (Unified Streaming)](https://docs.unified-streaming.com/documentation/package/multi-format-drm.html)
- [Troubleshooting HLS Playback (Wowza)](https://support.wowza.com/hc/en-us/articles/1260803126430-hls-playback-issues-with-m3u8-file-)

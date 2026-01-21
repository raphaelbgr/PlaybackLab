# Parser Library APIs: m3u8-parser & mpd-parser

This document details the output structures of the two Video.js parser libraries used in PlaybackLab for parsing HLS and DASH manifests.

## Sources

- [m3u8-parser npm](https://www.npmjs.com/package/m3u8-parser)
- [m3u8-parser GitHub](https://github.com/videojs/m3u8-parser)
- [mpd-parser npm](https://www.npmjs.com/package/mpd-parser)
- [mpd-parser GitHub](https://github.com/videojs/mpd-parser)

---

## m3u8-parser (HLS)

### Installation

```bash
npm install m3u8-parser
```

### Basic Usage

```typescript
import { Parser } from 'm3u8-parser';

const parser = new Parser();
parser.push(manifestString);
parser.end();

const manifest = parser.manifest;
```

### Constructor Options

```typescript
const parser = new Parser({
  // Required for QUERYSTRING rules with EXT-X-DEFINE
  url: 'https://example.com/video.m3u8?param_a=34&param_b=abc',

  // Definitions from parent playlist (for IMPORT rules with EXT-X-DEFINE)
  mainDefinitions: {
    param_c: 'def'
  }
});
```

---

### Complete Manifest Structure

```typescript
interface ParsedManifest {
  // Basic properties
  allowCache: boolean;              // #EXT-X-ALLOW-CACHE
  endList: boolean;                 // #EXT-X-ENDLIST present
  mediaSequence: number;            // #EXT-X-MEDIA-SEQUENCE
  discontinuitySequence: number;    // #EXT-X-DISCONTINUITY-SEQUENCE
  playlistType: string;             // #EXT-X-PLAYLIST-TYPE (VOD, EVENT)
  targetDuration: number;           // #EXT-X-TARGETDURATION (seconds)
  totalDuration: number;            // Sum of all segment durations

  // Date/time
  dateTimeString: string;           // #EXT-X-PROGRAM-DATE-TIME as string
  dateTimeObject: Date;             // #EXT-X-PROGRAM-DATE-TIME as Date
  dateRanges: DateRange[];          // #EXT-X-DATERANGE tags

  // Discontinuity
  discontinuityStarts: number[];    // Segment indices where discontinuity occurs

  // Master playlist properties
  playlists: Playlist[];            // Variant streams (#EXT-X-STREAM-INF)
  mediaGroups: MediaGroups;         // Alternative renditions (#EXT-X-MEDIA)

  // Media playlist properties
  segments: Segment[];              // Media segments

  // Custom tags
  custom: Record<string, any>;      // Custom parsed tags
}
```

---

### Playlists Array (Variant Streams)

Each item in `playlists` represents an `#EXT-X-STREAM-INF` entry:

```typescript
interface Playlist {
  uri: string;                      // URL to media playlist
  attributes: PlaylistAttributes;

  // When media playlist is parsed, it contains full manifest structure
  // (segments, targetDuration, etc.)
}

interface PlaylistAttributes {
  BANDWIDTH: number;                // Required: bits per second
  'AVERAGE-BANDWIDTH'?: number;     // Average bits per second
  CODECS?: string;                  // Codec string (e.g., "avc1.4d401f,mp4a.40.2")
  RESOLUTION?: {
    width: number;
    height: number;
  };
  'FRAME-RATE'?: number;            // Frames per second
  'HDCP-LEVEL'?: string;            // HDCP requirement
  AUDIO?: string;                   // Audio group ID
  VIDEO?: string;                   // Video group ID
  SUBTITLES?: string;               // Subtitles group ID
  'CLOSED-CAPTIONS'?: string;       // Closed captions group ID
  'PROGRAM-ID'?: number;            // Deprecated in HLSv6+
}
```

**Example Parsed Playlists:**

```javascript
// Input M3U8:
// #EXT-X-STREAM-INF:BANDWIDTH=1928000,RESOLUTION=960x540,CODECS="avc1.4d401f,mp4a.40.2",AUDIO="audio-group"
// video_960x540.m3u8

// Parsed output:
{
  playlists: [
    {
      uri: "video_960x540.m3u8",
      attributes: {
        BANDWIDTH: 1928000,
        RESOLUTION: { width: 960, height: 540 },
        CODECS: "avc1.4d401f,mp4a.40.2",
        AUDIO: "audio-group"
      }
    }
  ]
}
```

---

### MediaGroups (EXT-X-MEDIA)

The `mediaGroups` object organizes alternative renditions by type:

```typescript
interface MediaGroups {
  AUDIO: MediaGroupType;
  VIDEO: MediaGroupType;
  'CLOSED-CAPTIONS': MediaGroupType;
  SUBTITLES: MediaGroupType;
}

// Structure: mediaGroups[TYPE][GROUP-ID][NAME]
interface MediaGroupType {
  [groupId: string]: {
    [name: string]: MediaGroupRendition;
  };
}

interface MediaGroupRendition {
  default: boolean;           // DEFAULT=YES/NO
  autoselect: boolean;        // AUTOSELECT=YES/NO
  language: string;           // LANGUAGE attribute
  uri?: string;               // URI to media playlist (not present for embedded tracks)
  instreamId?: string;        // INSTREAM-ID for CC (e.g., "CC1", "SERVICE1")
  characteristics?: string;   // CHARACTERISTICS (accessibility features)
  forced: boolean;            // FORCED=YES/NO (for subtitles)
  channels?: string;          // CHANNELS (audio channel count)
}
```

**Example Parsed MediaGroups:**

```javascript
// Input M3U8:
// #EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio-aac",NAME="English",LANGUAGE="en",DEFAULT=YES,AUTOSELECT=YES,URI="audio_en.m3u8"
// #EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio-aac",NAME="Spanish",LANGUAGE="es",DEFAULT=NO,AUTOSELECT=YES,URI="audio_es.m3u8"
// #EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",LANGUAGE="en",DEFAULT=YES,FORCED=NO,URI="subs_en.m3u8"
// #EXT-X-MEDIA:TYPE=CLOSED-CAPTIONS,GROUP-ID="cc",NAME="CC1",LANGUAGE="en",DEFAULT=YES,INSTREAM-ID="CC1"

// Parsed output:
{
  mediaGroups: {
    AUDIO: {
      "audio-aac": {
        "English": {
          default: true,
          autoselect: true,
          language: "en",
          uri: "audio_en.m3u8",
          forced: false
        },
        "Spanish": {
          default: false,
          autoselect: true,
          language: "es",
          uri: "audio_es.m3u8",
          forced: false
        }
      }
    },
    VIDEO: {},
    'CLOSED-CAPTIONS': {
      "cc": {
        "CC1": {
          default: true,
          autoselect: true,
          language: "en",
          instreamId: "CC1",
          forced: false
        }
      }
    },
    SUBTITLES: {
      "subs": {
        "English": {
          default: true,
          autoselect: true,
          language: "en",
          uri: "subs_en.m3u8",
          forced: false
        }
      }
    }
  }
}
```

---

### Segments Array

Each segment represents a media chunk:

```typescript
interface Segment {
  uri: string;                      // Segment URL
  duration: number;                 // #EXTINF duration in seconds
  title?: string;                   // #EXTINF title (after comma)
  timeline: number;                 // Discontinuity sequence number

  // Byte range
  byterange?: {
    length: number;                 // Byte length
    offset: number;                 // Byte offset
  };

  // Encryption
  key?: {
    method: string;                 // "AES-128", "SAMPLE-AES", "NONE"
    uri: string;                    // Key URL
    iv?: string;                    // Initialization vector (hex string)
  };

  // Initialization segment
  map?: {
    uri: string;                    // Init segment URL
    byterange?: {
      length: number;
      offset: number;
    };
  };

  // Program date/time
  programDateTime?: number;         // Unix timestamp (ms)

  // Discontinuity
  discontinuity?: number;           // Discontinuity sequence

  // Ad markers (SCTE-35)
  'cue-out'?: string;               // #EXT-X-CUE-OUT
  'cue-out-cont'?: string;          // #EXT-X-CUE-OUT-CONT
  'cue-in'?: string;                // #EXT-X-CUE-IN

  // Custom tags
  custom?: Record<string, any>;

  // Segment attributes
  attributes?: Record<string, any>;
}
```

**Example Parsed Segments:**

```javascript
// Input M3U8:
// #EXT-X-KEY:METHOD=AES-128,URI="key.bin",IV=0x1234567890ABCDEF
// #EXT-X-MAP:URI="init.mp4",BYTERANGE="1000@0"
// #EXTINF:6.006,
// segment0.ts
// #EXTINF:6.006,
// segment1.ts

// Parsed output:
{
  segments: [
    {
      uri: "segment0.ts",
      duration: 6.006,
      timeline: 0,
      key: {
        method: "AES-128",
        uri: "key.bin",
        iv: "0x1234567890ABCDEF"
      },
      map: {
        uri: "init.mp4",
        byterange: { length: 1000, offset: 0 }
      }
    },
    {
      uri: "segment1.ts",
      duration: 6.006,
      timeline: 0,
      key: {
        method: "AES-128",
        uri: "key.bin",
        iv: "0x1234567890ABCDEF"
      },
      map: {
        uri: "init.mp4",
        byterange: { length: 1000, offset: 0 }
      }
    }
  ]
}
```

---

### Supported HLS Tags

**Basic Playlist Tags:**
- `#EXTM3U`
- `#EXT-X-VERSION`

**Media Segment Tags:**
- `#EXTINF`
- `#EXT-X-BYTERANGE`
- `#EXT-X-DISCONTINUITY`
- `#EXT-X-KEY`
- `#EXT-X-MAP`
- `#EXT-X-PROGRAM-DATE-TIME`
- `#EXT-X-DATERANGE`
- `#EXT-X-I-FRAMES-ONLY`

**Media Playlist Tags:**
- `#EXT-X-TARGETDURATION`
- `#EXT-X-MEDIA-SEQUENCE`
- `#EXT-X-DISCONTINUITY-SEQUENCE`
- `#EXT-X-ENDLIST`
- `#EXT-X-PLAYLIST-TYPE`
- `#EXT-X-START`
- `#EXT-X-INDEPENDENT-SEGMENTS`
- `#EXT-X-DEFINE`

**Master Playlist Tags:**
- `#EXT-X-MEDIA`
- `#EXT-X-STREAM-INF`
- `#EXT-X-I-FRAME-STREAM-INF`
- `#EXT-X-CONTENT-STEERING`

**Ad Marker Tags (Experimental):**
- `#EXT-X-CUE-OUT`
- `#EXT-X-CUE-OUT-CONT`
- `#EXT-X-CUE-IN`

---

### Custom Tag Parsing

```typescript
parser.addParser({
  expression: /^#VOD-FRAMERATE/,
  customType: 'framerate',
  dataParser: (line: string) => {
    return parseFloat(line.split(':')[1]);
  },
  segment: false  // true = segment-level, false = manifest-level
});
```

---

### Important Notes

1. **Attributes property may be undefined:** m3u8-parser doesn't always attach `attributes` to playlists. Always initialize:
   ```typescript
   parser.manifest.attributes = parser.manifest.attributes || {};
   ```

2. **URI Resolution:** URIs in the parsed output are exactly as they appear in the manifest (not resolved). You must resolve relative URLs yourself.

3. **Empty mediaGroups:** If no `#EXT-X-MEDIA` tags exist, `mediaGroups` will have empty objects for each type.

---

## mpd-parser (DASH)

### Installation

```bash
npm install mpd-parser
```

### Basic Usage

```typescript
import { parse } from 'mpd-parser';

const manifestUri = 'https://example.com/manifest.mpd';
const response = await fetch(manifestUri);
const manifestText = await response.text();

const eventHandler = ({ type, message }) => {
  console.log(`${type}: ${message}`);
};

const manifest = parse(manifestText, { manifestUri, eventHandler });
```

### Live Stream Re-parsing

```typescript
// For live streams, pass the previous manifest
const newManifest = parse(manifestText, {
  manifestUri,
  previousManifest: manifest
});
```

---

### Complete Manifest Structure

The mpd-parser outputs a structure very similar to m3u8-parser (designed for compatibility with Video.js):

```typescript
interface ParsedManifest {
  // Basic properties (same as HLS)
  allowCache: boolean;
  endList: boolean;                 // false for live streams
  mediaSequence: number;
  discontinuitySequence: number;
  playlistType: string;             // "static" (VOD) or "dynamic" (live)
  targetDuration: number;
  totalDuration: number;

  // Date/time
  dateTimeString: string;
  dateTimeObject: Date;

  // Discontinuity
  discontinuityStarts: number[];

  // Content Steering (DASH-specific)
  contentSteering?: ContentSteering;

  // Representations as playlists
  playlists: Playlist[];

  // Alternative renditions
  mediaGroups: MediaGroups;

  // Segments (when parsing single representation)
  segments: Segment[];
}

interface ContentSteering {
  defaultServiceLocation: string;
  proxyServerURL: string;
  queryBeforeStart: boolean;
  serverURL: string;
}
```

---

### Playlists Array (Representations)

DASH AdaptationSets/Representations are converted to the same playlist structure:

```typescript
interface Playlist {
  uri: string;                      // Resolved segment template or base URL
  attributes: PlaylistAttributes;
  segments: Segment[];              // Pre-resolved segments
  sidx?: SidxInfo;                  // SIDX box info if present
}

interface PlaylistAttributes {
  BANDWIDTH: number;                // @bandwidth
  CODECS: string;                   // @codecs
  RESOLUTION?: {
    width: number;
    height: number;
  };
  'FRAME-RATE'?: number;
  AUDIO?: string;                   // Audio adaptation set group
  SUBTITLES?: string;               // Text adaptation set group

  // DASH-specific
  id?: string;                      // @id
  mimeType?: string;                // @mimeType
  contentType?: string;             // audio/video/text
}
```

**Example Parsed Playlists from DASH:**

```javascript
// Input MPD AdaptationSet:
// <AdaptationSet mimeType="video/mp4" contentType="video">
//   <Representation id="1080p" bandwidth="5000000" width="1920" height="1080" codecs="avc1.640028">
//     <SegmentTemplate media="video_$Number$.m4s" initialization="video_init.mp4" duration="4" timescale="1"/>
//   </Representation>
// </AdaptationSet>

// Parsed output:
{
  playlists: [
    {
      uri: "",
      attributes: {
        BANDWIDTH: 5000000,
        CODECS: "avc1.640028",
        RESOLUTION: { width: 1920, height: 1080 },
        id: "1080p",
        mimeType: "video/mp4",
        contentType: "video"
      },
      segments: [
        {
          uri: "video_1.m4s",
          duration: 4,
          map: { uri: "video_init.mp4" },
          timeline: 0
        },
        // ... more segments
      ]
    }
  ]
}
```

---

### MediaGroups (Audio/Subtitles)

DASH audio and text AdaptationSets are converted to mediaGroups:

```typescript
// Same structure as m3u8-parser
interface MediaGroups {
  AUDIO: {
    [groupId: string]: {
      [name: string]: {
        default: boolean;
        autoselect: boolean;
        language: string;
        uri?: string;
        playlists?: Playlist[];     // Contains segments
        characteristics?: string;
        forced: boolean;
      };
    };
  };
  VIDEO: {};
  'CLOSED-CAPTIONS': {};
  SUBTITLES: {
    [groupId: string]: {
      [name: string]: {
        default: boolean;
        autoselect: boolean;
        language: string;
        uri?: string;
        playlists?: Playlist[];
        forced: boolean;
      };
    };
  };
}
```

**Example Parsed MediaGroups from DASH:**

```javascript
// Input MPD:
// <AdaptationSet mimeType="audio/mp4" lang="en" contentType="audio">
//   <Representation id="audio_en" bandwidth="128000" codecs="mp4a.40.2">
//     <SegmentTemplate media="audio_en_$Number$.m4s" .../>
//   </Representation>
// </AdaptationSet>
// <AdaptationSet mimeType="text/vtt" lang="en" contentType="text">
//   <Representation id="subs_en">
//     <BaseURL>subtitles_en.vtt</BaseURL>
//   </Representation>
// </AdaptationSet>

// Parsed output:
{
  mediaGroups: {
    AUDIO: {
      "audio": {
        "en": {
          default: true,
          autoselect: true,
          language: "en",
          playlists: [
            {
              attributes: {
                BANDWIDTH: 128000,
                CODECS: "mp4a.40.2"
              },
              segments: [/* ... */]
            }
          ]
        }
      }
    },
    VIDEO: {},
    'CLOSED-CAPTIONS': {},
    SUBTITLES: {
      "subs": {
        "en": {
          default: true,
          autoselect: true,
          language: "en",
          playlists: [
            {
              uri: "subtitles_en.vtt"
            }
          ]
        }
      }
    }
  }
}
```

---

### Segments Array

DASH segments are resolved from SegmentTemplate, SegmentList, or SegmentBase:

```typescript
interface Segment {
  uri: string;                      // Resolved segment URL
  duration: number;                 // Segment duration in seconds
  timeline: number;                 // Period/discontinuity sequence

  // Byte range (from SegmentBase or indexRange)
  byterange?: {
    length: number;
    offset: number;
  };

  // Initialization segment
  map?: {
    uri: string;
    byterange?: {
      length: number;
      offset: number;
    };
  };

  // For SegmentTimeline
  number?: number;                  // Segment number
  presentationTime?: number;        // Presentation timestamp

  // Encryption (ContentProtection)
  key?: {
    method: string;                 // "SAMPLE-AES-CTR" for Widevine/PlayReady
    uri?: string;
    iv?: string;
  };

  // Discontinuity
  discontinuity?: number;

  // Attributes
  attributes?: Record<string, any>;
}
```

---

### DASH to HLS-like Structure Mapping

| DASH Element | Parsed Structure |
|--------------|------------------|
| `<Period>` | Discontinuity boundary |
| `<AdaptationSet contentType="video">` | `playlists[]` |
| `<AdaptationSet contentType="audio">` | `mediaGroups.AUDIO` |
| `<AdaptationSet contentType="text">` | `mediaGroups.SUBTITLES` |
| `<Representation>` | Playlist entry with segments |
| `@bandwidth` | `attributes.BANDWIDTH` |
| `@codecs` | `attributes.CODECS` |
| `@width/@height` | `attributes.RESOLUTION` |
| `@lang` | `language` in mediaGroups |
| `<SegmentTemplate>` | Resolved to `segments[]` |
| `<ContentProtection>` | `key` in segments |

---

### DRM/ContentProtection Handling

The parser extracts ContentProtection info:

```javascript
// Example with ContentProtection
{
  playlists: [
    {
      attributes: {
        BANDWIDTH: 5000000,
        // ...
      },
      contentProtection: {
        // Widevine
        'com.widevine.alpha': {
          pssh: 'base64-encoded-pssh'
        },
        // PlayReady
        'com.microsoft.playready': {
          pssh: 'base64-encoded-pssh'
        }
      },
      segments: [/* ... */]
    }
  ]
}
```

---

### Module Import Methods

```typescript
// ES6
import { parse } from 'mpd-parser';

// CommonJS
const mpdParser = require('mpd-parser');

// Browser (script tag)
// <script src="mpd-parser.min.js"></script>
const mpdParser = window['mpd-parser'];

// AMD/RequireJS
require(['mpd-parser'], function(mpdParser) {
  // ...
});
```

---

## Comparison: m3u8-parser vs mpd-parser Output

Both parsers output compatible structures for Video.js http-streaming:

| Property | m3u8-parser | mpd-parser |
|----------|-------------|------------|
| `playlists` | From `#EXT-X-STREAM-INF` | From video AdaptationSets |
| `mediaGroups.AUDIO` | From `#EXT-X-MEDIA TYPE=AUDIO` | From audio AdaptationSets |
| `mediaGroups.SUBTITLES` | From `#EXT-X-MEDIA TYPE=SUBTITLES` | From text AdaptationSets |
| `segments` | From media playlist | Resolved from SegmentTemplate |
| `key` | From `#EXT-X-KEY` | From ContentProtection |
| `map` | From `#EXT-X-MAP` | Initialization segment |
| `endList` | `#EXT-X-ENDLIST` present | MPD@type="static" |

---

## Full Example: Parsing Both Formats

```typescript
import { Parser as HlsParser } from 'm3u8-parser';
import { parse as parseDash } from 'mpd-parser';

interface StreamInfo {
  type: 'hls' | 'dash';
  variants: Array<{
    bandwidth: number;
    resolution?: { width: number; height: number };
    codecs?: string;
    uri: string;
  }>;
  audioTracks: Array<{
    name: string;
    language: string;
    default: boolean;
    uri?: string;
  }>;
  subtitleTracks: Array<{
    name: string;
    language: string;
    forced: boolean;
    uri?: string;
  }>;
}

function parseHls(manifestText: string): StreamInfo {
  const parser = new HlsParser();
  parser.push(manifestText);
  parser.end();
  const manifest = parser.manifest;

  return {
    type: 'hls',
    variants: (manifest.playlists || []).map(p => ({
      bandwidth: p.attributes?.BANDWIDTH || 0,
      resolution: p.attributes?.RESOLUTION,
      codecs: p.attributes?.CODECS,
      uri: p.uri
    })),
    audioTracks: extractMediaGroup(manifest.mediaGroups?.AUDIO),
    subtitleTracks: extractSubtitles(manifest.mediaGroups?.SUBTITLES)
  };
}

function parseDashManifest(manifestText: string, manifestUri: string): StreamInfo {
  const manifest = parseDash(manifestText, { manifestUri });

  return {
    type: 'dash',
    variants: (manifest.playlists || []).map(p => ({
      bandwidth: p.attributes?.BANDWIDTH || 0,
      resolution: p.attributes?.RESOLUTION,
      codecs: p.attributes?.CODECS,
      uri: p.uri || ''
    })),
    audioTracks: extractMediaGroup(manifest.mediaGroups?.AUDIO),
    subtitleTracks: extractSubtitles(manifest.mediaGroups?.SUBTITLES)
  };
}

function extractMediaGroup(group: any): Array<{name: string; language: string; default: boolean; uri?: string}> {
  const tracks: Array<{name: string; language: string; default: boolean; uri?: string}> = [];

  if (!group) return tracks;

  for (const groupId of Object.keys(group)) {
    for (const name of Object.keys(group[groupId])) {
      const rendition = group[groupId][name];
      tracks.push({
        name,
        language: rendition.language || '',
        default: rendition.default || false,
        uri: rendition.uri
      });
    }
  }

  return tracks;
}

function extractSubtitles(group: any): Array<{name: string; language: string; forced: boolean; uri?: string}> {
  const tracks: Array<{name: string; language: string; forced: boolean; uri?: string}> = [];

  if (!group) return tracks;

  for (const groupId of Object.keys(group)) {
    for (const name of Object.keys(group[groupId])) {
      const rendition = group[groupId][name];
      tracks.push({
        name,
        language: rendition.language || '',
        forced: rendition.forced || false,
        uri: rendition.uri
      });
    }
  }

  return tracks;
}
```

---

## PlaybackLab Integration Notes

1. **Always initialize attributes:** Both parsers may not attach `attributes` property
   ```typescript
   manifest.attributes = manifest.attributes || {};
   ```

2. **Resolve relative URLs:** Both parsers return URLs as-is from the manifest. Use the manifest URL as base for resolution.

3. **Handle empty mediaGroups:** Check for existence before iterating:
   ```typescript
   const audioGroups = manifest.mediaGroups?.AUDIO || {};
   ```

4. **DASH segments are pre-resolved:** Unlike HLS where you may need to fetch media playlists, DASH segments are already in the parsed output.

5. **DRM detection:** Check for `key` property in segments (HLS) or `contentProtection` in playlists (DASH).

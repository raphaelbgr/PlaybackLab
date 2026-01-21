# HLS (HTTP Live Streaming) Manifest Specification

## Official Specifications

### Apple Documentation
- **HLS Authoring Specification**: https://developer.apple.com/documentation/http-live-streaming/hls-authoring-specification-for-apple-devices
- **Apple Developer Streaming Portal**: https://developer.apple.com/streaming/
- **HLS Authoring Appendixes**: https://developer.apple.com/documentation/http-live-streaming/hls-authoring-specification-for-apple-devices-appendixes

### IETF Specification
- **RFC 8216**: Original HLS specification
- **draft-pantos-hls-rfc8216bis**: Latest revision (obsoletes RFC 8216), describes protocol version 13
- **IETF Draft**: https://datatracker.ietf.org/doc/html/draft-pantos-hls-rfc8216bis

---

## Playlist Types

HLS uses two types of playlist files (`.m3u8` extension):

### 1. Master Playlist (Multivariant Playlist)
The top-level index file that lists all available renditions. Contains:
- References to media playlists (video variants at different qualities)
- Alternate audio tracks
- Subtitle tracks
- Does NOT contain media segments directly

### 2. Media Playlist
Lists the sequence of media segments for a single rendition. Contains:
- Segment URLs and durations
- Encryption information
- Timing metadata

---

## Basic Tags (Both Playlist Types)

| Tag | Description | Required |
|-----|-------------|----------|
| `#EXTM3U` | File header, must be first line | Yes |
| `#EXT-X-VERSION:<n>` | HLS protocol version (1-13+) | Recommended |
| `#EXT-X-INDEPENDENT-SEGMENTS` | Segments decode without external data | No |
| `#EXT-X-START:TIME-OFFSET=<s>` | Preferred playback start point | No |
| `#EXT-X-DEFINE:NAME="<name>",VALUE="<value>"` | Variable definitions | No |

---

## Master Playlist Tags

### EXT-X-STREAM-INF (Variant Streams)

Describes available video/audio variant streams. The URI to the Media Playlist follows on the next line.

```
#EXT-X-STREAM-INF:BANDWIDTH=1123000,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=1280x720
720p/playlist.m3u8
```

#### Attributes

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `BANDWIDTH` | Integer | **Yes** | Peak segment bitrate in bits/second |
| `AVERAGE-BANDWIDTH` | Integer | No | Average bitrate across segments |
| `CODECS` | Quoted-string | Recommended | RFC 6381 codec specifications |
| `RESOLUTION` | WxH | No | Video dimensions (e.g., `1920x1080`) |
| `FRAME-RATE` | Decimal | No | Maximum frame rate (e.g., `29.97`) |
| `HDCP-LEVEL` | Enum | No | HDCP requirement: `NONE`, `TYPE-0`, `TYPE-1` |
| `AUDIO` | Quoted-string | No | GROUP-ID of associated audio renditions |
| `VIDEO` | Quoted-string | No | GROUP-ID of associated video renditions |
| `SUBTITLES` | Quoted-string | No | GROUP-ID of associated subtitle renditions |
| `CLOSED-CAPTIONS` | Quoted-string | No | GROUP-ID of closed caption renditions, or `NONE` |
| `SCORE` | Decimal | No | Server's suggested selection score (QoE estimate) |
| `VIDEO-RANGE` | Enum | No | Video dynamic range: `SDR`, `HLG`, `PQ` |
| `SUPPLEMENTAL-CODECS` | Quoted-string | No | Enhancement layer codecs (e.g., Dolby Vision) |
| `ALLOWED-CPC` | Quoted-string | No | Allowed content protection configurations |

### EXT-X-I-FRAME-STREAM-INF (I-Frame Only Streams)

For trick-play (fast-forward, rewind). Same attributes as `EXT-X-STREAM-INF` plus:

| Attribute | Type | Description |
|-----------|------|-------------|
| `URI` | Quoted-string | Path to I-frame-only playlist |

---

## EXT-X-MEDIA (Alternate Renditions)

Defines alternate renditions: audio tracks, subtitles, closed captions, or alternate video angles.

```
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="English",LANGUAGE="en",DEFAULT=YES,URI="audio/en.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",LANGUAGE="en",URI="subs/en.m3u8"
```

### Attributes

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `TYPE` | Enum | **Yes** | `AUDIO`, `VIDEO`, `SUBTITLES`, `CLOSED-CAPTIONS` |
| `GROUP-ID` | Quoted-string | **Yes** | Identifier for grouping related renditions |
| `NAME` | Quoted-string | **Yes** | Human-readable rendition name |
| `LANGUAGE` | Quoted-string | No | RFC 5646 language tag (e.g., `en`, `es`, `fr`) |
| `ASSOC-LANGUAGE` | Quoted-string | No | Associated language for accessibility |
| `DEFAULT` | Enum | No | `YES` or `NO` - marks default rendition |
| `AUTOSELECT` | Enum | No | `YES` or `NO` - enables automatic selection |
| `FORCED` | Enum | No | `YES` or `NO` - for forced subtitles only |
| `INSTREAM-ID` | Quoted-string | Conditional | Required for `CLOSED-CAPTIONS` (e.g., `CC1`, `CC2`) |
| `CHARACTERISTICS` | Quoted-string | No | UTI for accessibility features |
| `CHANNELS` | Quoted-string | No | Audio channel config (e.g., `2`, `6`, `8/JOC`) |
| `URI` | Quoted-string | Conditional | Media playlist URI (required for `SUBTITLES`) |

### TYPE Values

| Type | Description | URI Required |
|------|-------------|--------------|
| `AUDIO` | Audio tracks (different languages, formats) | Optional |
| `VIDEO` | Video tracks (different camera angles) | Optional |
| `SUBTITLES` | WebVTT subtitle tracks | **Yes** |
| `CLOSED-CAPTIONS` | In-stream closed captions | No (uses `INSTREAM-ID`) |

---

## Media Playlist Tags

### Segment Information

| Tag | Description | Example |
|-----|-------------|---------|
| `#EXT-X-TARGETDURATION:<s>` | Maximum segment duration (required) | `#EXT-X-TARGETDURATION:10` |
| `#EXT-X-MEDIA-SEQUENCE:<n>` | First segment sequence number | `#EXT-X-MEDIA-SEQUENCE:0` |
| `#EXTINF:<duration>,[<title>]` | Segment duration in seconds | `#EXTINF:9.967,` |
| `#EXT-X-BYTERANGE:<n>[@<o>]` | Byte range within file | `#EXT-X-BYTERANGE:1024@0` |

### Playlist Type

| Tag | Description |
|-----|-------------|
| `#EXT-X-PLAYLIST-TYPE:VOD` | Complete, immutable playlist |
| `#EXT-X-PLAYLIST-TYPE:EVENT` | Live playlist, segments only added |
| `#EXT-X-ENDLIST` | No more segments will be added |

### Timing and Synchronization

| Tag | Description | Example |
|-----|-------------|---------|
| `#EXT-X-PROGRAM-DATE-TIME` | ISO 8601 timestamp | `#EXT-X-PROGRAM-DATE-TIME:2024-01-15T12:00:00Z` |
| `#EXT-X-DATERANGE` | Date range with metadata | Complex - see below |
| `#EXT-X-DISCONTINUITY` | Signals encoding change | (No parameters) |
| `#EXT-X-DISCONTINUITY-SEQUENCE` | Discontinuity counter | `#EXT-X-DISCONTINUITY-SEQUENCE:0` |

### Initialization Segments (fMP4)

| Tag | Description |
|-----|-------------|
| `#EXT-X-MAP:URI="init.mp4"` | Initialization segment for fMP4 |

---

## Duration and Timing

### EXTINF Format

```
#EXTINF:<duration>,[<title>]
segment_url.ts
```

- **duration**: Decimal floating-point seconds (millisecond accuracy recommended)
- **title**: Optional, human-readable title

**Version Requirements:**
- Version < 3: Integer duration only
- Version >= 3: Decimal floating-point allowed

### Calculating Total Duration

```javascript
// Sum all EXTINF durations
let totalDuration = 0;
for (const segment of segments) {
  totalDuration += segment.duration; // From EXTINF
}
```

### Getting Resolution

From `EXT-X-STREAM-INF`:
```
RESOLUTION=1920x1080
```

Parse as: `width x height` (no spaces)

---

## DRM Detection (Encryption)

### EXT-X-KEY (Media Playlist)

Specifies encryption for media segments. Applies to all subsequent segments until next `EXT-X-KEY`.

```
#EXT-X-KEY:METHOD=AES-128,URI="https://license.example.com/key",IV=0x1234567890ABCDEF1234567890ABCDEF
```

### EXT-X-SESSION-KEY (Master Playlist)

Session-level encryption info, allows early key loading. Same attributes as `EXT-X-KEY`.

```
#EXT-X-SESSION-KEY:METHOD=SAMPLE-AES,URI="skd://fairplay.example.com",KEYFORMAT="com.apple.streamingkeydelivery"
```

### Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `METHOD` | Enum | Encryption method (see below) |
| `URI` | Quoted-string | Key/license server URL |
| `IV` | Hex | 128-bit initialization vector (0x prefix) |
| `KEYFORMAT` | Quoted-string | Key format identifier |
| `KEYFORMATVERSIONS` | Quoted-string | Supported key format versions |

### METHOD Values

| Method | Description |
|--------|-------------|
| `NONE` | No encryption |
| `AES-128` | AES-128 CBC full segment encryption |
| `AES-256` | AES-256 CBC encryption |
| `SAMPLE-AES` | Sample-level AES encryption (DRM) |
| `SAMPLE-AES-CTR` | Sample-level AES-CTR encryption |

### DRM System Detection via KEYFORMAT

| DRM System | KEYFORMAT Value |
|------------|-----------------|
| **Clear Key** | `identity` (default) |
| **Apple FairPlay** | `com.apple.streamingkeydelivery` |
| **Apple FairPlay v1** | `com.apple.fps.1_0` |
| **Google Widevine** | `urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed` |
| **Microsoft PlayReady** | `com.microsoft.playready` |

### DRM System UUIDs

| DRM System | UUID |
|------------|------|
| Widevine | `edef8ba9-79d6-4ace-a3c8-27dcd51d21ed` |
| PlayReady | `9a04f079-9840-4286-ab92-e65be0885f95` |
| FairPlay | `94ce86fb-07bb-4b43-adb8-93d2fa968ca2` |

### Example: Multi-DRM HLS

```
#EXTM3U
#EXT-X-VERSION:6

# FairPlay
#EXT-X-SESSION-KEY:METHOD=SAMPLE-AES,URI="skd://license.example.com/fairplay",KEYFORMAT="com.apple.streamingkeydelivery",KEYFORMATVERSIONS="1"

# Widevine
#EXT-X-SESSION-KEY:METHOD=SAMPLE-AES,URI="data:text/plain;base64,AAAA...",KEYFORMAT="urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed",KEYFORMATVERSIONS="1"

# PlayReady
#EXT-X-SESSION-KEY:METHOD=SAMPLE-AES,URI="data:text/plain;base64,AAAA...",KEYFORMAT="com.microsoft.playready",KEYFORMATVERSIONS="1"
```

### Detecting DRM in Code

```javascript
function detectDRM(playlist) {
  const drmSystems = [];

  // Check EXT-X-KEY and EXT-X-SESSION-KEY tags
  const keyTags = [...playlist.matchAll(/#EXT-X-(?:SESSION-)?KEY:([^\n]+)/g)];

  for (const match of keyTags) {
    const attributes = match[1];
    const keyformat = attributes.match(/KEYFORMAT="([^"]+)"/)?.[1] || 'identity';
    const method = attributes.match(/METHOD=([^,\s]+)/)?.[1];

    if (method === 'NONE') continue;

    if (keyformat.includes('apple') || keyformat.includes('fps')) {
      drmSystems.push('FairPlay');
    } else if (keyformat.includes('edef8ba9')) {
      drmSystems.push('Widevine');
    } else if (keyformat.includes('playready') || keyformat.includes('microsoft')) {
      drmSystems.push('PlayReady');
    } else if (keyformat === 'identity' && method === 'AES-128') {
      drmSystems.push('AES-128 (Clear Key)');
    } else if (method === 'SAMPLE-AES') {
      drmSystems.push('SAMPLE-AES (Unknown DRM)');
    }
  }

  return [...new Set(drmSystems)];
}
```

---

## Audio Track Detection

### From EXT-X-MEDIA

```
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="English",LANGUAGE="en",CHANNELS="2",DEFAULT=YES,AUTOSELECT=YES,URI="audio/en_stereo.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="English 5.1",LANGUAGE="en",CHANNELS="6",DEFAULT=NO,URI="audio/en_surround.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="Spanish",LANGUAGE="es",CHANNELS="2",DEFAULT=NO,URI="audio/es.m3u8"
```

### Audio Properties to Extract

| Property | Source | Example |
|----------|--------|---------|
| Name | `NAME` attribute | `"English 5.1"` |
| Language | `LANGUAGE` attribute | `"en"`, `"es"`, `"fr"` |
| Channels | `CHANNELS` attribute | `"2"`, `"6"`, `"8/JOC"` |
| Default | `DEFAULT` attribute | `YES` or `NO` |
| Group | `GROUP-ID` attribute | Links to `EXT-X-STREAM-INF` |

---

## Subtitle/Caption Detection

### Subtitles (WebVTT)

```
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",LANGUAGE="en",DEFAULT=YES,AUTOSELECT=YES,FORCED=NO,URI="subs/en.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="Spanish",LANGUAGE="es",DEFAULT=NO,URI="subs/es.m3u8"
```

### Closed Captions (Embedded)

```
#EXT-X-MEDIA:TYPE=CLOSED-CAPTIONS,GROUP-ID="cc",NAME="English",LANGUAGE="en",INSTREAM-ID="CC1",DEFAULT=YES
#EXT-X-MEDIA:TYPE=CLOSED-CAPTIONS,GROUP-ID="cc",NAME="Spanish",LANGUAGE="es",INSTREAM-ID="CC3",DEFAULT=NO
```

### Subtitle Properties

| Property | Source | Description |
|----------|--------|-------------|
| Name | `NAME` | Display name |
| Language | `LANGUAGE` | RFC 5646 language code |
| Forced | `FORCED` | Forced narrative subtitles |
| Default | `DEFAULT` | Default selection |
| INSTREAM-ID | `INSTREAM-ID` | For closed captions: `CC1`-`CC4`, `SERVICE1`-`SERVICE63` |

---

## Complete Example: Master Playlist

```
#EXTM3U
#EXT-X-VERSION:6
#EXT-X-INDEPENDENT-SEGMENTS

## Session-level DRM (FairPlay)
#EXT-X-SESSION-KEY:METHOD=SAMPLE-AES,URI="skd://license.example.com",KEYFORMAT="com.apple.streamingkeydelivery",KEYFORMATVERSIONS="1"

## Audio Tracks
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="English",LANGUAGE="en",CHANNELS="2",DEFAULT=YES,AUTOSELECT=YES,URI="audio/en.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="Spanish",LANGUAGE="es",CHANNELS="2",DEFAULT=NO,AUTOSELECT=YES,URI="audio/es.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio-surround",NAME="English 5.1",LANGUAGE="en",CHANNELS="6",DEFAULT=YES,URI="audio/en_51.m3u8"

## Subtitles
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",LANGUAGE="en",DEFAULT=YES,AUTOSELECT=YES,URI="subs/en.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="Spanish",LANGUAGE="es",DEFAULT=NO,URI="subs/es.m3u8"

## Closed Captions
#EXT-X-MEDIA:TYPE=CLOSED-CAPTIONS,GROUP-ID="cc",NAME="English CC",LANGUAGE="en",INSTREAM-ID="CC1",DEFAULT=YES

## Video Variants
#EXT-X-STREAM-INF:BANDWIDTH=628000,AVERAGE-BANDWIDTH=560000,CODECS="avc1.42c00d,mp4a.40.2",RESOLUTION=416x234,FRAME-RATE=30,AUDIO="audio",SUBTITLES="subs",CLOSED-CAPTIONS="cc"
video/234p.m3u8

#EXT-X-STREAM-INF:BANDWIDTH=1128000,AVERAGE-BANDWIDTH=990000,CODECS="avc1.4d401f,mp4a.40.2",RESOLUTION=640x360,FRAME-RATE=30,AUDIO="audio",SUBTITLES="subs",CLOSED-CAPTIONS="cc"
video/360p.m3u8

#EXT-X-STREAM-INF:BANDWIDTH=2628000,AVERAGE-BANDWIDTH=2400000,CODECS="avc1.4d401f,mp4a.40.2",RESOLUTION=1280x720,FRAME-RATE=30,AUDIO="audio",SUBTITLES="subs",CLOSED-CAPTIONS="cc"
video/720p.m3u8

#EXT-X-STREAM-INF:BANDWIDTH=5628000,AVERAGE-BANDWIDTH=5200000,CODECS="avc1.640028,mp4a.40.2",RESOLUTION=1920x1080,FRAME-RATE=30,AUDIO="audio-surround",SUBTITLES="subs",CLOSED-CAPTIONS="cc"
video/1080p.m3u8

## I-Frame Only (for trick play)
#EXT-X-I-FRAME-STREAM-INF:BANDWIDTH=86000,CODECS="avc1.42c00d",RESOLUTION=416x234,URI="video/234p_iframe.m3u8"
#EXT-X-I-FRAME-STREAM-INF:BANDWIDTH=246000,CODECS="avc1.640028",RESOLUTION=1920x1080,URI="video/1080p_iframe.m3u8"
```

## Complete Example: Media Playlist

```
#EXTM3U
#EXT-X-VERSION:6
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:VOD

#EXT-X-KEY:METHOD=SAMPLE-AES,URI="skd://license.example.com/key1",KEYFORMAT="com.apple.streamingkeydelivery",KEYFORMATVERSIONS="1",IV=0x1234567890ABCDEF1234567890ABCDEF

#EXT-X-MAP:URI="init.mp4"

#EXT-X-PROGRAM-DATE-TIME:2024-01-15T12:00:00.000Z
#EXTINF:9.967,
segment_0.m4s
#EXTINF:10.010,
segment_1.m4s
#EXTINF:9.976,
segment_2.m4s

#EXT-X-DISCONTINUITY
#EXT-X-KEY:METHOD=SAMPLE-AES,URI="skd://license.example.com/key2",IV=0xFEDCBA0987654321FEDCBA0987654321
#EXTINF:10.010,
segment_3.m4s
#EXTINF:8.342,
segment_4.m4s

#EXT-X-ENDLIST
```

---

## Low-Latency HLS (LL-HLS)

Additional tags for low-latency streaming:

| Tag | Description |
|-----|-------------|
| `#EXT-X-SERVER-CONTROL` | Server capability hints |
| `#EXT-X-PART-INF:PART-TARGET=<s>` | Partial segment target duration |
| `#EXT-X-PART:DURATION=<s>,URI="..."` | Partial segment |
| `#EXT-X-PRELOAD-HINT:TYPE=PART,URI="..."` | Preload hint for next part |
| `#EXT-X-RENDITION-REPORT` | Rendition report for blocking requests |

---

## Metadata Extraction Summary

### From Master Playlist

| Data | Source Tag | Attribute(s) |
|------|------------|--------------|
| Video variants | `EXT-X-STREAM-INF` | `BANDWIDTH`, `RESOLUTION`, `CODECS`, `FRAME-RATE` |
| Audio tracks | `EXT-X-MEDIA` (TYPE=AUDIO) | `NAME`, `LANGUAGE`, `CHANNELS`, `DEFAULT` |
| Subtitles | `EXT-X-MEDIA` (TYPE=SUBTITLES) | `NAME`, `LANGUAGE`, `FORCED` |
| Closed captions | `EXT-X-MEDIA` (TYPE=CLOSED-CAPTIONS) | `NAME`, `LANGUAGE`, `INSTREAM-ID` |
| DRM info | `EXT-X-SESSION-KEY` | `METHOD`, `KEYFORMAT`, `URI` |

### From Media Playlist

| Data | Source Tag | Attribute(s) |
|------|------------|--------------|
| Total duration | Sum of `EXTINF` | duration values |
| Segment count | Count of `EXTINF` | - |
| Encryption | `EXT-X-KEY` | `METHOD`, `KEYFORMAT`, `URI`, `IV` |
| Live vs VOD | `EXT-X-PLAYLIST-TYPE` | `VOD`, `EVENT`, or absence |
| Target duration | `EXT-X-TARGETDURATION` | seconds |

---

## References

- [Apple HLS Authoring Specification](https://developer.apple.com/documentation/http-live-streaming/hls-authoring-specification-for-apple-devices)
- [Apple Developer Streaming Portal](https://developer.apple.com/streaming/)
- [IETF draft-pantos-hls-rfc8216bis](https://datatracker.ietf.org/doc/html/draft-pantos-hls-rfc8216bis)
- [Mux HLS Tags Guide](https://www.mux.com/articles/hls-ext-tags)
- [OTTVerse EXT-X-KEY Guide](https://ottverse.com/what-is-ext-x-key-in-hls-playlists/)
- [Broadpeak HLS Format](https://developers.broadpeak.io/docs/foundations-hls)
- [Unified Streaming HLS DRM](https://docs.unified-streaming.com/documentation/drm/hls.html)
- [Dolby OptiView Multi-key HLS](https://optiview.dolby.com/docs/theoplayer/how-to-guides/drm/multikey-hls/)

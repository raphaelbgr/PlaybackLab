# DASH MPD Manifest Specification Research

## Overview

MPEG-DASH (Dynamic Adaptive Streaming over HTTP) is an international standard for adaptive bitrate streaming defined in ISO/IEC 23009-1. Unlike HLS which is Apple-proprietary, DASH is codec-agnostic and can use any encoding format (H.264, H.265, VP9, AV1, etc.).

The Media Presentation Description (MPD) is an XML document that describes the structure and availability of media content for DASH streaming.

**Key Standards:**
- ISO/IEC 23009-1 (MPEG-DASH specification)
- Common Encryption (CENC) for DRM: ISO/IEC 23001-7
- DASH-IF Implementation Guidelines (DASH-IF IOP)

**MIME Type:** `application/dash+xml`

---

## 1. MPD Hierarchical Structure

The MPD follows a nested hierarchy from broadest to most specific:

```
MPD (root)
  └── Period (time window)
        └── AdaptationSet (media group - video/audio/text)
              └── Representation (specific encoding variant)
                    └── Segments (actual media files)
```

### 1.1 MPD Element (Root)

The root element containing global presentation information.

**Key Attributes:**

| Attribute | Type | Description |
|-----------|------|-------------|
| `type` | `static` / `dynamic` | `static` for VOD, `dynamic` for live |
| `mediaPresentationDuration` | ISO 8601 duration | Total duration (VOD only) |
| `minBufferTime` | ISO 8601 duration | Minimum buffer before playback |
| `maxSegmentDuration` | ISO 8601 duration | Maximum segment duration |
| `availabilityStartTime` | ISO 8601 datetime | When content becomes available (live) |
| `publishTime` | ISO 8601 datetime | When MPD was generated |
| `minimumUpdatePeriod` | ISO 8601 duration | How often to refresh MPD (live) |
| `profiles` | URI string | DASH profile(s) used |

**Duration Format (ISO 8601):**
- `PT1H30M45.5S` = 1 hour, 30 minutes, 45.5 seconds
- `P0Y0M0DT0H10M0.000S` = 10 minutes

**Example:**
```xml
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011"
     type="static"
     mediaPresentationDuration="PT1H30M0S"
     minBufferTime="PT2S"
     profiles="urn:mpeg:dash:profile:isoff-on-demand:2011">
```

### 1.2 Period Element

Represents a time window within the presentation. Multiple Periods enable content separation (e.g., ads from main content, chapters).

**Key Attributes:**

| Attribute | Type | Description |
|-----------|------|-------------|
| `id` | string | Unique identifier |
| `start` | ISO 8601 duration | Start time relative to presentation start |
| `duration` | ISO 8601 duration | Period duration |

**Example:**
```xml
<Period id="ad" duration="PT30S">
  <!-- Ad content -->
</Period>
<Period id="main" start="PT30S">
  <!-- Main content -->
</Period>
```

### 1.3 AdaptationSet Element

Groups related media streams (e.g., all video variants, all English audio tracks). This is where video/audio/text differentiation happens.

**Key Attributes:**

| Attribute | Type | Description |
|-----------|------|-------------|
| `id` | integer | Unique identifier within Period |
| `contentType` | string | `video`, `audio`, `text`, `image` |
| `mimeType` | string | MIME type (e.g., `video/mp4`) |
| `codecs` | string | Codec string (can inherit to Representations) |
| `lang` | BCP-47 string | Language code (e.g., `en`, `es-419`) |
| `maxWidth` / `maxHeight` | integer | Maximum resolution in set |
| `par` | ratio | Picture aspect ratio (e.g., `16:9`) |
| `frameRate` | fraction | Frame rate (e.g., `30000/1001`) |
| `segmentAlignment` | boolean | Segments align across Representations |
| `subsegmentAlignment` | boolean | Subsegments align |
| `bitstreamSwitching` | boolean | Can switch bitrates without init segment |

**Example:**
```xml
<AdaptationSet id="1" contentType="video" mimeType="video/mp4"
               codecs="avc1.64001f" maxWidth="1920" maxHeight="1080">
```

### 1.4 Representation Element

A specific encoded version of media content. Each differs in bitrate, resolution, or codec.

**Key Attributes:**

| Attribute | Type | Description |
|-----------|------|-------------|
| `id` | string | Unique identifier within AdaptationSet |
| `bandwidth` | integer | **Bitrate in bits per second** |
| `width` | integer | Video width in pixels |
| `height` | integer | Video height in pixels |
| `codecs` | string | RFC 6381 codec string |
| `frameRate` | fraction | Frame rate |
| `audioSamplingRate` | integer | Audio sample rate (Hz) |
| `qualityRanking` | integer | Relative quality (lower = better) |

**Example:**
```xml
<Representation id="720p" bandwidth="3000000" width="1280" height="720"
                codecs="avc1.64001f" frameRate="30">
```

### 1.5 SubRepresentation Element

Used when a Representation contains multiplexed content (e.g., embedded subtitles, multiple audio channels in one stream).

---

## 2. Differentiating Video/Audio/Text AdaptationSets

### 2.1 Primary Differentiation: `contentType` and `mimeType`

| Content Type | contentType | Common mimeType Values |
|--------------|-------------|------------------------|
| **Video** | `video` | `video/mp4`, `video/webm`, `video/mp2t` |
| **Audio** | `audio` | `audio/mp4`, `audio/webm`, `audio/mp2t` |
| **Subtitles/Captions** | `text` | `text/vtt`, `application/ttml+xml`, `application/mp4` |
| **Thumbnails** | `image` | `image/jpeg`, `image/png` |

### 2.2 Detection Strategy

```typescript
function getAdaptationSetType(adaptationSet: AdaptationSet): string {
  // 1. Check contentType attribute (most reliable)
  if (adaptationSet.contentType) {
    return adaptationSet.contentType; // 'video', 'audio', 'text', 'image'
  }

  // 2. Check mimeType attribute
  const mimeType = adaptationSet.mimeType || '';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('text/') || mimeType.includes('ttml')) return 'text';
  if (mimeType.startsWith('image/')) return 'image';

  // 3. Check Representation codecs as fallback
  const codecs = adaptationSet.codecs || '';
  if (codecs.startsWith('avc') || codecs.startsWith('hvc') ||
      codecs.startsWith('hev') || codecs.startsWith('vp')) return 'video';
  if (codecs.startsWith('mp4a') || codecs.startsWith('ac-') ||
      codecs.startsWith('ec-') || codecs.startsWith('opus')) return 'audio';

  return 'unknown';
}
```

### 2.3 Example MPD with All Types

```xml
<Period>
  <!-- Video AdaptationSet -->
  <AdaptationSet id="1" contentType="video" mimeType="video/mp4"
                 codecs="avc1.64001f" maxWidth="1920" maxHeight="1080">
    <Representation id="1080p" bandwidth="5000000" width="1920" height="1080"/>
    <Representation id="720p" bandwidth="3000000" width="1280" height="720"/>
    <Representation id="480p" bandwidth="1500000" width="854" height="480"/>
  </AdaptationSet>

  <!-- Audio AdaptationSet - English -->
  <AdaptationSet id="2" contentType="audio" mimeType="audio/mp4"
                 codecs="mp4a.40.2" lang="en">
    <Role schemeIdUri="urn:mpeg:dash:role:2011" value="main"/>
    <Representation id="audio-en" bandwidth="128000" audioSamplingRate="48000"/>
  </AdaptationSet>

  <!-- Audio AdaptationSet - Spanish -->
  <AdaptationSet id="3" contentType="audio" mimeType="audio/mp4"
                 codecs="mp4a.40.2" lang="es">
    <Role schemeIdUri="urn:mpeg:dash:role:2011" value="dub"/>
    <Representation id="audio-es" bandwidth="128000" audioSamplingRate="48000"/>
  </AdaptationSet>

  <!-- Subtitle AdaptationSet - English -->
  <AdaptationSet id="4" contentType="text" mimeType="text/vtt" lang="en">
    <Role schemeIdUri="urn:mpeg:dash:role:2011" value="subtitle"/>
    <Representation id="sub-en" bandwidth="1000"/>
  </AdaptationSet>
</Period>
```

---

## 3. DRM Detection: ContentProtection Element

### 3.1 ContentProtection Structure

The `<ContentProtection>` element signals DRM protection within an AdaptationSet.

**Key Attributes:**

| Attribute | Description |
|-----------|-------------|
| `schemeIdUri` | DRM system identifier (UUID or MPEG URI) |
| `value` | DRM system name/version (human-readable) |
| `cenc:default_KID` | Key ID for Common Encryption |

### 3.2 DRM System UUIDs

| DRM System | UUID (schemeIdUri) | value Attribute |
|------------|---------------------|-----------------|
| **Widevine** | `urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed` | `Widevine` |
| **PlayReady** | `urn:uuid:9a04f079-9840-4286-ab92-e65be0885f95` | `MSPR 2.0` |
| **FairPlay** | `urn:uuid:94ce86fb-07ff-4f43-adb8-93d2fa968ca2` | `FairPlay` |
| **ClearKey** | `urn:uuid:e2719d58-a985-b3c9-781a-b030af78d30e` | `ClearKey1.0` |
| **Marlin** | `urn:uuid:5e629af5-38da-4063-8977-97ffbd9902d4` | `Marlin` |
| **Adobe Primetime** | `urn:uuid:f239e769-efa3-4850-9c16-a903c6932efb` | `Adobe` |
| **Common (CENC)** | `urn:mpeg:dash:mp4protection:2011` | `cenc` |

### 3.3 DRM Detection Code

```typescript
interface DRMInfo {
  system: string;
  schemeIdUri: string;
  keyId?: string;
  pssh?: string;
}

const DRM_SYSTEMS: Record<string, string> = {
  'edef8ba9-79d6-4ace-a3c8-27dcd51d21ed': 'Widevine',
  '9a04f079-9840-4286-ab92-e65be0885f95': 'PlayReady',
  '94ce86fb-07ff-4f43-adb8-93d2fa968ca2': 'FairPlay',
  'e2719d58-a985-b3c9-781a-b030af78d30e': 'ClearKey',
  '5e629af5-38da-4063-8977-97ffbd9902d4': 'Marlin',
  'f239e769-efa3-4850-9c16-a903c6932efb': 'Adobe Primetime',
};

function detectDRM(contentProtection: Element[]): DRMInfo[] {
  return contentProtection.map(cp => {
    const schemeIdUri = cp.getAttribute('schemeIdUri') || '';

    // Extract UUID from urn:uuid:xxxx-xxxx-xxxx-xxxx-xxxx
    const uuidMatch = schemeIdUri.match(/urn:uuid:([a-f0-9-]+)/i);
    const uuid = uuidMatch ? uuidMatch[1].toLowerCase() : '';

    const system = DRM_SYSTEMS[uuid] ||
                   cp.getAttribute('value') ||
                   'Unknown';

    // Look for PSSH data
    const psshElement = cp.querySelector('pssh, cenc\\:pssh');
    const pssh = psshElement?.textContent || undefined;

    // Look for Key ID
    const keyId = cp.getAttribute('cenc:default_KID') ||
                  cp.getAttributeNS('urn:mpeg:cenc:2013', 'default_KID');

    return { system, schemeIdUri, keyId, pssh };
  });
}
```

### 3.4 Example ContentProtection in MPD

```xml
<AdaptationSet>
  <!-- Common Encryption indicator -->
  <ContentProtection schemeIdUri="urn:mpeg:dash:mp4protection:2011"
                     value="cenc"
                     cenc:default_KID="43215678-1234-1234-1234-123456789012"/>

  <!-- Widevine -->
  <ContentProtection schemeIdUri="urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed">
    <cenc:pssh>AAAANHBzc2gAAAAA7e+LqXnWSs6jyCfc1R0h7Q...</cenc:pssh>
  </ContentProtection>

  <!-- PlayReady -->
  <ContentProtection schemeIdUri="urn:uuid:9a04f079-9840-4286-ab92-e65be0885f95"
                     value="MSPR 2.0">
    <mspr:pro>...</mspr:pro>
    <cenc:pssh>AAAAoXBzc2gAAAAAmgTweZhAQoarkuZb4IhflQ...</cenc:pssh>
  </ContentProtection>
</AdaptationSet>
```

---

## 4. Extracting Metadata

### 4.1 Duration

**Location:** MPD root element

```typescript
function getDuration(mpd: Element): number | null {
  // VOD: mediaPresentationDuration on MPD
  const duration = mpd.getAttribute('mediaPresentationDuration');
  if (duration) {
    return parseISO8601Duration(duration);
  }

  // Alternative: sum of Period durations
  const periods = mpd.querySelectorAll('Period');
  let total = 0;
  periods.forEach(period => {
    const d = period.getAttribute('duration');
    if (d) total += parseISO8601Duration(d);
  });
  return total || null;
}

// Parse ISO 8601 duration to seconds
function parseISO8601Duration(duration: string): number {
  const match = duration.match(
    /P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/
  );
  if (!match) return 0;

  const [, years, months, days, hours, minutes, seconds] = match;
  return (
    (parseFloat(years || '0') * 365 * 24 * 60 * 60) +
    (parseFloat(months || '0') * 30 * 24 * 60 * 60) +
    (parseFloat(days || '0') * 24 * 60 * 60) +
    (parseFloat(hours || '0') * 60 * 60) +
    (parseFloat(minutes || '0') * 60) +
    parseFloat(seconds || '0')
  );
}
```

### 4.2 Resolution (Video)

**Location:** Representation or AdaptationSet `width` and `height` attributes

```typescript
interface VideoVariant {
  id: string;
  width: number;
  height: number;
  bandwidth: number;
  codecs?: string;
  frameRate?: string;
}

function getVideoVariants(adaptationSet: Element): VideoVariant[] {
  const representations = adaptationSet.querySelectorAll('Representation');

  return Array.from(representations).map(rep => ({
    id: rep.getAttribute('id') || '',
    width: parseInt(rep.getAttribute('width') ||
                    adaptationSet.getAttribute('maxWidth') || '0'),
    height: parseInt(rep.getAttribute('height') ||
                     adaptationSet.getAttribute('maxHeight') || '0'),
    bandwidth: parseInt(rep.getAttribute('bandwidth') || '0'),
    codecs: rep.getAttribute('codecs') ||
            adaptationSet.getAttribute('codecs') || undefined,
    frameRate: rep.getAttribute('frameRate') ||
               adaptationSet.getAttribute('frameRate') || undefined,
  }));
}
```

### 4.3 Audio Tracks

**Location:** Audio AdaptationSets with `lang`, `codecs`, and Role elements

```typescript
interface AudioTrack {
  id: string;
  language: string;
  codecs?: string;
  bandwidth: number;
  channels?: number;
  sampleRate?: number;
  role?: string;  // 'main', 'dub', 'commentary', 'description'
}

function getAudioTracks(periods: Element[]): AudioTrack[] {
  const tracks: AudioTrack[] = [];

  periods.forEach(period => {
    const audioSets = period.querySelectorAll(
      'AdaptationSet[contentType="audio"], AdaptationSet[mimeType^="audio/"]'
    );

    audioSets.forEach(as => {
      const role = as.querySelector('Role');
      const rep = as.querySelector('Representation');
      const audioChannelConfig = as.querySelector('AudioChannelConfiguration');

      tracks.push({
        id: as.getAttribute('id') || '',
        language: as.getAttribute('lang') || 'und',
        codecs: as.getAttribute('codecs') || rep?.getAttribute('codecs'),
        bandwidth: parseInt(rep?.getAttribute('bandwidth') || '0'),
        channels: audioChannelConfig ?
          parseInt(audioChannelConfig.getAttribute('value') || '2') : undefined,
        sampleRate: parseInt(
          as.getAttribute('audioSamplingRate') ||
          rep?.getAttribute('audioSamplingRate') || '0'
        ) || undefined,
        role: role?.getAttribute('value') || undefined,
      });
    });
  });

  return tracks;
}
```

### 4.4 Subtitles/Text Tracks

**Location:** Text AdaptationSets with `lang`, `mimeType`, and Role elements

```typescript
interface TextTrack {
  id: string;
  language: string;
  mimeType: string;
  role: string;  // 'subtitle', 'caption', 'forced-subtitle'
  label?: string;
}

function getTextTracks(periods: Element[]): TextTrack[] {
  const tracks: TextTrack[] = [];

  periods.forEach(period => {
    const textSets = period.querySelectorAll(
      'AdaptationSet[contentType="text"], ' +
      'AdaptationSet[mimeType^="text/"], ' +
      'AdaptationSet[mimeType="application/ttml+xml"]'
    );

    textSets.forEach(as => {
      const role = as.querySelector('Role');

      tracks.push({
        id: as.getAttribute('id') || '',
        language: as.getAttribute('lang') || 'und',
        mimeType: as.getAttribute('mimeType') || 'text/vtt',
        role: role?.getAttribute('value') || 'subtitle',
        label: as.getAttribute('label') || undefined,
      });
    });
  });

  return tracks;
}
```

---

## 5. Role and Accessibility Elements

### 5.1 Role Element

Specifies the purpose of media in an AdaptationSet.

**Scheme URI:** `urn:mpeg:dash:role:2011`

**Standard Role Values:**

| Value | Description |
|-------|-------------|
| `main` | Primary track for the content type |
| `alternate` | Alternate version |
| `supplementary` | Supplementary to main |
| `commentary` | Director/audio commentary |
| `dub` | Dubbed audio in different language |
| `caption` | Closed captions (for deaf/hard of hearing) |
| `subtitle` | Subtitles (translation) |
| `forced-subtitle` | Forced narrative subtitles (always shown) |
| `description` | Audio description for visually impaired |
| `sign` | Sign language interpretation |
| `emergency` | Emergency alert |

**Example:**
```xml
<AdaptationSet contentType="audio" lang="en">
  <Role schemeIdUri="urn:mpeg:dash:role:2011" value="main"/>
</AdaptationSet>

<AdaptationSet contentType="audio" lang="en">
  <Role schemeIdUri="urn:mpeg:dash:role:2011" value="description"/>
</AdaptationSet>
```

### 5.2 Accessibility Element

Used for accessibility features like CEA-608 captions.

**CEA-608 Captions:**
```xml
<AdaptationSet contentType="video">
  <Accessibility schemeIdUri="urn:scte:dash:cc:cea-608:2015" value="CC1=eng"/>
</AdaptationSet>
```

---

## 6. Segment Addressing

### 6.1 SegmentTemplate with Duration

For segments with uniform duration:

```xml
<SegmentTemplate
    timescale="90000"
    duration="540000"
    startNumber="1"
    initialization="init-$RepresentationID$.mp4"
    media="seg-$RepresentationID$-$Number$.m4s"/>
```

**Template Variables:**
- `$RepresentationID$` - Representation id attribute
- `$Number$` - Segment number (starting from startNumber)
- `$Time$` - Segment start time (in timescale units)
- `$Bandwidth$` - Representation bandwidth

### 6.2 SegmentTemplate with SegmentTimeline

For variable-duration segments (common in live):

```xml
<SegmentTemplate
    timescale="90000"
    initialization="init.mp4"
    media="seg-$Time$.m4s">
  <SegmentTimeline>
    <S t="0" d="540000" r="99"/>  <!-- 100 segments of same duration -->
    <S d="270000"/>               <!-- 1 segment of different duration -->
  </SegmentTimeline>
</SegmentTemplate>
```

**SegmentTimeline S Element:**
- `t` - Start time (optional, calculated from previous)
- `d` - Duration
- `r` - Repeat count (how many additional segments have same duration)

### 6.3 SegmentList

Explicit list of segments (larger MPD files):

```xml
<SegmentList duration="10">
  <Initialization sourceURL="init.mp4"/>
  <SegmentURL media="segment1.m4s"/>
  <SegmentURL media="segment2.m4s"/>
  <SegmentURL media="segment3.m4s"/>
</SegmentList>
```

### 6.4 BaseURL (Single Segment)

For on-demand content in a single file:

```xml
<BaseURL>video.mp4</BaseURL>
<SegmentBase indexRange="0-1000">
  <Initialization range="0-500"/>
</SegmentBase>
```

---

## 7. Common Codec Strings

### Video Codecs

| Codec | codecs String Pattern | Example |
|-------|----------------------|---------|
| H.264/AVC | `avc1.PPCCLL` | `avc1.64001f` (High Profile, Level 3.1) |
| H.265/HEVC | `hvc1.P.T.Lxx` or `hev1.P.T.Lxx` | `hvc1.1.6.L93.B0` |
| VP9 | `vp09.PP.LL.DD` | `vp09.00.10.08` |
| AV1 | `av01.P.LLM.DD` | `av01.0.04M.08` |

### Audio Codecs

| Codec | codecs String Pattern | Example |
|-------|----------------------|---------|
| AAC-LC | `mp4a.40.2` | `mp4a.40.2` |
| HE-AAC | `mp4a.40.5` | `mp4a.40.5` |
| HE-AAC v2 | `mp4a.40.29` | `mp4a.40.29` |
| xHE-AAC | `mp4a.40.42` | `mp4a.40.42` |
| AC-3 (Dolby Digital) | `ac-3` | `ac-3` |
| E-AC-3 (Dolby Digital Plus) | `ec-3` | `ec-3` |
| Opus | `opus` | `opus` |

---

## 8. Useful MPD Parsing Libraries

- **JavaScript:** [mpd-parser](https://github.com/videojs/mpd-parser) (used by Video.js)
- **JavaScript:** [shaka-player](https://github.com/shaka-project/shaka-player) (includes MPD parser)
- **JavaScript:** [dash.js](https://github.com/Dash-Industry-Forum/dash.js) (reference implementation)
- **Rust:** [dash-mpd](https://crates.io/crates/dash-mpd)
- **Python:** [mpegdash](https://pypi.org/project/mpegdash/)

---

## Sources

- [OTTVerse - Structure of a MPEG-DASH MPD](https://ottverse.com/structure-of-an-mpeg-dash-mpd/)
- [Brendan Long - The Structure of an MPEG-DASH MPD](https://www.brendanlong.com/the-structure-of-an-mpeg-dash-mpd.html)
- [Brendan Long - Common Informative Metadata in MPEG-DASH](https://www.brendanlong.com/common-informative-metadata-in-mpeg-dash.html)
- [DASH-IF Content Protection Identifiers](https://dashif.org/identifiers/content_protection/)
- [DASH-IF Subtitle and Closed Caption Identifiers](https://dashif.org/identifiers/subtitle_and_closed_captioning/)
- [Broadpeak - The DASH Format](https://developers.broadpeak.io/docs/foundations-dash)
- [Bitmovin - MPEG-DASH Dynamic Adaptive Streaming](https://bitmovin.com/blog/dynamic-adaptive-streaming-http-mpeg-dash/)
- [Microsoft Learn - DASH Content Protection using PlayReady](https://learn.microsoft.com/en-us/playready/specifications/mpeg-dash-playready)
- [AWS MediaTailor - DASH Manifest Types](https://docs.aws.amazon.com/mediatailor/latest/ug/dash-manifest-types.html)
- [Wikipedia - Dynamic Adaptive Streaming over HTTP](https://en.wikipedia.org/wiki/Dynamic_Adaptive_Streaming_over_HTTP)
- [DEV Community - URL and Timestamp of MPEG-DASH Segments](https://dev.to/sunfishshogi/url-and-timestamp-of-mpeg-dash-segments-2pdn)

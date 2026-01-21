# DASH MPD Analysis via curl

Analysis of two DASH test streams to understand MPD structure for PlaybackLab parsing.

## 1. Big Buck Bunny (Akamai CDN)

**URL:** `https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd`

### Raw MPD

```xml
<MPD mediaPresentationDuration="PT634.566S" minBufferTime="PT2.00S" profiles="urn:hbbtv:dash:profile:isoff-live:2012,urn:mpeg:dash:profile:isoff-live:2011" type="static" xmlns="urn:mpeg:dash:schema:mpd:2011" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:mpeg:DASH:schema:MPD:2011 DASH-MPD.xsd">
 <BaseURL>./</BaseURL>
 <Period>
  <AdaptationSet mimeType="video/mp4" contentType="video" subsegmentAlignment="true" subsegmentStartsWithSAP="1" par="16:9">
   <SegmentTemplate duration="120" timescale="30" media="$RepresentationID$/$RepresentationID$_$Number$.m4v" startNumber="1" initialization="$RepresentationID$/$RepresentationID$_0.m4v"/>
   <Representation id="bbb_30fps_1024x576_2500k" codecs="avc1.64001f" bandwidth="3134488" width="1024" height="576" frameRate="30" sar="1:1" scanType="progressive"/>
   <Representation id="bbb_30fps_1280x720_4000k" codecs="avc1.64001f" bandwidth="4952892" width="1280" height="720" frameRate="30" sar="1:1" scanType="progressive"/>
   <Representation id="bbb_30fps_1920x1080_8000k" codecs="avc1.640028" bandwidth="9914554" width="1920" height="1080" frameRate="30" sar="1:1" scanType="progressive"/>
   <Representation id="bbb_30fps_320x180_200k" codecs="avc1.64000d" bandwidth="254320" width="320" height="180" frameRate="30" sar="1:1" scanType="progressive"/>
   <Representation id="bbb_30fps_320x180_400k" codecs="avc1.64000d" bandwidth="507246" width="320" height="180" frameRate="30" sar="1:1" scanType="progressive"/>
   <Representation id="bbb_30fps_480x270_600k" codecs="avc1.640015" bandwidth="759798" width="480" height="270" frameRate="30" sar="1:1" scanType="progressive"/>
   <Representation id="bbb_30fps_640x360_1000k" codecs="avc1.64001e" bandwidth="1254758" width="640" height="360" frameRate="30" sar="1:1" scanType="progressive"/>
   <Representation id="bbb_30fps_640x360_800k" codecs="avc1.64001e" bandwidth="1013310" width="640" height="360" frameRate="30" sar="1:1" scanType="progressive"/>
   <Representation id="bbb_30fps_768x432_1500k" codecs="avc1.64001e" bandwidth="1883700" width="768" height="432" frameRate="30" sar="1:1" scanType="progressive"/>
   <Representation id="bbb_30fps_3840x2160_12000k" codecs="avc1.640033" bandwidth="14931538" width="3840" height="2160" frameRate="30" sar="1:1" scanType="progressive"/>
  </AdaptationSet>
  <AdaptationSet mimeType="audio/mp4" contentType="audio" subsegmentAlignment="true" subsegmentStartsWithSAP="1">
   <Accessibility schemeIdUri="urn:tva:metadata:cs:AudioPurposeCS:2007" value="6"/>
   <Role schemeIdUri="urn:mpeg:dash:role:2011" value="main"/>
   <SegmentTemplate duration="192512" timescale="48000" media="$RepresentationID$/$RepresentationID$_$Number$.m4a" startNumber="1" initialization="$RepresentationID$/$RepresentationID$_0.m4a"/>
   <Representation id="bbb_a64k" codecs="mp4a.40.5" bandwidth="67071" audioSamplingRate="48000">
    <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2"/>
   </Representation>
  </AdaptationSet>
 </Period>
</MPD>
```

### Structure Analysis

#### MPD Root Attributes
| Attribute | Value | Description |
|-----------|-------|-------------|
| `type` | `static` | VOD content (not live) |
| `mediaPresentationDuration` | `PT634.566S` | ~10 min 34 sec total duration |
| `minBufferTime` | `PT2.00S` | 2 second minimum buffer |
| `profiles` | `urn:hbbtv:dash:profile:isoff-live:2012, urn:mpeg:dash:profile:isoff-live:2011` | HbbTV + DASH-IF isoff-live profiles |

#### AdaptationSets

**1. Video AdaptationSet**
- `mimeType`: `video/mp4`
- `contentType`: `video`
- `par`: `16:9` (Pixel Aspect Ratio)
- `subsegmentAlignment`: `true`
- `subsegmentStartsWithSAP`: `1` (Stream Access Point type 1 - IDR frames)

**2. Audio AdaptationSet**
- `mimeType`: `audio/mp4`
- `contentType`: `audio`
- `Role`: `main`
- `Accessibility`: `urn:tva:metadata:cs:AudioPurposeCS:2007` value `6`

### Video Representations (10 variants)

| Resolution | Bitrate (bps) | Bitrate (human) | Codec | Frame Rate |
|------------|---------------|-----------------|-------|------------|
| 320x180 | 254,320 | ~248 kbps | avc1.64000d | 30 fps |
| 320x180 | 507,246 | ~495 kbps | avc1.64000d | 30 fps |
| 480x270 | 759,798 | ~742 kbps | avc1.640015 | 30 fps |
| 640x360 | 1,013,310 | ~990 kbps | avc1.64001e | 30 fps |
| 640x360 | 1,254,758 | ~1.2 Mbps | avc1.64001e | 30 fps |
| 768x432 | 1,883,700 | ~1.8 Mbps | avc1.64001e | 30 fps |
| 1024x576 | 3,134,488 | ~3.0 Mbps | avc1.64001f | 30 fps |
| 1280x720 | 4,952,892 | ~4.8 Mbps | avc1.64001f | 30 fps |
| 1920x1080 | 9,914,554 | ~9.5 Mbps | avc1.640028 | 30 fps |
| 3840x2160 | 14,931,538 | ~14.3 Mbps | avc1.640033 | 30 fps |

**Codec Analysis (AVC/H.264):**
- `avc1.64000d` - High Profile, Level 1.3 (low res)
- `avc1.640015` - High Profile, Level 2.1
- `avc1.64001e` - High Profile, Level 3.0
- `avc1.64001f` - High Profile, Level 3.1
- `avc1.640028` - High Profile, Level 4.0
- `avc1.640033` - High Profile, Level 5.1 (4K)

### Audio Representations (1 variant)

| Sample Rate | Bitrate | Codec | Channels |
|-------------|---------|-------|----------|
| 48000 Hz | 67,071 bps (~65 kbps) | mp4a.40.5 (HE-AAC) | 2 (stereo) |

### Segment Template
```
Video: $RepresentationID$/$RepresentationID$_$Number$.m4v
Audio: $RepresentationID$/$RepresentationID$_$Number$.m4a
```
- Segment duration: 4 seconds (120 / 30 timescale for video)
- Audio segment: 4.01 seconds (192512 / 48000 timescale)

### DRM / ContentProtection
**None** - This is an unencrypted test stream.

---

## 2. DASH-IF Live Simulator

**URL:** `https://livesim.dashif.org/livesim/testpic_2s/Manifest.mpd`
(Redirects to `https://livesim.dashif.org/livesim2/testpic_2s/Manifest.mpd`)

### Raw MPD

```xml
<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:mpeg:dash:schema:mpd:2011 DASH-MPD.xsd" profiles="urn:mpeg:dash:profile:isoff-live:2011,http://dashif.org/guidelines/dash-if-simple" type="dynamic" availabilityStartTime="1970-01-01T00:00:00Z" publishTime="1970-01-01T00:00:00Z" minimumUpdatePeriod="PT2S" minBufferTime="PT2S" timeShiftBufferDepth="PT1M" maxSegmentDuration="PT2S">
  <ProgramInformation moreInformationURL="https://github.com/dash-Industry-Forum/livesim-content">
    <Title>Basic MPD with 640x480@30 video at 300kbp and 48kbps audio</Title>
    <Source>VoD source for DASH-IF livesim2</Source>
  </ProgramInformation>
  <Period id="P0" start="PT0S">
    <AdaptationSet lang="en" contentType="audio" segmentAlignment="true" mimeType="audio/mp4" startWithSAP="1">
      <Role schemeIdUri="urn:mpeg:dash:role:2011" value="main"></Role>
      <SegmentTemplate media="$RepresentationID$/$Number$.m4s" initialization="$RepresentationID$/init.mp4" duration="2" startNumber="0"></SegmentTemplate>
      <Representation id="A48" bandwidth="48000" audioSamplingRate="48000" codecs="mp4a.40.2">
        <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2"></AudioChannelConfiguration>
      </Representation>
    </AdaptationSet>
    <AdaptationSet contentType="video" par="16:9" minWidth="640" maxWidth="640" minHeight="360" maxHeight="360" maxFrameRate="60/2" segmentAlignment="true" mimeType="video/mp4" startWithSAP="1">
      <Role schemeIdUri="urn:mpeg:dash:role:2011" value="main"></Role>
      <SegmentTemplate media="$RepresentationID$/$Number$.m4s" initialization="$RepresentationID$/init.mp4" duration="2" startNumber="0"></SegmentTemplate>
      <Representation id="V300" bandwidth="300000" width="640" height="360" sar="1:1" frameRate="60/2" codecs="avc1.64001e"></Representation>
    </AdaptationSet>
  </Period>
  <UTCTiming schemeIdUri="urn:mpeg:dash:utc:http-xsdate:2014" value="https://time.akamai.com/?iso&amp;ms"></UTCTiming>
</MPD>
```

### Structure Analysis

#### MPD Root Attributes
| Attribute | Value | Description |
|-----------|-------|-------------|
| `type` | `dynamic` | **LIVE** content |
| `availabilityStartTime` | `1970-01-01T00:00:00Z` | Unix epoch (simulated live) |
| `publishTime` | `1970-01-01T00:00:00Z` | When MPD was published |
| `minimumUpdatePeriod` | `PT2S` | Refresh MPD every 2 seconds |
| `minBufferTime` | `PT2S` | 2 second minimum buffer |
| `timeShiftBufferDepth` | `PT1M` | 1 minute DVR window |
| `maxSegmentDuration` | `PT2S` | Max 2 second segments |
| `profiles` | `urn:mpeg:dash:profile:isoff-live:2011, http://dashif.org/guidelines/dash-if-simple` | DASH-IF Simple profile |

#### Key Differences from VOD (BBB)
1. `type="dynamic"` instead of `static`
2. Has `minimumUpdatePeriod` for live manifest refresh
3. Has `timeShiftBufferDepth` for DVR capability
4. Uses `UTCTiming` element for clock sync
5. No `mediaPresentationDuration` (infinite/live)

#### AdaptationSets

**1. Audio AdaptationSet**
- `lang`: `en`
- `mimeType`: `audio/mp4`
- `contentType`: `audio`
- `Role`: `main`

**2. Video AdaptationSet**
- `mimeType`: `video/mp4`
- `contentType`: `video`
- `par`: `16:9`
- `minWidth/maxWidth`: `640`
- `minHeight/maxHeight`: `360`
- `maxFrameRate`: `60/2` (30 fps)

### Video Representations (1 variant)

| Resolution | Bitrate | Codec | Frame Rate |
|------------|---------|-------|------------|
| 640x360 | 300,000 bps (300 kbps) | avc1.64001e (H.264 High 3.0) | 30 fps |

### Audio Representations (1 variant)

| Sample Rate | Bitrate | Codec | Channels |
|-------------|---------|-------|----------|
| 48000 Hz | 48,000 bps (48 kbps) | mp4a.40.2 (AAC-LC) | 2 (stereo) |

### Segment Template
```
Video/Audio: $RepresentationID$/$Number$.m4s
Init: $RepresentationID$/init.mp4
```
- Segment duration: 2 seconds
- Start number: 0

### UTCTiming Element
```xml
<UTCTiming schemeIdUri="urn:mpeg:dash:utc:http-xsdate:2014" value="https://time.akamai.com/?iso&amp;ms"/>
```
Used for client clock synchronization in live streams.

### DRM / ContentProtection
**None** - This is an unencrypted test stream.

---

## Comparison Summary

| Feature | Big Buck Bunny (VOD) | DASH-IF Live Sim |
|---------|---------------------|------------------|
| Type | `static` (VOD) | `dynamic` (Live) |
| Duration | 634.566 seconds | Infinite (live) |
| Video Variants | 10 (180p to 4K) | 1 (360p only) |
| Audio Variants | 1 | 1 |
| Max Resolution | 3840x2160 | 640x360 |
| Video Codec | H.264 High Profile | H.264 High Profile |
| Audio Codec | HE-AAC | AAC-LC |
| Segment Duration | 4 seconds | 2 seconds |
| DVR Window | N/A | 1 minute |
| MPD Refresh | N/A | 2 seconds |
| UTCTiming | No | Yes |
| DRM | None | None |

---

## Key Parsing Insights for PlaybackLab

### Required Fields to Extract

1. **MPD Level:**
   - `type` (static/dynamic)
   - `mediaPresentationDuration` (VOD only)
   - `minBufferTime`
   - `minimumUpdatePeriod` (live only)
   - `timeShiftBufferDepth` (live DVR)

2. **AdaptationSet Level:**
   - `contentType` (video/audio/text)
   - `mimeType`
   - `lang` (for audio/text)
   - `par` (pixel aspect ratio)
   - `Role` element

3. **Representation Level:**
   - `bandwidth` (bits per second)
   - `width`, `height` (video)
   - `codecs`
   - `frameRate` (video)
   - `audioSamplingRate` (audio)
   - `AudioChannelConfiguration`

4. **SegmentTemplate:**
   - `duration` / `timescale`
   - `media` pattern
   - `initialization` pattern
   - `startNumber`

5. **DRM (ContentProtection):**
   - `schemeIdUri` (e.g., `urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed` for Widevine)
   - `cenc:default_KID`
   - Child elements for license server URLs

### Codec String Parsing

AVC/H.264 codec strings follow pattern: `avc1.PPCCLL`
- `PP` = Profile (64 = High, 4D = Main, 42 = Baseline)
- `CC` = Constraints (usually 00)
- `LL` = Level (0d=1.3, 15=2.1, 1e=3.0, 1f=3.1, 28=4.0, 33=5.1)

AAC codec strings:
- `mp4a.40.2` = AAC-LC (Low Complexity)
- `mp4a.40.5` = HE-AAC (High Efficiency AAC)
- `mp4a.40.29` = HE-AACv2 (with Parametric Stereo)

### Live vs VOD Detection

```javascript
const isLive = mpd.getAttribute('type') === 'dynamic';
const hasMinimumUpdatePeriod = mpd.hasAttribute('minimumUpdatePeriod');
const hasDuration = mpd.hasAttribute('mediaPresentationDuration');
```

---

## Test URLs for PlaybackLab

### VOD Streams
- Big Buck Bunny: `https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd`

### Live Streams
- DASH-IF testpic: `https://livesim.dashif.org/livesim/testpic_2s/Manifest.mpd`
- DASH-IF with multiple bitrates: `https://livesim.dashif.org/livesim2/segtimeline_1/testpic_2s/Manifest.mpd`

### DRM Streams (for future testing)
- Axinom DRM samples: `https://media.axprod.net/TestVectors/`
- DASH-IF DRM samples: `https://reference.dashif.org/dash.js/nightly/samples/drm/`

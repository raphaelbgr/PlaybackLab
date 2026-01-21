# HLS Test Stream Analysis via cURL

This document contains raw manifest analysis of two HLS test streams, documenting all tags present and extractable data.

---

## Stream 1: Mux Test Stream

**URL:** `https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8`

### Raw Manifest

```m3u8
#EXTM3U
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=2149280,CODECS="mp4a.40.2,avc1.64001f",RESOLUTION=1280x720,NAME="720"
url_0/193039199_mp4_h264_aac_hd_7.m3u8
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=246440,CODECS="mp4a.40.5,avc1.42000d",RESOLUTION=320x184,NAME="240"
url_2/193039199_mp4_h264_aac_ld_7.m3u8
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=460560,CODECS="mp4a.40.5,avc1.420016",RESOLUTION=512x288,NAME="380"
url_4/193039199_mp4_h264_aac_7.m3u8
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=836280,CODECS="mp4a.40.2,avc1.64001f",RESOLUTION=848x480,NAME="480"
url_6/193039199_mp4_h264_aac_hq_7.m3u8
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=6221600,CODECS="mp4a.40.2,avc1.640028",RESOLUTION=1920x1080,NAME="1080"
url_8/193039199_mp4_h264_aac_fhd_7.m3u8
```

### Tags Present

| Tag | Description |
|-----|-------------|
| `#EXTM3U` | File header - identifies this as an M3U playlist |
| `#EXT-X-STREAM-INF` | Variant stream information |

### EXT-X-STREAM-INF Attributes

| Attribute | Description | Values Found |
|-----------|-------------|--------------|
| `PROGRAM-ID` | (Deprecated) Program identifier | `1` |
| `BANDWIDTH` | Peak bitrate in bits/second | `246440` to `6221600` |
| `CODECS` | RFC 6381 codec strings | See codec table below |
| `RESOLUTION` | Video dimensions (width x height) | `320x184` to `1920x1080` |
| `NAME` | Human-readable variant name | `"240"`, `"380"`, `"480"`, `"720"`, `"1080"` |

### Extractable Data

#### Video Variants

| NAME | Resolution | Bandwidth (bps) | Bandwidth (Mbps) | Video Codec | Audio Codec | URL |
|------|------------|-----------------|------------------|-------------|-------------|-----|
| 240 | 320x184 | 246,440 | 0.25 | avc1.42000d (H.264 Baseline L1.3) | mp4a.40.5 (AAC HE) | url_2/193039199_mp4_h264_aac_ld_7.m3u8 |
| 380 | 512x288 | 460,560 | 0.46 | avc1.420016 (H.264 Baseline L2.2) | mp4a.40.5 (AAC HE) | url_4/193039199_mp4_h264_aac_7.m3u8 |
| 480 | 848x480 | 836,280 | 0.84 | avc1.64001f (H.264 High L3.1) | mp4a.40.2 (AAC LC) | url_6/193039199_mp4_h264_aac_hq_7.m3u8 |
| 720 | 1280x720 | 2,149,280 | 2.15 | avc1.64001f (H.264 High L3.1) | mp4a.40.2 (AAC LC) | url_0/193039199_mp4_h264_aac_hd_7.m3u8 |
| 1080 | 1920x1080 | 6,221,600 | 6.22 | avc1.640028 (H.264 High L4.0) | mp4a.40.2 (AAC LC) | url_8/193039199_mp4_h264_aac_fhd_7.m3u8 |

#### Audio Tracks

- **None defined separately** - Audio is muxed with video (single CODECS string contains both)

#### Subtitles/Captions

- **None present**

#### DRM Tags

- **None present** - This is a clear (unencrypted) stream

### Codec Analysis

**Video Codecs:**
- `avc1.42000d` - H.264 Baseline Profile, Level 1.3
- `avc1.420016` - H.264 Baseline Profile, Level 2.2
- `avc1.64001f` - H.264 High Profile, Level 3.1
- `avc1.640028` - H.264 High Profile, Level 4.0

**Audio Codecs:**
- `mp4a.40.5` - AAC HE (High Efficiency) - used for lower bitrates
- `mp4a.40.2` - AAC LC (Low Complexity) - used for higher bitrates

### Notes

- Simple master playlist with 5 variants
- No separate audio renditions
- No I-frame playlists (no trick-play support)
- Uses deprecated `PROGRAM-ID` attribute
- Clear stream (no encryption)

---

## Stream 2: Apple Bipbop Advanced (fMP4)

**URL:** `https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8`

### Raw Manifest

```m3u8
#EXTM3U
#EXT-X-VERSION:6
#EXT-X-INDEPENDENT-SEGMENTS


#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=2168183,BANDWIDTH=2177116,CODECS="avc1.640020,mp4a.40.2",RESOLUTION=960x540,FRAME-RATE=60.000,CLOSED-CAPTIONS="cc1",AUDIO="aud1",SUBTITLES="sub1"
v5/prog_index.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=7968416,BANDWIDTH=8001098,CODECS="avc1.64002a,mp4a.40.2",RESOLUTION=1920x1080,FRAME-RATE=60.000,CLOSED-CAPTIONS="cc1",AUDIO="aud1",SUBTITLES="sub1"
v9/prog_index.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=6170000,BANDWIDTH=6312875,CODECS="avc1.64002a,mp4a.40.2",RESOLUTION=1920x1080,FRAME-RATE=60.000,CLOSED-CAPTIONS="cc1",AUDIO="aud1",SUBTITLES="sub1"
v8/prog_index.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=4670769,BANDWIDTH=4943747,CODECS="avc1.64002a,mp4a.40.2",RESOLUTION=1920x1080,FRAME-RATE=60.000,CLOSED-CAPTIONS="cc1",AUDIO="aud1",SUBTITLES="sub1"
v7/prog_index.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=3168702,BANDWIDTH=3216424,CODECS="avc1.640020,mp4a.40.2",RESOLUTION=1280x720,FRAME-RATE=60.000,CLOSED-CAPTIONS="cc1",AUDIO="aud1",SUBTITLES="sub1"
v6/prog_index.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=1265132,BANDWIDTH=1268994,CODECS="avc1.64001e,mp4a.40.2",RESOLUTION=768x432,FRAME-RATE=30.000,CLOSED-CAPTIONS="cc1",AUDIO="aud1",SUBTITLES="sub1"
v4/prog_index.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=895755,BANDWIDTH=902298,CODECS="avc1.64001e,mp4a.40.2",RESOLUTION=640x360,FRAME-RATE=30.000,CLOSED-CAPTIONS="cc1",AUDIO="aud1",SUBTITLES="sub1"
v3/prog_index.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=530721,BANDWIDTH=541052,CODECS="avc1.640015,mp4a.40.2",RESOLUTION=480x270,FRAME-RATE=30.000,CLOSED-CAPTIONS="cc1",AUDIO="aud1",SUBTITLES="sub1"
v2/prog_index.m3u8


#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=2390686,BANDWIDTH=2399619,CODECS="avc1.640020,ac-3",RESOLUTION=960x540,FRAME-RATE=60.000,CLOSED-CAPTIONS="cc1",AUDIO="aud2",SUBTITLES="sub1"
v5/prog_index.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=8190919,BANDWIDTH=8223601,CODECS="avc1.64002a,ac-3",RESOLUTION=1920x1080,FRAME-RATE=60.000,CLOSED-CAPTIONS="cc1",AUDIO="aud2",SUBTITLES="sub1"
v9/prog_index.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=6392503,BANDWIDTH=6535378,CODECS="avc1.64002a,ac-3",RESOLUTION=1920x1080,FRAME-RATE=60.000,CLOSED-CAPTIONS="cc1",AUDIO="aud2",SUBTITLES="sub1"
v8/prog_index.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=4893272,BANDWIDTH=5166250,CODECS="avc1.64002a,ac-3",RESOLUTION=1920x1080,FRAME-RATE=60.000,CLOSED-CAPTIONS="cc1",AUDIO="aud2",SUBTITLES="sub1"
v7/prog_index.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=3391205,BANDWIDTH=3438927,CODECS="avc1.640020,ac-3",RESOLUTION=1280x720,FRAME-RATE=60.000,CLOSED-CAPTIONS="cc1",AUDIO="aud2",SUBTITLES="sub1"
v6/prog_index.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=1487635,BANDWIDTH=1491497,CODECS="avc1.64001e,ac-3",RESOLUTION=768x432,FRAME-RATE=30.000,CLOSED-CAPTIONS="cc1",AUDIO="aud2",SUBTITLES="sub1"
v4/prog_index.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=1118258,BANDWIDTH=1124801,CODECS="avc1.64001e,ac-3",RESOLUTION=640x360,FRAME-RATE=30.000,CLOSED-CAPTIONS="cc1",AUDIO="aud2",SUBTITLES="sub1"
v3/prog_index.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=753224,BANDWIDTH=763555,CODECS="avc1.640015,ac-3",RESOLUTION=480x270,FRAME-RATE=30.000,CLOSED-CAPTIONS="cc1",AUDIO="aud2",SUBTITLES="sub1"
v2/prog_index.m3u8


#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=2198686,BANDWIDTH=2207619,CODECS="avc1.640020,ec-3",RESOLUTION=960x540,FRAME-RATE=60.000,CLOSED-CAPTIONS="cc1",AUDIO="aud3",SUBTITLES="sub1"
v5/prog_index.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=7998919,BANDWIDTH=8031601,CODECS="avc1.64002a,ec-3",RESOLUTION=1920x1080,FRAME-RATE=60.000,CLOSED-CAPTIONS="cc1",AUDIO="aud3",SUBTITLES="sub1"
v9/prog_index.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=6200503,BANDWIDTH=6343378,CODECS="avc1.64002a,ec-3",RESOLUTION=1920x1080,FRAME-RATE=60.000,CLOSED-CAPTIONS="cc1",AUDIO="aud3",SUBTITLES="sub1"
v8/prog_index.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=4701272,BANDWIDTH=4974250,CODECS="avc1.64002a,ec-3",RESOLUTION=1920x1080,FRAME-RATE=60.000,CLOSED-CAPTIONS="cc1",AUDIO="aud3",SUBTITLES="sub1"
v7/prog_index.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=3199205,BANDWIDTH=3246927,CODECS="avc1.640020,ec-3",RESOLUTION=1280x720,FRAME-RATE=60.000,CLOSED-CAPTIONS="cc1",AUDIO="aud3",SUBTITLES="sub1"
v6/prog_index.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=1295635,BANDWIDTH=1299497,CODECS="avc1.64001e,ec-3",RESOLUTION=768x432,FRAME-RATE=30.000,CLOSED-CAPTIONS="cc1",AUDIO="aud3",SUBTITLES="sub1"
v4/prog_index.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=926258,BANDWIDTH=932801,CODECS="avc1.64001e,ec-3",RESOLUTION=640x360,FRAME-RATE=30.000,CLOSED-CAPTIONS="cc1",AUDIO="aud3",SUBTITLES="sub1"
v3/prog_index.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=561224,BANDWIDTH=571555,CODECS="avc1.640015,ec-3",RESOLUTION=480x270,FRAME-RATE=30.000,CLOSED-CAPTIONS="cc1",AUDIO="aud3",SUBTITLES="sub1"
v2/prog_index.m3u8


#EXT-X-I-FRAME-STREAM-INF:AVERAGE-BANDWIDTH=183689,BANDWIDTH=187492,CODECS="avc1.64002a",RESOLUTION=1920x1080,URI="v7/iframe_index.m3u8"
#EXT-X-I-FRAME-STREAM-INF:AVERAGE-BANDWIDTH=132672,BANDWIDTH=136398,CODECS="avc1.640020",RESOLUTION=1280x720,URI="v6/iframe_index.m3u8"
#EXT-X-I-FRAME-STREAM-INF:AVERAGE-BANDWIDTH=97767,BANDWIDTH=101378,CODECS="avc1.640020",RESOLUTION=960x540,URI="v5/iframe_index.m3u8"
#EXT-X-I-FRAME-STREAM-INF:AVERAGE-BANDWIDTH=75722,BANDWIDTH=77818,CODECS="avc1.64001e",RESOLUTION=768x432,URI="v4/iframe_index.m3u8"
#EXT-X-I-FRAME-STREAM-INF:AVERAGE-BANDWIDTH=63522,BANDWIDTH=65091,CODECS="avc1.64001e",RESOLUTION=640x360,URI="v3/iframe_index.m3u8"
#EXT-X-I-FRAME-STREAM-INF:AVERAGE-BANDWIDTH=39678,BANDWIDTH=40282,CODECS="avc1.640015",RESOLUTION=480x270,URI="v2/iframe_index.m3u8"


#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud1",LANGUAGE="en",NAME="English",AUTOSELECT=YES,DEFAULT=YES,CHANNELS="2",URI="a1/prog_index.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud2",LANGUAGE="en",NAME="English",AUTOSELECT=YES,DEFAULT=YES,CHANNELS="6",URI="a2/prog_index.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud3",LANGUAGE="en",NAME="English",AUTOSELECT=YES,DEFAULT=YES,CHANNELS="6",URI="a3/prog_index.m3u8"


#EXT-X-MEDIA:TYPE=CLOSED-CAPTIONS,GROUP-ID="cc1",LANGUAGE="en",NAME="English",AUTOSELECT=YES,DEFAULT=YES,INSTREAM-ID="CC1"


#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="sub1",LANGUAGE="en",NAME="English",AUTOSELECT=YES,DEFAULT=YES,FORCED=NO,URI="s1/en/prog_index.m3u8"
```

### Tags Present

| Tag | Description |
|-----|-------------|
| `#EXTM3U` | File header - identifies this as an M3U playlist |
| `#EXT-X-VERSION` | HLS protocol version (version 6) |
| `#EXT-X-INDEPENDENT-SEGMENTS` | Indicates media segments can be decoded independently |
| `#EXT-X-STREAM-INF` | Variant stream information |
| `#EXT-X-I-FRAME-STREAM-INF` | I-frame only variant for trick-play |
| `#EXT-X-MEDIA` | Alternate renditions (audio, subtitles, closed captions) |

### EXT-X-STREAM-INF Attributes

| Attribute | Description | Values Found |
|-----------|-------------|--------------|
| `AVERAGE-BANDWIDTH` | Average segment bitrate | `530721` to `8190919` |
| `BANDWIDTH` | Peak segment bitrate | `541052` to `8223601` |
| `CODECS` | RFC 6381 codec strings | Multiple combinations |
| `RESOLUTION` | Video dimensions | `480x270` to `1920x1080` |
| `FRAME-RATE` | Video frame rate | `30.000`, `60.000` |
| `CLOSED-CAPTIONS` | Closed caption group reference | `"cc1"` |
| `AUDIO` | Audio group reference | `"aud1"`, `"aud2"`, `"aud3"` |
| `SUBTITLES` | Subtitle group reference | `"sub1"` |

### EXT-X-I-FRAME-STREAM-INF Attributes

| Attribute | Description | Values Found |
|-----------|-------------|--------------|
| `AVERAGE-BANDWIDTH` | Average I-frame bitrate | `39678` to `183689` |
| `BANDWIDTH` | Peak I-frame bitrate | `40282` to `187492` |
| `CODECS` | Video codec only | `avc1.640015`, `avc1.64001e`, `avc1.640020`, `avc1.64002a` |
| `RESOLUTION` | Video dimensions | `480x270` to `1920x1080` |
| `URI` | I-frame playlist location | `v2/iframe_index.m3u8` to `v7/iframe_index.m3u8` |

### EXT-X-MEDIA Attributes

| Attribute | Description | Values Found |
|-----------|-------------|--------------|
| `TYPE` | Media type | `AUDIO`, `CLOSED-CAPTIONS`, `SUBTITLES` |
| `GROUP-ID` | Group identifier | `"aud1"`, `"aud2"`, `"aud3"`, `"cc1"`, `"sub1"` |
| `LANGUAGE` | Language code | `"en"` |
| `NAME` | Human-readable name | `"English"` |
| `AUTOSELECT` | Auto-select flag | `YES` |
| `DEFAULT` | Default selection flag | `YES` |
| `CHANNELS` | Audio channel count | `"2"`, `"6"` |
| `URI` | Rendition playlist URL | Audio and subtitle URIs |
| `INSTREAM-ID` | CEA-608/708 identifier | `"CC1"` |
| `FORCED` | Forced subtitle flag | `NO` |

### Extractable Data

#### Video Variants (Unique Resolutions with AAC Audio Group)

| Resolution | Frame Rate | Avg Bandwidth | Peak Bandwidth | Video Codec | Audio Group | URL |
|------------|------------|---------------|----------------|-------------|-------------|-----|
| 480x270 | 30 fps | 530,721 | 541,052 | avc1.640015 (H.264 High L2.1) | aud1 | v2/prog_index.m3u8 |
| 640x360 | 30 fps | 895,755 | 902,298 | avc1.64001e (H.264 High L3.0) | aud1 | v3/prog_index.m3u8 |
| 768x432 | 30 fps | 1,265,132 | 1,268,994 | avc1.64001e (H.264 High L3.0) | aud1 | v4/prog_index.m3u8 |
| 960x540 | 60 fps | 2,168,183 | 2,177,116 | avc1.640020 (H.264 High L3.2) | aud1 | v5/prog_index.m3u8 |
| 1280x720 | 60 fps | 3,168,702 | 3,216,424 | avc1.640020 (H.264 High L3.2) | aud1 | v6/prog_index.m3u8 |
| 1920x1080 | 60 fps | 4,670,769 | 4,943,747 | avc1.64002a (H.264 High L4.2) | aud1 | v7/prog_index.m3u8 |
| 1920x1080 | 60 fps | 6,170,000 | 6,312,875 | avc1.64002a (H.264 High L4.2) | aud1 | v8/prog_index.m3u8 |
| 1920x1080 | 60 fps | 7,968,416 | 8,001,098 | avc1.64002a (H.264 High L4.2) | aud1 | v9/prog_index.m3u8 |

**Total Variants:** 24 (8 resolutions x 3 audio groups)

#### Audio Tracks

| Group ID | Name | Language | Channels | Codec | URI |
|----------|------|----------|----------|-------|-----|
| aud1 | English | en | 2 (Stereo) | mp4a.40.2 (AAC LC) | a1/prog_index.m3u8 |
| aud2 | English | en | 6 (5.1 Surround) | ac-3 (Dolby AC-3) | a2/prog_index.m3u8 |
| aud3 | English | en | 6 (5.1 Surround) | ec-3 (Dolby E-AC-3) | a3/prog_index.m3u8 |

#### Subtitles

| Group ID | Name | Language | Type | Forced | URI |
|----------|------|----------|------|--------|-----|
| sub1 | English | en | WebVTT | No | s1/en/prog_index.m3u8 |

#### Closed Captions

| Group ID | Name | Language | Instream ID |
|----------|------|----------|-------------|
| cc1 | English | en | CC1 (CEA-608 line 21) |

#### I-Frame Playlists (Trick Play)

| Resolution | Avg Bandwidth | Peak Bandwidth | Video Codec | URI |
|------------|---------------|----------------|-------------|-----|
| 480x270 | 39,678 | 40,282 | avc1.640015 | v2/iframe_index.m3u8 |
| 640x360 | 63,522 | 65,091 | avc1.64001e | v3/iframe_index.m3u8 |
| 768x432 | 75,722 | 77,818 | avc1.64001e | v4/iframe_index.m3u8 |
| 960x540 | 97,767 | 101,378 | avc1.640020 | v5/iframe_index.m3u8 |
| 1280x720 | 132,672 | 136,398 | avc1.640020 | v6/iframe_index.m3u8 |
| 1920x1080 | 183,689 | 187,492 | avc1.64002a | v7/iframe_index.m3u8 |

#### DRM Tags

- **None present** - This is a clear (unencrypted) stream

### Codec Analysis

**Video Codecs:**
- `avc1.640015` - H.264 High Profile, Level 2.1
- `avc1.64001e` - H.264 High Profile, Level 3.0
- `avc1.640020` - H.264 High Profile, Level 3.2
- `avc1.64002a` - H.264 High Profile, Level 4.2

**Audio Codecs:**
- `mp4a.40.2` - AAC LC (Low Complexity) - 2 channels
- `ac-3` - Dolby Digital (AC-3) - 6 channels (5.1 surround)
- `ec-3` - Dolby Digital Plus (E-AC-3) - 6 channels (5.1 surround)

### Notes

- HLS Version 6 (supports fMP4 segments)
- Uses `EXT-X-INDEPENDENT-SEGMENTS` for better ABR switching
- Multiple audio renditions with different codecs (AAC, AC-3, E-AC-3)
- Proper use of `AVERAGE-BANDWIDTH` for smoother ABR decisions
- Includes I-frame playlists for trick-play (fast-forward/rewind)
- In-band CEA-608 closed captions
- WebVTT subtitles as separate rendition
- High frame rate content (60 fps for HD resolutions)
- Three 1080p variants at different bitrates for quality ladder
- Clear stream (no encryption)

---

## Comparison Summary

| Feature | Mux Test Stream | Apple Bipbop |
|---------|-----------------|--------------|
| HLS Version | Not specified (v1) | 6 |
| Video Variants | 5 | 8 (24 with audio combos) |
| Resolutions | 320x184 to 1920x1080 | 480x270 to 1920x1080 |
| Max Bitrate | 6.2 Mbps | 8.0 Mbps |
| Frame Rates | Not specified | 30/60 fps |
| Audio Tracks | Muxed only | 3 separate renditions |
| Audio Codecs | AAC LC, AAC HE | AAC LC, AC-3, E-AC-3 |
| Subtitles | None | WebVTT (English) |
| Closed Captions | None | CEA-608 in-band |
| I-Frame Playlists | None | 6 variants |
| DRM | None | None |
| AVERAGE-BANDWIDTH | No | Yes |
| Independent Segments | No | Yes |

---

## DRM Tag Reference (Not Present in These Streams)

For reference, DRM-protected HLS streams would include these tags:

| Tag | Description |
|-----|-------------|
| `#EXT-X-KEY` | Encryption key information |
| `#EXT-X-SESSION-KEY` | Session-level encryption key |
| `#EXT-X-FAXS-CM` | Adobe Access/Primetime DRM |

### EXT-X-KEY Attributes (when present)

| Attribute | Description |
|-----------|-------------|
| `METHOD` | Encryption method: `NONE`, `AES-128`, `SAMPLE-AES`, `SAMPLE-AES-CTR` |
| `URI` | Key file or license server URL |
| `IV` | Initialization vector (hex) |
| `KEYFORMAT` | Key format identifier (e.g., `com.apple.streamingkeydelivery`) |
| `KEYFORMATVERSIONS` | Supported key format versions |

### Common DRM KEYFORMAT Values

- `identity` - Clear key AES-128
- `com.apple.streamingkeydelivery` - FairPlay Streaming
- `urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed` - Widevine (CENC)
- `urn:uuid:9a04f079-9840-4286-ab92-e65be0885f95` - PlayReady (CENC)

---

## Implementation Notes for PlaybackLab

### Data to Extract from Master Playlists

1. **Basic Info**
   - HLS version (`#EXT-X-VERSION`)
   - Independent segments flag

2. **Video Variants**
   - Resolution (width x height)
   - Bandwidth (peak and average)
   - Frame rate
   - Video codec string + decoded profile/level
   - Relative/absolute URI

3. **Audio Renditions**
   - Language and name
   - Channel count
   - Codec (decoded)
   - Group ID for variant association
   - Default/autoselect flags

4. **Subtitles**
   - Language and name
   - Type (WebVTT, etc.)
   - Forced flag
   - URI

5. **Closed Captions**
   - Language
   - Instream ID (CC1, CC2, SERVICE1, etc.)

6. **I-Frame Variants**
   - Resolution
   - Bandwidth
   - URI (for trick-play support detection)

7. **DRM Detection**
   - Check for `#EXT-X-KEY` with non-`NONE` method
   - Parse `KEYFORMAT` to identify DRM system
   - Extract license server URI if present

### Parsing Libraries

- **m3u8-parser** (already installed) - Handles most HLS parsing
- Consider extracting raw tag data for edge cases not handled by parser

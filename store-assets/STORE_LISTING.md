# PlaybackLab - Chrome Web Store Listing

All text content ready to copy-paste into the Chrome Web Store Developer Dashboard.

---

## Extension Name

```
PlaybackLab - HLS & DASH Stream Debugger
```

(57 characters / 75 max)

---

## Summary

```
Inspect HLS & DASH video streams in DevTools. Analyze manifests, codecs, quality tiers, DRM, and playback metrics in real time.
```

(128 characters / 132 max)

---

## Full Description

```
PlaybackLab is a Chrome DevTools extension for video streaming developers to test, debug, and analyze HLS, DASH, and DRM video streams.

FEATURES

Stream Detection
- Automatically detects HLS (.m3u8) and DASH (.mpd) streams on any page
- 40+ CDN and platform detection (Akamai, Cloudflare, Fastly, AWS, YouTube, Twitch, Netflix, and more)
- Segment tracking under parent streams
- Native MP4/WebM identification

Manifest Analysis
- Full HLS master + media playlist parsing with variant ladder display
- DASH MPD parsing with periods, adaptation sets, and representations
- Video codec details: H.264, HEVC, VP9, AV1 with profile and level
- Audio codec details with branded names: Dolby Digital, Dolby Atmos, AAC-LC, HE-AAC, Opus
- Quality tier badges: SD, HD, Full HD, QHD, 4K UHD, 8K UHD
- HDR detection: HDR10, HDR10+, Dolby Vision, HLG
- Frame rate and aspect ratio display

MiniPlayer Preview
- Built-in video player for quick stream testing
- Supports HLS (via hls.js) and DASH (via dash.js) playback
- Smart error classification: authentication, CORS, token expiry, DRM, network errors

Video Overlays
- Persistent debug overlays on all page video elements
- Stream type badges (HLS, DASH, VIDEO) matching the app's design
- One-click Inspect to jump to the stream in DevTools
- Copy URL button for manifest URLs
- Player library detection (HLS.js, dash.js, Shaka Player)

Network Inspector
- Per-stream network request filtering
- Manifest, segment, key, and init request classification
- Request timing and size tracking

Ad Detection
- VAST/VMAP ad request detection
- IMA and FreeWheel ad framework support
- Configurable ad URL filtering

Export
- Export stream data as JSON
- Generate cURL commands for manifest URLs

KEYBOARD SHORTCUTS
- Ctrl+K: Command palette
- Additional shortcuts available in the command palette

PERMISSIONS EXPLAINED
- webRequest: Required to detect HLS/DASH stream URLs in network traffic
- tabs: Required to associate streams with browser tabs
- activeTab: Required for video overlay injection
- scripting: Required for main-world bridge to detect player libraries
- host_permissions (<all_urls>): Required to intercept stream URLs on any website

PlaybackLab is built for video streaming developers, QA engineers, and OTT platform engineers who need to debug adaptive bitrate streaming.

Open source: https://github.com/raphaelbgr/PlaybackLab
```

---

## Category

```
Developer Tools
```

---

## Language

```
English
```

---

## Single Purpose Statement

```
PlaybackLab inspects and debugs HLS and DASH video streams. It detects adaptive bitrate streams in network traffic, parses their manifests to display video/audio variants with codec and quality details, provides a built-in player for quick testing, and overlays debug information on page video elements.
```

(299 characters / 1,000 max)

---

## Privacy Practices

### Single Purpose Description
```
This extension provides a DevTools panel for inspecting and debugging HLS and DASH video streams detected in network traffic.
```

### Permission Justifications

| Permission | Justification |
|------------|---------------|
| `webRequest` | Required to monitor network requests and detect HLS (.m3u8) and DASH (.mpd) stream URLs as they are loaded by the page. |
| `tabs` | Required to associate detected streams with the correct browser tab and track tab lifecycle (close, navigate). |
| `activeTab` | Required to inject video overlay elements on the currently active tab when the user enables the overlay feature. |
| `scripting` | Required to execute scripts in the page's main world to detect player library instances (HLS.js, dash.js, Shaka Player) attached to video elements. |
| `host_permissions (<all_urls>)` | Required to intercept HLS/DASH stream URLs on any website, since video streams can be served from any domain or CDN. |

### Data Usage
```
This extension does not collect, transmit, or store any user data. All stream analysis is performed locally in the browser. No analytics, telemetry, or tracking is included.
```

---

## Required Assets

### Icons (included in extension package)
| Size | File | Purpose |
|------|------|---------|
| 16x16 | `public/icon-16.png` | Toolbar, favicon |
| 32x32 | `public/icon-32.png` | Windows taskbar |
| 48x48 | `public/icon-48.png` | Extensions management page |
| 128x128 | `public/icon-128.png` | Chrome Web Store, install dialog |

### Screenshots (YOU must capture these)

Take 5 screenshots at **1280x800** pixels showing:

1. **Main View** - DevTools panel with stream list on left, parsed HLS manifest on right showing video variants with codec tags and audio tracks
2. **Quality Ladder** - Close-up of a multi-bitrate stream showing all quality tiers (SD to 4K) with color-coded tags
3. **MiniPlayer** - Stream playing in the MiniPlayer preview with quality information
4. **Video Overlays** - A page with multiple video elements showing HLS/DASH/VIDEO badges with Inspect and Copy URL buttons
5. **Network + Export** - Network request inspector filtered to a stream, showing manifest/segment requests with timing

**How to capture:**
1. Run `npm run dev` to start the extension
2. Open a page with video streams (e.g., `test-streams.html` or any streaming site)
3. Open DevTools (F12) and navigate to the PlaybackLab tab
4. Use Chrome DevTools screenshot: Ctrl+Shift+P → type "screenshot" → "Capture screenshot"
5. Resize the DevTools window to approximately 1280x800 before capturing

### Small Promotional Tile
- **Dimensions:** 440x280 pixels
- **Format:** PNG or JPG
- **Content:** PlaybackLab logo + tagline "Debug HLS & DASH Streams"
- **Background:** Dark (#1a1a2e) with accent colors

### Marquee Promotional Tile (Optional)
- **Dimensions:** 1400x560 pixels
- **Format:** PNG or JPG
- **Content:** Logo + feature highlights + screenshot preview

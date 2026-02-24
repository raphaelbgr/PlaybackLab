# PlaybackLab - Chrome Extension for HLS/DASH Debugging

## Project Overview

PlaybackLab is a Chrome DevTools extension for video streaming developers to test and debug HLS, DASH, and DRM video streams.

**Marketing Name:** PlaybackLab (previously StreamLens - name was taken)
**Target Audience:** Video streaming developers, QA engineers, OTT platform engineers
**Monetization:** Freemium (Free tier + Pro $9/month + Team $29/month)

## Architecture

### SOLID Principles Applied

1. **Single Responsibility:** Each class/module does ONE thing
   - `StreamDetector` - detects streams only
   - `HlsManifestParser` - parses HLS only
   - `DashManifestParser` - parses DASH only

2. **Open/Closed:** Add new parsers without modifying existing code
   - Implement `IManifestParser` interface for new formats

3. **Liskov Substitution:** Any parser can replace another
   - All parsers implement the same interface

4. **Interface Segregation:** Small, focused interfaces
   - `IStreamDetector`, `IManifestParser`, `IMetricsCollector`, `IDrmInspector`

5. **Dependency Inversion:** Depend on abstractions
   - All high-level modules depend on interfaces in `src/core/interfaces/`

### Directory Structure

```
src/
├── core/
│   ├── interfaces/     # SOLID contracts
│   └── services/       # Implementations
├── features/           # Feature modules (future)
├── shared/             # Shared utilities
├── store/              # Zustand state
└── entrypoints/        # WXT entry points
    ├── background/     # Service worker (stream detection)
    ├── devtools/       # Creates DevTools panel
    ├── devtools-panel/ # React UI
    └── content/        # Page-level detection
```

## Tech Stack

- **WXT** - Chrome extension framework (Manifest V3)
- **React 18** - UI
- **TypeScript** - Type safety
- **Zustand** - State management
- **hls-parser** - HLS manifest parsing
- **mpd-parser** - DASH manifest parsing
- **hls.js** - HLS playback in MiniPlayer (lazy-loaded)
- **dash.js** - DASH playback in MiniPlayer (lazy-loaded)
- **Chart.js** - Metrics visualization

## Commands

```bash
npm run dev        # Development mode with hot reload
npm run build      # Production build
npm run zip        # Create Chrome Web Store package
npm run test       # Run tests
npm run typecheck  # TypeScript check
```

## Isolated Docker Mode (Claude Code)

Run Claude Code in a sandboxed Docker container with filesystem isolation, full LAN access, and all permissions skipped.

### Run Claude Code Isolated (This Project)

```powershell
docker run -it --rm `
  --network host `
  --user node `
  -v "C:\Users\rbgnr\git\Stream-Lens:/workspace" `
  -v "C:\Users\rbgnr\.claude:/home/node/.claude" `
  -w /workspace `
  -e "HOME=/home/node" `
  node:22 `
  npx -y @anthropic-ai/claude-code --dangerously-skip-permissions
```

**With initial prompt:**
```powershell
docker run -it --rm `
  --network host `
  --user node `
  -v "C:\Users\rbgnr\git\Stream-Lens:/workspace" `
  -v "C:\Users\rbgnr\.claude:/home/node/.claude" `
  -w /workspace `
  -e "HOME=/home/node" `
  node:22 `
  npx -y @anthropic-ai/claude-code --dangerously-skip-permissions -p "Run npm install and fix issues"
```

**What this provides:**
| Feature | Description |
|---------|-------------|
| Filesystem Isolation | Only `/workspace` (this project) is accessible |
| LAN Access | Full access via `--network host` |
| OAuth Credentials | Mounted from `~/.claude` |
| No Prompts | `--dangerously-skip-permissions` skips confirmations |
| Sub-Claude Support | Can spawn sub-agents from within |

**Network access from container:**
| Target | IP |
|--------|-----|
| Mac Mini | `192.168.7.102` |
| Linux VM | `172.24.174.17` |
| LMStudio | `172.24.160.1:1234` |

For generic command template, see: `C:\Users\rbgnr\CLAUDE.md` → "Run Claude Code in Isolated Docker Mode"

## Development Server Management

**IMPORTANT:** The user manages the dev server. Do NOT start/stop the dev server yourself.

### Ports Configuration
- WXT Dev Server: **8565**
- Vite HMR Server: **8566**

### User Commands
The user will run these commands manually:
```bash
npm run dev   # Starts dev server on port 8565/8566
# Press Ctrl+C to stop
```

### How to Access PlaybackLab
1. Run `npm run dev` to start the extension in dev mode
2. A Chrome window will open with the extension loaded
3. Open Chrome DevTools (F12 or right-click → Inspect)
4. Look for the **"PlaybackLab"** tab in DevTools tabs
5. If hidden, click `>>` at the end of the tab bar

### Testing Streams
- Quick test URLs are available in the Streams tab ("Try:" buttons)
- Or paste any `.m3u8` (HLS) or `.mpd` (DASH) URL and click Load

## Current Features

### Stream Detection & Analysis
- Automatic stream detection via `webRequest` API (extension + Content-Type matching)
- 40+ CDN/platform detection (Akamai, Cloudflare, Fastly, AWS, Apple, YouTube, Twitch, Netflix, etc.)
- HLS manifest parsing (master + media playlists, variants, audio tracks, subtitles)
- DASH MPD parsing (periods, adaptation sets, representations)
- Segment tracking under parent streams (`.ts`, `.m4s`, `.mp4` segments counted, not listed)
- Synthetic parent streams for CDN segments without discoverable masters
- Native MP4/WebM detection (identified but not treated as adaptive streams)

### DevTools Panel UI
- Stream list with type badges (HLS/DASH), platform detection, quality summaries
- Video variant ladder with codec, resolution, HDR, frame rate, and bitrate tags
- Audio track display with branded codec names (Dolby Digital, Dolby Atmos, AAC-LC, etc.)
- Stream health scoring and error explanations
- MiniPlayer preview with 3-phase preflight (URL check, HEAD request, playback error classification)
- ACTIVE/PLAYING status badges for live streams
- Network request inspector (per-stream filtering)
- Export panel (JSON, cURL)
- Command palette (Ctrl+K) and keyboard shortcuts
- Settings panel with ad filtering toggle

### Video Overlays (On-Page)
- Persistent overlays on all `<video>` elements showing stream type badge
- Inspect button to select the corresponding stream in DevTools panel
- Copy URL button for manifest URLs
- Resolution badge on playing videos
- Main-world bridge for player library detection (HLS.js, dash.js, Shaka Player)
- Click-time stream resolution (re-checks player state when user clicks Inspect)
- Badge styling matching the app's design system (pill-shaped, semi-transparent)

### Ad Detection
- VAST/VMAP ad detection (IMA, FreeWheel)
- Ad URL filtering (configurable)
- Ad count display in header

## Video Overlay System Architecture

The video overlay system places persistent debug overlays on all `<video>` elements on the page. This involves three layers: content script (isolated world), background service worker, and DevTools panel.

### Main-World Bridge Pattern (CRITICAL)

Content scripts run in Chrome's **isolated world** and **cannot access page JavaScript objects** like `video.hls`, `video.player`, or `video.shaka`. Player libraries (HLS.js, dash.js, Shaka) attach instances to video elements in the **main world**.

**Solution:** The background script uses `chrome.scripting.executeScript({ world: 'MAIN' })` to run a function in the page's main world that reads player library info from video elements.

**Implementation:** `collectVideoPlayerInfo(tabId)` in `src/entrypoints/background/index.ts`
- Scans `Object.getOwnPropertyNames(window)` one level deep for player instances
- Detects HLS.js instances (objects with `.media` = HTMLVideoElement + `.url`)
- Detects dash.js instances (objects with `.getVideoElement()` + `.getSource()`)
- Also checks `video.hls`, `video.shaka`, `video.player` properties
- Returns `Array<{ index: number; url: string; type: string }>`

### Click-Time Stream Resolution

When a user clicks the "Inspect" button on an overlay:
1. Content script sends `SELECT_STREAM_FROM_PAGE` to background
2. If `streamId` is null, background **re-runs** `collectVideoPlayerInfo()` at click time
3. Matches the URL against `tabStreams` to resolve the correct streamId
4. Forwards `SELECT_STREAM_IN_PANEL` to the DevTools panel

This ensures Inspect works even if overlays were created before videos finished loading.

### Content Script Stream Matching (`getStreamTypeForVideo`)

Located in `src/entrypoints/content/index.ts`, uses 3-priority matching:

1. **Main-world bridge data** (most reliable) — `videoStreamMap` populated by `collectVideoPlayerInfo()`
2. **Isolated-world player detection** (fallback) — checks `video.hls`, `video.shaka`, `video.player`
3. **Direct src check** — uses `video.currentSrc` or `video.src`

Then matches against `detectedStreamsCache` at 4 confidence levels:
- Level 1: Exact URL match
- Level 2: URL without query params (handles token differences)
- Level 3: Same host + same filename
- Level 4: Single stream matching for blob: URLs

### Overlay Badge Colors

Match the app's design system:
| Type | Color | Background |
|------|-------|------------|
| HLS | `#4fc3f7` | `rgba(79, 195, 247, 0.15)` |
| DASH | `#ffb74d` | `rgba(255, 183, 77, 0.15)` |
| VIDEO | `#ab47bc` | `rgba(171, 71, 188, 0.15)` |

Style: pill-shaped (`border-radius: 10px`), `backdrop-filter: blur(8px)`, 10px font, 700 weight.

### Test Page Setup

For the main-world bridge to work on test pages, player instances must be attached to video elements:
```javascript
// HLS.js - standard pattern for DevTools extensions
hls.attachMedia(video);
video.hls = hls;

// dash.js - same pattern
player.initialize(video, url, true);
video.player = player;
```

## Message Types (Background ↔ Panel ↔ Content Script)

### Stream Lifecycle
| Message | Direction | Payload | Description |
|---------|-----------|---------|-------------|
| `STREAM_DETECTED` | bg → panel | `StreamInfo` | New master stream detected |
| `SEGMENT_DETECTED` | bg → panel | `{ parentStreamId, segmentUrl }` | Segment counted under parent |
| `MANIFEST_LOADED` | bg → panel | `{ streamId, tabId, manifest }` | Parsed manifest data |
| `MANIFEST_ERROR` | bg → panel | `{ streamId, tabId, error }` | Manifest parse failure |
| `REFETCH_MANIFEST` | panel → bg | `{ streamId }` | Request manifest re-fetch |
| `PLAYBACK_STATE_UPDATED` | bg → panel | `{ tabId, streams }` | Updated playback states |

### Video Overlays
| Message | Direction | Payload | Description |
|---------|-----------|---------|-------------|
| `ENABLE_VIDEO_OVERLAYS` | panel → bg → content | `{ tabId }` | Enable overlay system |
| `DISABLE_VIDEO_OVERLAYS` | panel → bg → content | `{ tabId }` | Disable overlay system |
| `UPDATE_STREAMS_CACHE` | bg → content | `{ streams, videoStreamMap }` | Push stream + bridge data to content |
| `SELECT_STREAM_FROM_PAGE` | content → bg | `{ url, streamId, videoIndex }` | User clicked Inspect on overlay |
| `SELECT_STREAM_IN_PANEL` | bg → panel | `{ url, streamId, videoIndex }` | Background resolved stream, tell panel |
| `GET_VIDEO_OVERLAY_STATUS` | panel → bg | `{ tabId }` | Check if overlays are active |

### Ad Detection
| Message | Direction | Payload | Description |
|---------|-----------|---------|-------------|
| `AD_DETECTED` | bg → panel | `DetectedAd` | New ad request detected |
| `AD_PARSED` | bg → panel | `AdParsedPayload` | VAST/VMAP parsed content |
| `AD_ERROR` | bg → panel | `{ adId, tabId, error }` | Ad parse failure |

### Data Queries
| Message | Direction | Payload | Description |
|---------|-----------|---------|-------------|
| `GET_STREAMS` | panel → bg | `{ tabId }` | Get all streams + cached manifests/errors |
| `GET_ADS` | panel → bg | `{ tabId }` | Get all ads for tab |
| `CLEAR_TAB` | panel → bg | `{ tabId }` | Clear all data for tab |

## Background Script Caching

The background script (`src/entrypoints/background/index.ts`) caches:
- **Manifests:** `tabManifestCache` — Map<tabId, Map<streamId, ParsedManifest>>
- **Errors:** `tabErrorCache` — Map<tabId, Map<streamId, string>>
- **Streams:** `tabStreams` — Map<tabId, StreamInfo[]>
- **Network requests:** `tabNetworkRequests` — Map<tabId, NetworkRequest[]>

When the panel sends `GET_STREAMS`, the response includes `{ streams, manifests, errors }` so the panel doesn't need to re-fetch manifests that were already parsed.

## Coding Standards

### DRY Principle - Shared Utilities

**ALWAYS extract common logic to shared utility files.** Never duplicate code across components.

Location: `src/shared/utils/`

Current utilities:
- `stringUtils.ts` - String manipulation (safeUpperCase, formatBitrate, formatDuration, etc.)
- `copyAsCurl.ts` - Clipboard and cURL generation (with permission policy fallbacks)
- `chromeApiSafe.ts` - Safe Chrome API wrappers (handles closed tabs, invalid contexts)
- `errorExplanations.ts` - Error code explanations
- `streamHealthScore.ts` - Health score calculations
- `videoTags.ts` - Video/audio codec parsing and tag generation (see below)

**Rules:**
1. If the same logic appears in 2+ places, extract it to a shared utility
2. All utility functions must have null-safety checks built in
3. Export small, focused functions (Single Responsibility)
4. Add JSDoc comments for all exported functions
5. Write unit tests for utility functions

### Use Battle-Tested Open Source Libraries

**ALWAYS search for and use well-known, battle-tested open source libraries** instead of writing custom implementations for common tasks.

**Before implementing any common functionality:**
1. Search npm for existing solutions
2. Prefer libraries with: high download counts, active maintenance, good TypeScript support
3. Check bundle size impact (use bundlephobia.com)

**Preferred libraries for common tasks:**
- Date/time: `date-fns` (already installed)
- HTTP requests: `fetch` API or `axios`
- State management: `zustand` (already installed)
- Validation: `zod` or `yup`
- UUID generation: `uuid` or `nanoid`
- Deep cloning: `structuredClone` (native) or `lodash-es/cloneDeep`
- Debounce/throttle: `lodash-es/debounce` or `use-debounce`
- URL parsing: Native `URL` API
- Manifest parsing: `hls-parser`, `mpd-parser` (already installed)

**Do NOT reinvent:**
- Date formatting/parsing
- Deep object comparison/cloning
- Debounce/throttle
- UUID generation
- URL manipulation
- Cryptographic functions

### Chrome Extension API Safety

**ALWAYS use safe wrappers for Chrome APIs** that can fail when tabs are closed or contexts are invalidated.

Location: `src/shared/utils/chromeApiSafe.ts`

**Available safe wrappers:**
- `safeGetTab(tabId)` - Returns null if tab doesn't exist (instead of throwing)
- `safeSendTabMessage(tabId, message)` - Returns null if tab/content script unavailable
- `safeSendRuntimeMessage(message)` - Returns null if extension context invalid
- `safeExecuteScript(tabId, func)` - Returns null if script injection fails
- `safeQueryTabs(queryInfo)` - Returns empty array on failure (with caching)
- `checkRuntimeError()` - Clears and returns chrome.runtime.lastError
- `isExtensionContextValid()` - Checks if extension context is still valid

**Common errors handled:**
- "No tab with id: X" - Tab was closed before API call completed
- "Could not establish connection" - Content script not loaded
- "The message port closed" - Receiving end doesn't exist
- "Extension context invalidated" - Extension was reloaded/updated

**Rules:**
1. **NEVER** use `chrome.tabs.get()` directly - use `safeGetTab()`
2. **NEVER** use `chrome.tabs.sendMessage()` without checking tab exists first
3. **ALWAYS** handle `chrome.runtime.lastError` after callback-style APIs
4. For clipboard operations, use `copyToClipboard()` from `copyAsCurl.ts` (handles permission policy restrictions)

**Example:**
```typescript
// BAD - will throw "No tab with id" if tab closed
chrome.tabs.get(tabId).then(tab => { ... });

// GOOD - returns null safely
const tab = await safeGetTab(tabId);
if (tab) {
  // Tab exists, proceed
}
```

### Video/Audio Tag System

**ALWAYS use the centralized tag system** for displaying codec, quality, HDR, and other video/audio metadata as badges.

**Files:**
- `src/shared/utils/videoTags.ts` - Core tag utility with parsing and generation
- `src/entrypoints/devtools-panel/components/Tooltip.tsx` - Rich tooltip component

**Codec Parsing:**
- `parseVideoCodec(codecString)` - Parse H.264, HEVC, VP9, AV1 with profile/level
- `parseAudioCodec(codecString)` - Parse AAC, AC-3, E-AC-3, Opus with branded names (Dolby Digital, etc.)
- `extractAudioFromCodecs(combinedCodec)` - Extract audio codec from muxed video+audio codec string

**Quality & Feature Detection:**
- `getQualityTier(height)` - Returns: 8K, 4K, 1080p, 720p, SD, etc.
- `getQualityLabel(height)` - Returns: "8K UHD", "4K UHD", "1080p Full HD", etc.
- `getResolutionName(width, height)` - Returns: "Full HD", "4K UHD", "QHD", etc.
- `detectHdrType(codec, transfer)` - Returns: HDR10, HDR10+, Dolby Vision, HLG, SDR
- `getAspectRatio(width, height)` - Returns: "16:9", "4:3", "21:9", etc.

**Tag Generation:**
- `getVideoCodecTag(codec)` - Tag for H.264, HEVC, VP9, AV1
- `getResolutionTag(width, height)` - Tag for resolution name (Full HD, 4K UHD, etc.)
- `getQualityTag(height)` - Tag for resolution tier (4K, 1080p, etc.)
- `getHdrTag(codec, transfer)` - Tag for HDR type
- `getFrameRateTag(fps)` - Tag for frame rates (24fps, 30fps, 60fps, etc.)
- `getAudioCodecTag(codec, isAtmos?)` - Tag for audio codec with branded names
- `getAudioChannelsTag(channels, isAtmos?)` - Tag for Mono, Stereo, 5.1, 7.1, 7.1.4
- `getFeatureTag(feature)` - Tag for Muxed, Spatial, Lossless, Hi-Res
- `getMuxedAudioInfo(videoCodec)` - Extract muxed audio codec, channels, estimated bitrate

**Batch Tag Generation:**
- `getVideoVariantTags(codec, height, fps, width?, transfer?)` - All tags for a video variant
- `getAudioVariantTags(codec, channels, isAtmos?, isLossless?, isHiRes?)` - All tags for an audio variant

**Tag Interface:**
```typescript
interface Tag {
  id: string;          // Unique identifier
  label: string;       // Display text (e.g., "H.264", "Full HD")
  category: TagCategory;
  color: string;       // Text color
  bgColor: string;     // Background color
  tooltip: string;     // Hover tooltip text
  richTooltip?: boolean; // True if should use rich tooltip component
}
```

**Tooltip System:**
- `TOOLTIP_MAP` - Comprehensive tooltip content for all tag types
- CSS tooltips via `data-tooltip` attribute (simple, fast)
- React `<Tooltip>` component for rich tooltips with details

**Branded Audio Codec Names:**
| Codec | Branded Name |
|-------|--------------|
| mp4a.40.2 | AAC-LC |
| mp4a.40.5 | HE-AAC |
| ac-3 | Dolby Digital |
| ec-3 | Dolby Digital+ |
| ec-3 + Atmos | Dolby Atmos |
| opus | Opus |
| flac | FLAC |

**Resolution Tags:**
| Dimensions | Tag |
|------------|-----|
| 7680x4320 | 8K UHD |
| 3840x2160 | 4K UHD |
| 4096x2160 | Cinema 4K |
| 2560x1440 | QHD |
| 1920x1080 | Full HD |
| 1280x720 | HD |
| < 720p | SD |

**Rules:**
1. **ALWAYS** use tag functions instead of manually parsing codecs
2. Tags include consistent colors defined in `TAG_COLORS` palette
3. All tags have tooltips with educational content via `TOOLTIP_MAP`
4. Use `getVideoVariantTags()` for batch generation in components
5. For muxed audio, use `getMuxedAudioInfo()` to extract and display codec/channels

## DevTools Panel CSS & Scrolling (CRITICAL)

DevTools panels run in a constrained iframe-like environment with different behavior than regular web pages.

### Key Rules for Scrollable Layouts

1. **Use absolute positioning for root layout:**
```css
html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

#root {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
}

.app {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
```

2. **For scrollable content areas within flex layouts:**
```css
.scroll-container {
  flex: 1;
  min-height: 0;  /* CRITICAL - allows flex item to shrink */
  overflow-y: auto;
  overflow-x: hidden;
}
```

3. **NEVER use `overflow: hidden` on expandable/collapsible elements** - it clips content when items expand.

4. **Add `flex-shrink: 0` to fixed elements** (headers, input bars) that should not shrink.

5. **Add `min-height: 0` at EVERY level of nested flex containers** - flex items default to `min-height: auto` which prevents shrinking below content size.

### Common Pitfalls

| Problem | Cause | Fix |
|---------|-------|-----|
| Scroll not working | Missing `min-height: 0` on flex ancestors | Add to every flex parent |
| Content disappearing | `overflow: hidden` on parent | Remove or use `overflow: visible` |
| Content clipped when expanded | `overflow: hidden` on expandable element | Remove `overflow: hidden` |
| `height: 100%` not working | Parent has no explicit height | Use absolute positioning instead |
| `100vh` not working | DevTools panel viewport differs | Use absolute positioning with `top/bottom: 0` |

### Testing Scroll Issues

1. Create a test HTML file that mirrors the extension's structure
2. Serve it locally and compare behavior
3. The test page may work while extension doesn't - DevTools has different constraints
4. **Always rebuild with `npm run build`** after CSS changes - the dist folder needs updating

### Hierarchy Checklist

For a scrollable list in DevTools panel, ensure this chain:
```
html (height: 100%)
└── body (height: 100%)
    └── #root (position: absolute, fills viewport)
        └── .app (position: absolute, flex column)
            └── header (flex-shrink: 0)
            └── .main (flex: 1, position: relative, min-height: 0)
                └── .panel (position: absolute, fills parent, flex)
                    └── .list-container (flex: 1, flex column, min-height: 0)
                        └── .scroll-area (flex: 1, min-height: 0, overflow-y: auto)
```

## Research Documentation

All technical research is in `docs/`:
- URL input architecture
- Headers/auth handling
- Stream interception methods
- HLS/DASH parsing strategies
- DRM detection approaches
- Real-time metrics visualization
- Naming/branding research

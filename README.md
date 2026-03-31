# PlaybackLab

[![GitHub Sponsors](https://img.shields.io/github/sponsors/raphaelbgr?style=flat&logo=github&label=Sponsor)](https://github.com/sponsors/raphaelbgr)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-support-ff5e5b?style=flat&logo=ko-fi)](https://ko-fi.com/raphaelbgr)

> Chrome DevTools Extension for HLS/DASH Video Stream Debugging

Detect, inspect, and debug HLS, DASH, and DRM video streams in real-time. Analyze manifests, monitor quality variants, track segments, preview streams, and overlay debug info directly on page videos.

## Why This Exists

Debugging adaptive video streams in the browser is surprisingly painful. Chrome's built-in Network tab often misses video segment requests entirely when using embedded players. The Media Panel shows events but gives you no way to zoom into a specific time window, intervene in playback, or understand why a quality switch happened. Manifest files are invisible unless you manually curl them. DRM failures surface as silent black screens with no actionable error. And when something breaks on YouTube, Netflix, or Twitch, there's no tool that tells you *what* stream is playing, *which* variant was selected, or *why* the player stalled.

PlaybackLab was built to fill that gap — a DevTools-native panel that surfaces everything you need to debug HLS and DASH streams without leaving the browser.

### Pain Points Solved

- **Network tab blindness** — Video segments from embedded players (HLS.js, dash.js, Shaka, native) don't show in the Network tab. PlaybackLab intercepts them at the `webRequest` layer, capturing every manifest and segment with full metadata.
- **No manifest visibility** — Developers resort to copy-pasting URLs into curl to read manifest content. PlaybackLab auto-fetches, parses, and displays the full variant ladder, audio tracks, and subtitle renditions in one click.
- **Quality ladder opacity** — Understanding what bitrates, resolutions, codecs, and HDR profiles a stream offers requires reading raw M3U8/MPD XML. PlaybackLab parses it into a readable variant table with codec names (Dolby Atmos, HEVC, AVC), resolution, frame rate, and HDR tags.
- **CDN/platform ambiguity** — Requests from YouTube, Netflix, Twitch, and 40+ CDNs produce cryptic URLs with no obvious stream identity. PlaybackLab identifies the platform, groups segments under their parent stream, and creates synthetic stream entries when no manifest URL is discoverable.
- **Silent DRM failures** — A blank video element gives no indication of whether the license request failed, the CDM is unavailable, or the token expired. PlaybackLab classifies playback errors with context-aware explanations so you know exactly what went wrong.
- **No in-browser stream preview** — Verifying a stream URL requires opening a separate player or test page. PlaybackLab's MiniPlayer lets you preview any detected stream inline with a 3-phase preflight check (URL validity → HEAD request → playback error classification).
- **CORS errors with no context** — A `CORS_BLOCKED` or `401` on a segment fails silently in most tools. PlaybackLab surfaces the error with an explanation and suggested fix.
- **Overlay-free pages** — No visible indication of which `<video>` element maps to which stream. PlaybackLab injects non-intrusive overlays on every video element with a stream type badge, resolution display, and one-click inspect/copy buttons.

## Features

### Stream Detection & Analysis
- [x] Automatic stream detection via `webRequest` API (extension + Content-Type matching)
- [x] 40+ CDN/platform detection (Akamai, Cloudflare, Fastly, AWS, Apple, YouTube, Twitch, Netflix, etc.)
- [x] HLS manifest parsing (master + media playlists, variants, audio tracks, subtitles)
- [x] DASH MPD parsing (periods, adaptation sets, representations)
- [x] Segment tracking under parent streams (`.ts`, `.m4s`, `.mp4` segments counted, not listed)
- [x] Synthetic parent streams for CDN segments without discoverable masters (YouTube, Twitch, Netflix, Vimeo)
- [x] Native MP4/WebM detection (identified but not treated as adaptive streams)

### DevTools Panel UI
- [x] Stream list with type badges (HLS/DASH), platform detection, quality summaries
- [x] Video variant ladder with codec, resolution, HDR, frame rate, and bitrate tags
- [x] Audio track display with branded codec names (Dolby Digital, Dolby Atmos, AAC-LC, etc.)
- [x] Stream health scoring and error explanations
- [x] MiniPlayer preview with 3-phase preflight (URL check, HEAD request, playback error classification)
- [x] ACTIVE/PLAYING status badges for live streams
- [x] Network request inspector (per-stream filtering)
- [x] Export panel (JSON, cURL)
- [x] Command palette (Ctrl+K) and keyboard shortcuts
- [x] Settings panel with ad filtering toggle

### Video Overlays (On-Page)
- [x] Persistent overlays on all `<video>` elements showing stream type badge
- [x] Inspect button to select the corresponding stream in DevTools panel
- [x] Copy URL button for manifest URLs
- [x] Resolution badge on playing videos
- [x] Main-world bridge for player library detection (HLS.js, dash.js, Shaka Player)
- [x] Click-time stream resolution (re-checks player state when user clicks Inspect)
- [x] Badge styling matching the app's design system (pill-shaped, semi-transparent)

### Ad Detection
- [x] VAST/VMAP ad detection (IMA, FreeWheel)
- [x] Ad URL filtering (configurable)
- [x] Ad count display in header

### Roadmap
- [ ] DRM inspection (Widevine, PlayReady, FairPlay license details)
- [ ] Real-time metrics visualization (buffer, bitrate, dropped frames charts)
- [ ] ABR algorithm debugging
- [ ] Chrome Web Store publication

## Architecture

Built with **SOLID principles** and a message-passing architecture between background service worker, content script, and DevTools panel.

```
src/
├── core/
│   ├── interfaces/     # Contracts (IStreamDetector, IManifestParser, IAdDetector)
│   └── services/       # StreamDetector, HlsManifestParser, DashManifestParser, AdDetector, VastParser
├── shared/
│   ├── hooks/          # useKeyboardShortcuts
│   └── utils/          # stringUtils, videoTags, chromeApiSafe, copyAsCurl, errorExplanations
├── store/              # Zustand state (streams, ads, settings)
└── entrypoints/
    ├── background/     # Service worker (stream detection, manifest caching, overlay orchestration)
    ├── devtools/       # Creates DevTools panel
    ├── devtools-panel/ # React UI (StreamsPanel, StreamDetails, MiniPlayer, NetworkInspector, etc.)
    └── content/        # Content script (video overlays, metrics collection, page scanning)
```

### Key Message Flow
```
webRequest (background) → STREAM_DETECTED → DevTools panel (adds to store)
                        → SEGMENT_DETECTED → DevTools panel (increments count)
                        → MANIFEST_LOADED → DevTools panel (updates manifest)
DevTools panel → ENABLE_VIDEO_OVERLAYS → background → content script (creates overlays)
Content script → SELECT_STREAM_FROM_PAGE → background (resolves streamId) → SELECT_STREAM_IN_PANEL → DevTools panel
```

## Tech Stack

- **Framework:** WXT (Web Extension Tools) - Manifest V3
- **UI:** React 18 + TypeScript
- **State:** Zustand
- **Parsing:** hls-parser, mpd-parser
- **Preview:** hls.js, dash.js (lazy-loaded in MiniPlayer)
- **Charts:** Chart.js + react-chartjs-2

## Development

```bash
npm install          # Install dependencies
npm run dev          # Development mode with hot reload
npm run build        # Production build
npm run zip          # Create Chrome Web Store package
npm run test         # Run tests (vitest)
npm run typecheck    # TypeScript check
```

### Testing
- **Test page:** `test-streams.html` — 7 streams (4 HLS + 3 DASH) + 1 native MP4
- Serve with any HTTP server: `npx serve .` then open `http://localhost:3000/test-streams.html`
- Open DevTools → PlaybackLab tab → enable overlays → click Load All

## Support

PlaybackLab is free and open source. If it saves you time debugging streams, consider supporting development:

- [GitHub Sponsors](https://github.com/sponsors/raphaelbgr)
- [Ko-fi](https://ko-fi.com/raphaelbgr)

## License

MIT

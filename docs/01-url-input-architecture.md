# URL Input Architecture for Video Stream Tester Chrome Extension

> Research document covering input methods, URL parsing, stream detection, and UX patterns for a Chrome extension that accepts video stream URLs for testing/debugging.

---

## Table of Contents

1. [Input Methods Overview](#1-input-methods-overview)
2. [Handling URLs with Query Parameters](#2-handling-urls-with-query-parameters)
3. [Parsing M3U8/MPD URLs Automatically](#3-parsing-m3u8mpd-urls-automatically)
4. [Auto-Detection of Streams on Current Page](#4-auto-detection-of-streams-on-current-page)
5. [How Postman Handles URL Input](#5-how-postman-handles-url-input)
6. [Best UX Patterns for Developer Tools](#6-best-ux-patterns-for-developer-tools)
7. [Recommended Architecture](#7-recommended-architecture)
8. [Code Examples](#8-code-examples)
9. [Sources](#9-sources)

---

## 1. Input Methods Overview

For a video stream testing extension, we should support multiple input methods to accommodate different user workflows:

### 1.1 Manual URL Paste (Primary)

The most straightforward method - a text input where users paste stream URLs directly.

**Pros:**
- Simple to implement
- User has full control
- Works with any URL source

**Cons:**
- Requires user to manually copy URLs
- Error-prone if URL is malformed

### 1.2 URL Bar Detection (Omnibox Integration)

Chrome extensions can integrate with the omnibox (URL bar) using the `chrome.omnibox` API.

```javascript
// manifest.json
{
  "omnibox": { "keyword": "stream" }
}

// background.js
chrome.omnibox.onInputEntered.addListener((text) => {
  // User typed "stream <url>" in the URL bar
  processStreamUrl(text);
});
```

**Pros:**
- Quick access without opening popup
- Power-user friendly

**Cons:**
- Requires learning the keyword
- Limited UI feedback

### 1.3 Page Detection (Auto-Discovery)

Automatically detect video streams on the current page using:
- Network request interception
- DOM scanning for `<video>` elements
- Platform-specific parsers

**Pros:**
- Seamless user experience
- Discovers hidden/embedded streams

**Cons:**
- More complex implementation
- May capture unwanted streams (ads, etc.)

### 1.4 Context Menu Integration

Right-click on video elements or links to send URLs to the extension.

```javascript
// manifest.json
{
  "permissions": ["contextMenus"]
}

// background.js
chrome.contextMenus.create({
  id: "testStream",
  title: "Test this stream",
  contexts: ["video", "link"]
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const url = info.srcUrl || info.linkUrl;
  processStreamUrl(url);
});
```

### Recommendation

Support all four methods with priority order:
1. **Auto-detection** as the default (runs automatically)
2. **Manual paste** as the primary UI interaction
3. **Context menu** for targeted selection
4. **Omnibox** for power users

---

## 2. Handling URLs with Query Parameters

Video stream URLs often contain important query parameters for authentication, DRM tokens, CDN signatures, and quality selection.

### 2.1 URL Parsing with JavaScript URL API

```javascript
function parseStreamUrl(urlString) {
  try {
    const url = new URL(urlString);

    return {
      protocol: url.protocol,
      host: url.host,
      pathname: url.pathname,
      searchParams: Object.fromEntries(url.searchParams),
      hash: url.hash,
      fullUrl: url.href,

      // Stream-specific detection
      isM3U8: url.pathname.endsWith('.m3u8') ||
              url.searchParams.has('format') &&
              url.searchParams.get('format') === 'hls',
      isMPD: url.pathname.endsWith('.mpd') ||
             url.pathname.endsWith('.xml') &&
             url.pathname.includes('dash'),

      // Common parameters
      token: url.searchParams.get('token') ||
             url.searchParams.get('hdnts') ||
             url.searchParams.get('Policy'),
      expires: url.searchParams.get('expires') ||
               url.searchParams.get('Expires')
    };
  } catch (e) {
    return { error: 'Invalid URL', original: urlString };
  }
}
```

### 2.2 Common Query Parameters in Streaming URLs

| Parameter | Purpose | Example |
|-----------|---------|---------|
| `token` | Authentication token | `?token=abc123` |
| `hdnts` | Akamai token auth | `?hdnts=exp=...~acl=...~hmac=...` |
| `Policy`, `Signature`, `Key-Pair-Id` | CloudFront signed URLs | AWS signed URLs |
| `expires` | Token expiration | `?expires=1704067200` |
| `quality` / `rendition` | Quality selection | `?quality=1080p` |
| `start` / `end` | Segment range | `?start=0&end=300` |

### 2.3 Preserving vs. Modifying Parameters

```javascript
class StreamUrlManager {
  constructor(url) {
    this.url = new URL(url);
    this.originalParams = new URLSearchParams(this.url.search);
  }

  // Get URL with all original params
  getFullUrl() {
    return this.url.href;
  }

  // Get URL without sensitive params (for display)
  getSanitizedUrl() {
    const sanitized = new URL(this.url);
    const sensitiveParams = ['token', 'hdnts', 'Policy', 'Signature'];
    sensitiveParams.forEach(p => sanitized.searchParams.delete(p));
    return sanitized.href;
  }

  // Add/modify params for testing
  withParam(key, value) {
    const modified = new URL(this.url);
    modified.searchParams.set(key, value);
    return modified.href;
  }

  // Check if token is expired
  isExpired() {
    const expires = this.url.searchParams.get('expires') ||
                    this.url.searchParams.get('Expires');
    if (!expires) return false;
    return parseInt(expires) * 1000 < Date.now();
  }
}
```

---

## 3. Parsing M3U8/MPD URLs Automatically

### 3.1 Detecting Stream Type from URL

```javascript
function detectStreamType(url) {
  const urlLower = url.toLowerCase();
  const pathname = new URL(url).pathname.toLowerCase();

  // HLS Detection
  if (pathname.endsWith('.m3u8') ||
      pathname.endsWith('.m3u') ||
      urlLower.includes('/hls/') ||
      urlLower.includes('format=hls')) {
    return 'HLS';
  }

  // DASH Detection
  if (pathname.endsWith('.mpd') ||
      urlLower.includes('/dash/') ||
      urlLower.includes('format=dash')) {
    return 'DASH';
  }

  // Smooth Streaming Detection
  if (pathname.endsWith('.ism/manifest') ||
      urlLower.includes('/smooth/')) {
    return 'MSS';
  }

  // Direct video file
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi'];
  if (videoExtensions.some(ext => pathname.endsWith(ext))) {
    return 'DIRECT';
  }

  return 'UNKNOWN';
}
```

### 3.2 M3U8 Parser Integration

Using the `m3u8-parser` library from Video.js:

```javascript
// Installation: npm install m3u8-parser
import { Parser } from 'm3u8-parser';

async function parseM3U8(url) {
  const response = await fetch(url);
  const manifestText = await response.text();

  const parser = new Parser({
    url: url  // Required for QUERYSTRING rules
  });

  parser.push(manifestText);
  parser.end();

  const manifest = parser.manifest;

  return {
    type: manifest.playlists ? 'master' : 'media',

    // Master playlist info
    variants: manifest.playlists?.map(p => ({
      uri: p.uri,
      bandwidth: p.attributes?.BANDWIDTH,
      resolution: p.attributes?.RESOLUTION,
      codecs: p.attributes?.CODECS
    })),

    // Media playlist info
    segments: manifest.segments?.map(s => ({
      uri: s.uri,
      duration: s.duration,
      title: s.title
    })),

    // Common properties
    targetDuration: manifest.targetDuration,
    totalDuration: manifest.totalDuration,
    endList: manifest.endList,
    mediaSequence: manifest.mediaSequence,

    // DRM info
    hasEncryption: manifest.segments?.some(s => s.key),

    // Audio/Subtitle tracks
    audioGroups: manifest.mediaGroups?.AUDIO,
    subtitleGroups: manifest.mediaGroups?.SUBTITLES
  };
}
```

### 3.3 MPD Parser Integration

Using the `mpd-parser` library from Video.js:

```javascript
// Installation: npm install mpd-parser
import { parse } from 'mpd-parser';

async function parseMPD(url) {
  const response = await fetch(url);
  const manifestText = await response.text();

  const manifest = parse(manifestText, { manifestUri: url });

  return {
    type: 'dash',

    // Playlists/Representations
    playlists: manifest.playlists?.map(p => ({
      uri: p.uri,
      bandwidth: p.attributes?.BANDWIDTH,
      resolution: p.attributes?.RESOLUTION,
      codecs: p.attributes?.CODECS,
      mimeType: p.attributes?.['MIME-TYPE']
    })),

    // Segments
    segments: manifest.segments,

    // Duration info
    targetDuration: manifest.targetDuration,
    totalDuration: manifest.totalDuration,

    // Live/VOD
    isLive: !manifest.endList,

    // Media groups
    audioGroups: manifest.mediaGroups?.AUDIO,
    subtitleGroups: manifest.mediaGroups?.['CLOSED-CAPTIONS']
  };
}
```

### 3.4 Unified Stream Parser

```javascript
class StreamParser {
  async parse(url) {
    const type = detectStreamType(url);

    switch (type) {
      case 'HLS':
        return this.parseHLS(url);
      case 'DASH':
        return this.parseDASH(url);
      case 'DIRECT':
        return this.probeDirectVideo(url);
      default:
        // Try to detect from content-type
        return this.parseByContentType(url);
    }
  }

  async parseByContentType(url) {
    const response = await fetch(url, { method: 'HEAD' });
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('mpegurl') ||
        contentType?.includes('x-mpegurl')) {
      return this.parseHLS(url);
    }

    if (contentType?.includes('dash+xml')) {
      return this.parseDASH(url);
    }

    throw new Error(`Unknown stream type: ${contentType}`);
  }
}
```

---

## 4. Auto-Detection of Streams on Current Page

### 4.1 Three-Layer Detection Strategy

Based on Stream Detector Pro's architecture, implement a multi-method approach:

#### Layer 1: Network Request Interception

```javascript
// background.js (Service Worker)
const STREAM_PATTERNS = [
  /\.m3u8(\?|$)/i,
  /\.mpd(\?|$)/i,
  /\.ism\/manifest/i,
  /\.(mp4|webm|ts)(\?|$)/i
];

const detectedStreams = new Map(); // tabId -> Set of URLs

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    const { url, tabId, type } = details;

    // Only track media requests
    if (type !== 'media' && type !== 'xmlhttprequest') return;

    // Check if URL matches stream patterns
    if (STREAM_PATTERNS.some(pattern => pattern.test(url))) {
      if (!detectedStreams.has(tabId)) {
        detectedStreams.set(tabId, new Set());
      }
      detectedStreams.get(tabId).add(url);

      // Notify popup if open
      chrome.runtime.sendMessage({
        type: 'STREAM_DETECTED',
        tabId,
        url,
        streamType: detectStreamType(url)
      }).catch(() => {}); // Ignore if popup not open
    }
  },
  { urls: ["<all_urls>"] },
  []
);

// Clean up on tab close
chrome.tabs.onRemoved.addListener((tabId) => {
  detectedStreams.delete(tabId);
});
```

#### Layer 2: DOM Scanning (Content Script)

```javascript
// content.js
function scanPageForVideos() {
  const streams = [];

  // Find <video> elements
  document.querySelectorAll('video').forEach(video => {
    if (video.src) {
      streams.push({
        type: 'video-src',
        url: video.src
      });
    }

    // Check <source> children
    video.querySelectorAll('source').forEach(source => {
      if (source.src) {
        streams.push({
          type: 'video-source',
          url: source.src,
          mimeType: source.type
        });
      }
    });

    // Check currentSrc (actual playing source)
    if (video.currentSrc && video.currentSrc !== video.src) {
      streams.push({
        type: 'video-currentSrc',
        url: video.currentSrc
      });
    }
  });

  // Find <iframe> embeds (YouTube, Vimeo, etc.)
  document.querySelectorAll('iframe').forEach(iframe => {
    const src = iframe.src;
    if (src && isEmbedUrl(src)) {
      streams.push({
        type: 'embed',
        url: src,
        platform: detectPlatform(src)
      });
    }
  });

  return streams;
}

function isEmbedUrl(url) {
  const embedDomains = [
    'youtube.com/embed',
    'player.vimeo.com',
    'dailymotion.com/embed',
    'facebook.com/plugins/video'
  ];
  return embedDomains.some(domain => url.includes(domain));
}

// Watch for dynamically added videos
const observer = new MutationObserver((mutations) => {
  mutations.forEach(mutation => {
    mutation.addedNodes.forEach(node => {
      if (node.tagName === 'VIDEO' ||
          node.querySelector?.('video')) {
        const newStreams = scanPageForVideos();
        chrome.runtime.sendMessage({
          type: 'DOM_STREAMS_FOUND',
          streams: newStreams
        });
      }
    });
  });
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Initial scan
chrome.runtime.sendMessage({
  type: 'DOM_STREAMS_FOUND',
  streams: scanPageForVideos()
});
```

#### Layer 3: Platform-Specific Extractors

```javascript
// scanners/youtube-scanner.js
function extractYouTubeStreams() {
  // YouTube stores player data in a global variable
  const playerResponse = window.ytInitialPlayerResponse;

  if (!playerResponse) return null;

  const formats = playerResponse.streamingData?.formats || [];
  const adaptiveFormats = playerResponse.streamingData?.adaptiveFormats || [];

  return {
    platform: 'youtube',
    videoId: playerResponse.videoDetails?.videoId,
    title: playerResponse.videoDetails?.title,
    duration: playerResponse.videoDetails?.lengthSeconds,
    formats: [...formats, ...adaptiveFormats].map(f => ({
      itag: f.itag,
      url: f.url,
      mimeType: f.mimeType,
      quality: f.quality,
      qualityLabel: f.qualityLabel,
      bitrate: f.bitrate,
      width: f.width,
      height: f.height
    })),
    hlsManifestUrl: playerResponse.streamingData?.hlsManifestUrl,
    dashManifestUrl: playerResponse.streamingData?.dashManifestUrl
  };
}
```

### 4.2 Manifest V3 Considerations

In Manifest V3, `webRequestBlocking` is no longer available for most extensions. However, **read-only** `webRequest` is still fully functional:

```json
// manifest.json
{
  "manifest_version": 3,
  "permissions": [
    "webRequest",
    "storage",
    "contextMenus"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"],
    "run_at": "document_idle"
  }]
}
```

---

## 5. How Postman Handles URL Input

Postman's URL input UX is considered best-in-class for developer tools. Key features:

### 5.1 Dual Input Modes

1. **URL Bar** - Direct text entry with auto-parsing
2. **Params Tab** - Key-value table interface

```
+--------------------------------------------------+
| GET  | https://api.example.com/stream?token=abc  |
+--------------------------------------------------+
| Params | Authorization | Headers | Body | ...    |
+--------------------------------------------------+
| Key            | Value           | Description   |
| token          | abc             | Auth token    |
| quality        | 1080            | Video quality |
| [+ Add param]                                    |
+--------------------------------------------------+
```

### 5.2 Auto-Synchronization

When you paste a URL with params, Postman automatically:
- Parses the query string
- Populates the Params table
- Keeps both in sync as you edit either

```javascript
// Implementation concept
class UrlParamSync {
  constructor(urlInput, paramsTable) {
    this.urlInput = urlInput;
    this.paramsTable = paramsTable;

    urlInput.addEventListener('input', () => this.syncFromUrl());
    paramsTable.addEventListener('change', () => this.syncFromParams());
  }

  syncFromUrl() {
    const url = new URL(this.urlInput.value);
    const params = Array.from(url.searchParams.entries());
    this.paramsTable.setParams(params);
  }

  syncFromParams() {
    const url = new URL(this.urlInput.value);
    url.search = ''; // Clear existing params

    this.paramsTable.getParams().forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    this.urlInput.value = url.href;
  }
}
```

### 5.3 Bulk Edit Mode

Toggle between table view and raw text for power users:

```
token=abc
quality=1080
expires=1704067200
```

### 5.4 URL Encoding

Postman does NOT auto-encode by default - users right-click to encode:

```javascript
function encodeParamValue(value) {
  return encodeURIComponent(value);
}

// Context menu for manual encoding
contextMenu.addItem({
  label: 'Encode URI Component',
  action: (selectedText) => encodeURIComponent(selectedText)
});
```

---

## 6. Best UX Patterns for Developer Tools

### 6.1 Key-Value Pair Layouts

Based on design systems (AWS Cloudscape, Innovaccer):

**Narrow containers (~200px):** Top-Bottom arrangement
```
Token
abc123def456

Quality
1080p

Expires
2024-01-01
```

**Wide containers (~400px+):** Left-Right arrangement
```
Token:    abc123def456
Quality:  1080p
Expires:  2024-01-01
```

### 6.2 Input Validation Patterns

```javascript
// Real-time validation with feedback
const urlInput = document.getElementById('stream-url');
const feedback = document.getElementById('url-feedback');

urlInput.addEventListener('input', async (e) => {
  const url = e.target.value;

  // Immediate format validation
  try {
    new URL(url);
    urlInput.classList.remove('invalid');
    urlInput.classList.add('valid');
  } catch {
    urlInput.classList.add('invalid');
    feedback.textContent = 'Invalid URL format';
    return;
  }

  // Stream type detection
  const type = detectStreamType(url);
  feedback.textContent = type !== 'UNKNOWN'
    ? `Detected: ${type} stream`
    : 'URL format valid, stream type unknown';

  // Async reachability check (debounced)
  debouncedCheckReachability(url);
});
```

### 6.3 Accessibility Considerations

```html
<!-- Semantic HTML for key-value pairs -->
<dl class="stream-info">
  <div class="info-item">
    <dt>Stream Type</dt>
    <dd>HLS (m3u8)</dd>
  </div>
  <div class="info-item">
    <dt>Duration</dt>
    <dd>01:45:30</dd>
  </div>
</dl>

<!-- Accessible input with description -->
<label for="stream-url">
  Stream URL
  <span class="sr-only">Enter an HLS or DASH stream URL</span>
</label>
<input
  type="url"
  id="stream-url"
  placeholder="https://example.com/stream.m3u8"
  aria-describedby="url-help"
/>
<p id="url-help" class="help-text">
  Supports HLS (.m3u8), DASH (.mpd), and direct video URLs
</p>
```

### 6.4 Quick Actions

Provide one-click actions for common operations:

```html
<div class="url-actions">
  <button onclick="copyUrl()">Copy URL</button>
  <button onclick="openInVLC()">Open in VLC</button>
  <button onclick="copyFFmpegCommand()">Copy FFmpeg Command</button>
  <button onclick="testPlayback()">Test Playback</button>
</div>
```

---

## 7. Recommended Architecture

### 7.1 High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Popup UI (popup.html)                    │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  URL Input   │  │  Params Tab  │  │ Detected     │      │
│  │  (paste)     │  │  (key/value) │  │ Streams List │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 Background Service Worker                    │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ webRequest   │  │ Stream       │  │ Message      │      │
│  │ Listener     │  │ Parser       │  │ Router       │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Content Scripts                           │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ DOM Scanner  │  │ Mutation     │  │ Platform     │      │
│  │              │  │ Observer     │  │ Scanners     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Data Flow

```
1. User pastes URL ──► URL Parser ──► Stream Parser ──► Display Info
                                           │
2. Network request ──► Pattern Match ──► Add to List ──► Notify Popup
                                           │
3. Page load ──► DOM Scanner ──► Video Elements ──► Add to List
                     │
4. DOM mutation ──► Observer ──► New Videos ──► Add to List
```

### 7.3 Storage Schema

```javascript
// chrome.storage.local
{
  // Recent URLs for autocomplete
  recentUrls: [
    {
      url: 'https://example.com/stream.m3u8',
      type: 'HLS',
      lastUsed: 1704067200000,
      label: 'Test Stream 1'
    }
  ],

  // User preferences
  settings: {
    autoDetect: true,
    showNetworkStreams: true,
    showDOMStreams: true,
    preferredPlayer: 'internal', // 'internal' | 'vlc' | 'mpv'
    customPlayerCommand: ''
  },

  // Per-tab detected streams
  tabStreams: {
    '123': [
      {
        url: 'https://...',
        type: 'HLS',
        source: 'network', // 'network' | 'dom' | 'manual'
        timestamp: 1704067200000
      }
    ]
  }
}
```

---

## 8. Code Examples

### 8.1 Complete URL Input Component

```javascript
// url-input.js
class StreamUrlInput {
  constructor(container) {
    this.container = container;
    this.render();
    this.bindEvents();
  }

  render() {
    this.container.innerHTML = `
      <div class="url-input-wrapper">
        <div class="url-bar">
          <select class="method-select">
            <option value="GET">GET</option>
            <option value="HEAD">HEAD</option>
          </select>
          <input
            type="url"
            class="url-input"
            placeholder="Enter stream URL (m3u8, mpd, mp4...)"
          />
          <button class="parse-btn">Parse</button>
        </div>

        <div class="tabs">
          <button class="tab active" data-tab="params">Params</button>
          <button class="tab" data-tab="headers">Headers</button>
          <button class="tab" data-tab="info">Stream Info</button>
        </div>

        <div class="tab-content params-content active">
          <table class="params-table">
            <thead>
              <tr>
                <th></th>
                <th>Key</th>
                <th>Value</th>
                <th>Description</th>
                <th></th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
          <button class="add-param-btn">+ Add Parameter</button>
          <button class="bulk-edit-btn">Bulk Edit</button>
        </div>

        <div class="tab-content headers-content">
          <table class="headers-table">
            <thead>
              <tr>
                <th></th>
                <th>Key</th>
                <th>Value</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><input type="checkbox" checked /></td>
                <td><input value="User-Agent" /></td>
                <td><input value="Mozilla/5.0..." /></td>
                <td><button class="remove-btn">×</button></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="tab-content info-content">
          <div class="stream-info-placeholder">
            Enter a URL and click Parse to see stream information
          </div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    const urlInput = this.container.querySelector('.url-input');
    const parseBtn = this.container.querySelector('.parse-btn');

    // Auto-parse params from URL
    urlInput.addEventListener('input', () => {
      this.syncParamsFromUrl();
    });

    // Parse button click
    parseBtn.addEventListener('click', () => {
      this.parseStream();
    });

    // Tab switching
    this.container.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });

    // Paste handling
    urlInput.addEventListener('paste', (e) => {
      // Wait for paste to complete
      setTimeout(() => this.syncParamsFromUrl(), 0);
    });
  }

  syncParamsFromUrl() {
    const urlInput = this.container.querySelector('.url-input');
    const tbody = this.container.querySelector('.params-table tbody');

    try {
      const url = new URL(urlInput.value);
      const params = Array.from(url.searchParams.entries());

      tbody.innerHTML = params.map(([key, value], i) => `
        <tr>
          <td><input type="checkbox" checked /></td>
          <td><input value="${this.escapeHtml(key)}" class="param-key" /></td>
          <td><input value="${this.escapeHtml(value)}" class="param-value" /></td>
          <td><input placeholder="Description" class="param-desc" /></td>
          <td><button class="remove-btn">×</button></td>
        </tr>
      `).join('');

      // Bind remove buttons
      tbody.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          btn.closest('tr').remove();
          this.syncUrlFromParams();
        });
      });

      // Bind param inputs
      tbody.querySelectorAll('.param-key, .param-value').forEach(input => {
        input.addEventListener('input', () => this.syncUrlFromParams());
      });

    } catch (e) {
      // Invalid URL, clear params
      tbody.innerHTML = '';
    }
  }

  syncUrlFromParams() {
    const urlInput = this.container.querySelector('.url-input');
    const rows = this.container.querySelectorAll('.params-table tbody tr');

    try {
      const url = new URL(urlInput.value);
      url.search = '';

      rows.forEach(row => {
        const enabled = row.querySelector('input[type="checkbox"]').checked;
        if (!enabled) return;

        const key = row.querySelector('.param-key').value;
        const value = row.querySelector('.param-value').value;

        if (key) {
          url.searchParams.append(key, value);
        }
      });

      urlInput.value = url.href;
    } catch (e) {
      // Invalid URL, do nothing
    }
  }

  async parseStream() {
    const urlInput = this.container.querySelector('.url-input');
    const infoContent = this.container.querySelector('.info-content');

    infoContent.innerHTML = '<div class="loading">Parsing stream...</div>';
    this.switchTab('info');

    try {
      const url = urlInput.value;
      const type = detectStreamType(url);

      let info;
      if (type === 'HLS') {
        info = await parseM3U8(url);
      } else if (type === 'DASH') {
        info = await parseMPD(url);
      } else {
        info = { type, url, message: 'Direct video URL' };
      }

      this.displayStreamInfo(info);
    } catch (e) {
      infoContent.innerHTML = `
        <div class="error">
          <strong>Error parsing stream:</strong> ${e.message}
        </div>
      `;
    }
  }

  displayStreamInfo(info) {
    const infoContent = this.container.querySelector('.info-content');

    infoContent.innerHTML = `
      <dl class="stream-details">
        <div class="detail-row">
          <dt>Type</dt>
          <dd>${info.type}</dd>
        </div>
        ${info.variants ? `
          <div class="detail-row">
            <dt>Variants</dt>
            <dd>
              <ul class="variant-list">
                ${info.variants.map(v => `
                  <li>
                    ${v.resolution?.width}x${v.resolution?.height}
                    @ ${Math.round(v.bandwidth / 1000)}kbps
                    <button class="copy-url" data-url="${v.uri}">Copy</button>
                  </li>
                `).join('')}
              </ul>
            </dd>
          </div>
        ` : ''}
        ${info.totalDuration ? `
          <div class="detail-row">
            <dt>Duration</dt>
            <dd>${this.formatDuration(info.totalDuration)}</dd>
          </div>
        ` : ''}
        ${info.hasEncryption ? `
          <div class="detail-row">
            <dt>Encryption</dt>
            <dd>Yes (DRM protected)</dd>
          </div>
        ` : ''}
      </dl>
    `;
  }

  switchTab(tabName) {
    this.container.querySelectorAll('.tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tabName);
    });
    this.container.querySelectorAll('.tab-content').forEach(c => {
      c.classList.toggle('active', c.classList.contains(`${tabName}-content`));
    });
  }

  formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  escapeHtml(str) {
    return str.replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;',
      '"': '&quot;', "'": '&#39;'
    }[c]));
  }
}
```

### 8.2 Complete manifest.json

```json
{
  "manifest_version": 3,
  "name": "Video Stream Tester",
  "version": "1.0.0",
  "description": "Test and debug HLS/DASH video streams",

  "permissions": [
    "webRequest",
    "storage",
    "contextMenus",
    "tabs"
  ],

  "host_permissions": [
    "<all_urls>"
  ],

  "omnibox": {
    "keyword": "stream"
  },

  "background": {
    "service_worker": "background.js",
    "type": "module"
  },

  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"],
    "run_at": "document_idle"
  }],

  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },

  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

### 8.3 Background Service Worker

```javascript
// background.js
const STREAM_PATTERNS = [
  /\.m3u8(\?|$)/i,
  /\.mpd(\?|$)/i,
  /\.ism\/manifest/i,
  /\.(mp4|webm|ts|m4s)(\?|$)/i
];

// Store detected streams per tab
const tabStreams = new Map();

// Network request listener
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    const { url, tabId, type } = details;

    if (tabId === -1) return; // Background request
    if (type !== 'media' && type !== 'xmlhttprequest') return;

    if (STREAM_PATTERNS.some(pattern => pattern.test(url))) {
      addStream(tabId, {
        url,
        type: detectStreamType(url),
        source: 'network',
        timestamp: Date.now()
      });
    }
  },
  { urls: ["<all_urls>"] }
);

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'GET_STREAMS':
      sendResponse(getStreams(message.tabId));
      break;

    case 'DOM_STREAMS_FOUND':
      if (sender.tab) {
        message.streams.forEach(stream => {
          addStream(sender.tab.id, {
            ...stream,
            source: 'dom',
            timestamp: Date.now()
          });
        });
      }
      break;

    case 'PARSE_URL':
      parseUrl(message.url).then(sendResponse);
      return true; // Async response
  }
});

// Context menu
chrome.contextMenus.create({
  id: 'testStream',
  title: 'Test this stream',
  contexts: ['video', 'link', 'audio']
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const url = info.srcUrl || info.linkUrl;
  if (url) {
    addStream(tab.id, {
      url,
      type: detectStreamType(url),
      source: 'context-menu',
      timestamp: Date.now()
    });

    // Open popup
    chrome.action.openPopup();
  }
});

// Omnibox
chrome.omnibox.onInputEntered.addListener((text) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      addStream(tabs[0].id, {
        url: text,
        type: detectStreamType(text),
        source: 'omnibox',
        timestamp: Date.now()
      });
      chrome.action.openPopup();
    }
  });
});

// Tab cleanup
chrome.tabs.onRemoved.addListener((tabId) => {
  tabStreams.delete(tabId);
});

// Helper functions
function addStream(tabId, stream) {
  if (!tabStreams.has(tabId)) {
    tabStreams.set(tabId, []);
  }

  const streams = tabStreams.get(tabId);

  // Avoid duplicates
  if (!streams.some(s => s.url === stream.url)) {
    streams.push(stream);

    // Update badge
    chrome.action.setBadgeText({
      text: streams.length.toString(),
      tabId
    });
    chrome.action.setBadgeBackgroundColor({
      color: '#4CAF50',
      tabId
    });
  }
}

function getStreams(tabId) {
  return tabStreams.get(tabId) || [];
}

function detectStreamType(url) {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('.m3u8')) return 'HLS';
  if (urlLower.includes('.mpd')) return 'DASH';
  if (urlLower.includes('.ism')) return 'MSS';
  if (/\.(mp4|webm|mov)/.test(urlLower)) return 'DIRECT';
  return 'UNKNOWN';
}
```

---

## 9. Sources

### Chrome Extension Development
- [Chrome Extensions Best Practices](https://developer.chrome.com/docs/webstore/best-practices)
- [Chrome Extension What's New](https://developer.chrome.com/docs/extensions/whats-new)
- [Chrome Extension Development Tips 2025](https://www.creolestudios.com/chrome-extension-development-tips/)
- [Content Scripts Documentation](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [webRequest API](https://developer.chrome.com/docs/extensions/reference/api/webRequest)
- [Manifest V3 Migration](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)

### URL Input & Postman
- [Postman Parameters Documentation](https://learning.postman.com/docs/sending-requests/create-requests/parameters/)
- [Request Parameters in Postman](https://toolsqa.com/postman/request-parameters-in-postman/)
- [Postman Community Discussion](https://community.postman.com/t/url-and-parameter-question/8686)

### Stream Detection Extensions
- [The Stream Detector](https://chromewebstore.google.com/detail/the-stream-detector/iakkmkmhhckcmoiibcfjnooibphlobak)
- [m3u8 Sniffer TV](https://chromewebstore.google.com/detail/m3u8-sniffer-tv-find-and/akkncdpkjlfanomlnpmmolafofpnpjgn)
- [Stream Detector Pro GitHub](https://github.com/muzahirabbas/StreamDetectorPro_ChromeExtension)
- [M3U8 Pro Player GitHub](https://github.com/Clement013/M3U8-Pro-Player)

### Parsing Libraries
- [m3u8-parser (Video.js)](https://github.com/videojs/m3u8-parser)
- [mpd-parser (Video.js)](https://github.com/videojs/mpd-parser)
- [dash-mpd-parser](https://github.com/liveinstantly/dash-mpd-parser)

### UX Design Systems
- [Cloudscape Key-Value Pairs](https://cloudscape.design/components/key-value-pairs/)
- [Innovaccer Key Value Pair](https://design.innovaccer.com/components/keyValuePair/usage/)
- [Working with URLs in JavaScript](https://blog.logrocket.com/working-urls-javascript/)

---

*Document generated: January 2026*
*For: Video Stream Tester Chrome Extension Project*

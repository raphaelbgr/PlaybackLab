# PlaybackLab Implementation Guide: Top Features & Data Analysis

## Executive Summary

After analyzing the codebase, manifest specifications, parser libraries, and UX best practices, this document provides a concrete implementation plan for the top 5 requested features and fixes the "Stream Info" panel data gaps.

---

## Part 1: Stream Info Panel - Why Data Shows "—"

### Current Problem

The Stream Info panel shows placeholder "—" for these fields:
- Audio: "—"
- Variants: "—"
- Max Resolution: "—"
- Audio Tracks: "—"
- Duration: "—"

### Root Causes Identified

| Field | Root Cause | Fix |
|-------|------------|-----|
| **Audio** | `hasAudio` not in initial `STREAM_DETECTED` message | Populate from content script immediately |
| **Variants** | Manifest lazy-loaded only when Overview tab opens | Auto-fetch manifest on stream detection |
| **Max Resolution** | Depends on manifest being loaded | Auto-fetch manifest |
| **Audio Tracks** | Depends on manifest being loaded | Auto-fetch manifest |
| **Duration** | Depends on manifest being loaded | Auto-fetch manifest |

### Data Flow Issue

```
Current Flow (Broken):
1. Background detects stream URL → STREAM_DETECTED (no hasAudio)
2. DevTools adds stream to store (hasAudio = undefined)
3. UI shows "—" for Audio
4. 2 seconds later: UPDATE_ACTIVE_SOURCES arrives with hasAudio
5. But matching by URL may fail, or UI doesn't re-render

Fixed Flow:
1. Background detects stream URL
2. Background ALSO fetches manifest immediately (async)
3. STREAM_DETECTED sent with basic info
4. MANIFEST_LOADED sent when manifest parsed
5. Content script sends hasAudio in STREAM_DETECTED payload
```

### Implementation Fix

**File: `src/entrypoints/background/index.ts`**

```typescript
// When stream detected, also fetch manifest
async function onStreamDetected(stream: StreamInfo) {
  // Send initial detection
  chrome.runtime.sendMessage({ type: 'STREAM_DETECTED', payload: stream });

  // Auto-fetch manifest in background
  try {
    const response = await fetch(stream.url, { headers: stream.requestHeaders });
    const content = await response.text();
    const parser = stream.type === 'hls' ? hlsParser : dashParser;
    const manifest = await parser.parse(content, stream.url);

    chrome.runtime.sendMessage({
      type: 'MANIFEST_LOADED',
      payload: { streamId: stream.id, manifest }
    });
  } catch (error) {
    // Silent fail - user can manually retry
  }
}
```

**File: `src/entrypoints/content/index.ts`**

```typescript
// Include audio detection in stream detection
function detectStreamFromVideo(video: HTMLVideoElement): Partial<StreamInfo> {
  return {
    hasAudio: hasAudioTrack(video),
    audioMuted: video.muted,
    volume: video.volume,
    playbackState: getPlaybackState(video),
  };
}
```

---

## Part 2: Top 5 Feature Implementation Plans

### Feature 1: Human-Readable Error Messages

**Location:** New file `src/shared/utils/errorExplanations.ts` (already exists, expand it)

**Design:**
```typescript
interface ErrorExplanation {
  code: string;
  title: string;
  description: string;
  possibleCauses: string[];
  suggestedFixes: string[];
  learnMoreUrl?: string;
}

const HLS_ERRORS: Record<string, ErrorExplanation> = {
  'manifestLoadError': {
    title: 'Manifest Load Failed',
    description: 'The HLS manifest (.m3u8) could not be loaded.',
    possibleCauses: [
      'CORS policy blocking the request',
      'Invalid URL or 404 error',
      'Network connectivity issues',
      'Authentication required (missing token)',
    ],
    suggestedFixes: [
      'Check browser console for CORS errors',
      'Verify the manifest URL is accessible',
      'Check if authentication headers are needed',
    ],
  },
  'MEDIA_ERR_DECODE': {
    title: 'Media Decode Error',
    description: 'The browser could not decode the video/audio data.',
    possibleCauses: [
      'Unsupported codec (e.g., HEVC on Chrome without hardware)',
      'Corrupted segment data',
      'Codec mismatch between manifest and actual content',
    ],
    suggestedFixes: [
      'Check codecs in manifest match actual segments',
      'Try a different browser or device',
      'Verify segment files are not corrupted',
    ],
  },
  // ... 20+ more error codes
};
```

**UI Component:** `src/entrypoints/devtools-panel/components/ErrorDisplay.tsx`

```tsx
function ErrorDisplay({ error }: { error: string }) {
  const explanation = getErrorExplanation(error);

  return (
    <div className="error-card">
      <div className="error-header">
        <span className="error-icon">⚠️</span>
        <span className="error-title">{explanation.title}</span>
      </div>
      <p className="error-description">{explanation.description}</p>

      <details>
        <summary>Possible Causes</summary>
        <ul>
          {explanation.possibleCauses.map(cause => <li key={cause}>{cause}</li>)}
        </ul>
      </details>

      <details>
        <summary>Suggested Fixes</summary>
        <ul>
          {explanation.suggestedFixes.map(fix => <li key={fix}>{fix}</li>)}
        </ul>
      </details>
    </div>
  );
}
```

---

### Feature 2: Manifest Visualization (Variants Table)

**Location:** Enhance `src/entrypoints/devtools-panel/components/ManifestViewer.tsx`

**Current State:** Basic table exists but needs polish

**Design Improvements:**

```tsx
// Sortable, filterable variants table
function VariantsTable({ variants }: { variants: VideoVariant[] }) {
  const [sortBy, setSortBy] = useState<'bandwidth' | 'resolution'>('bandwidth');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(() => {
    return [...variants].sort((a, b) => {
      const aVal = sortBy === 'bandwidth' ? a.bandwidth : (a.width * a.height);
      const bVal = sortBy === 'bandwidth' ? b.bandwidth : (b.width * b.height);
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });
  }, [variants, sortBy, sortDir]);

  return (
    <table className="variants-table">
      <thead>
        <tr>
          <th onClick={() => toggleSort('resolution')}>Resolution</th>
          <th onClick={() => toggleSort('bandwidth')}>Bandwidth</th>
          <th>Codecs</th>
          <th>Frame Rate</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((v, i) => (
          <tr key={i} className={v.isActive ? 'active' : ''}>
            <td>{v.width}×{v.height}</td>
            <td className="mono">{formatBitrate(v.bandwidth)}</td>
            <td className="mono">{v.codecs || '—'}</td>
            <td>{v.frameRate ? `${v.frameRate}fps` : '—'}</td>
            <td>
              <button onClick={() => copyUrl(v.url)}>Copy URL</button>
              <button onClick={() => copyAsCurl(v.url)}>cURL</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

**Visual Enhancements:**
- Color-coded bandwidth bars (green=low, yellow=medium, red=high)
- Highlight active/playing variant
- Codec badges (H.264, HEVC, AV1)
- Resolution icons (SD, HD, FHD, 4K)

---

### Feature 3: Auto-Detect Streams on Page

**Current State:** Already implemented via `chrome.webRequest.onBeforeRequest`

**Enhancements Needed:**

1. **Better master manifest detection:**
```typescript
// In StreamDetector.ts
function isMasterManifest(url: string, content?: string): boolean {
  // HLS: Contains #EXT-X-STREAM-INF (variant streams)
  if (content?.includes('#EXT-X-STREAM-INF')) return true;

  // DASH: Contains <AdaptationSet> (multiple representations)
  if (content?.includes('<AdaptationSet')) return true;

  // URL heuristics
  if (url.includes('master') || url.includes('main') || url.includes('index')) {
    return true;
  }

  return false;
}
```

2. **Page scanner for SPA sites:**
```typescript
// In content script - scan for dynamically loaded players
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node instanceof HTMLVideoElement) {
        detectVideoSource(node);
      }
    }
  }
});

observer.observe(document.body, { childList: true, subtree: true });
```

3. **Player library detection:**
```typescript
// Detect which player is being used
function detectPlayerLibrary(): string | null {
  if (window.Hls) return 'hls.js';
  if (window.dashjs) return 'dash.js';
  if (window.shaka) return 'shaka-player';
  if (window.videojs) return 'video.js';
  if (window.jwplayer) return 'jwplayer';
  if (window.Bitmovin) return 'bitmovin';
  return null;
}
```

---

### Feature 4: DRM Inspector

**Location:** `src/entrypoints/devtools-panel/components/DrmInspector.tsx`

**Data Available from Manifest:**
- DRM type (Widevine, FairPlay, PlayReady)
- License URL
- Key ID
- PSSH data (base64)

**Data NOT Available (requires player hooking):**
- License request/response content
- Key status (usable, expired, output-restricted)
- Security level

**Implementation:**

```tsx
function DrmInspector({ drm }: { drm: DrmInfo[] }) {
  return (
    <div className="drm-inspector">
      <h3>DRM Protection Detected</h3>

      {drm.length === 0 && (
        <div className="no-drm">
          <span className="icon">🔓</span>
          <span>No DRM detected - stream is unencrypted</span>
        </div>
      )}

      {drm.map((info, i) => (
        <div key={i} className="drm-card">
          <div className="drm-header">
            <DrmBadge type={info.type} />
            <span className="drm-name">{getDrmDisplayName(info.type)}</span>
          </div>

          {info.licenseUrl && (
            <div className="drm-field">
              <label>License URL:</label>
              <code>{info.licenseUrl}</code>
              <button onClick={() => copyToClipboard(info.licenseUrl)}>Copy</button>
            </div>
          )}

          {info.keyId && (
            <div className="drm-field">
              <label>Key ID:</label>
              <code>{info.keyId}</code>
            </div>
          )}

          {info.pssh && (
            <details>
              <summary>PSSH Data (Base64)</summary>
              <pre className="pssh-data">{info.pssh}</pre>
              <button onClick={() => decodePssh(info.pssh)}>Decode PSSH</button>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}

function getDrmDisplayName(type: string): string {
  const names: Record<string, string> = {
    'widevine': 'Google Widevine',
    'fairplay': 'Apple FairPlay',
    'playready': 'Microsoft PlayReady',
    'clearkey': 'W3C Clear Key',
  };
  return names[type] || type;
}
```

**PSSH Decoder (Pro Feature):**
```typescript
// Decode PSSH box to show key IDs
function decodePssh(base64: string): PsshInfo {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  // Parse PSSH box structure
  // Box size (4 bytes) + 'pssh' (4 bytes) + version (1 byte) + flags (3 bytes)
  // + System ID (16 bytes) + Key ID count (4 bytes) + Key IDs...

  return {
    systemId: extractSystemId(bytes),
    keyIds: extractKeyIds(bytes),
    data: extractData(bytes),
  };
}
```

---

### Feature 5: Real-Time Buffer/Bitrate Graphs

**Location:** `src/entrypoints/devtools-panel/components/MetricsView.tsx`

**Data Collection (Content Script):**

```typescript
// Collect metrics every 500ms
function collectMetrics(video: HTMLVideoElement): PlaybackMetrics {
  const quality = video.getVideoPlaybackQuality?.();

  return {
    timestamp: Date.now(),
    currentTime: video.currentTime,
    duration: video.duration,
    buffered: getBufferRanges(video),

    // From player library (if available)
    bitrate: getPlayerBitrate(),
    bandwidth: getPlayerBandwidth(),

    // Native video element
    resolution: {
      width: video.videoWidth,
      height: video.videoHeight,
    },
    droppedFrames: quality?.droppedVideoFrames ?? 0,
    totalFrames: quality?.totalVideoFrames ?? 0,
  };
}

function getBufferRanges(video: HTMLVideoElement): BufferRange[] {
  const ranges: BufferRange[] = [];
  for (let i = 0; i < video.buffered.length; i++) {
    ranges.push({
      start: video.buffered.start(i),
      end: video.buffered.end(i),
    });
  }
  return ranges;
}
```

**Chart Component:**

```tsx
import { Line } from 'react-chartjs-2';

function BitrateChart({ metrics }: { metrics: PlaybackMetrics[] }) {
  const data = {
    labels: metrics.map(m => formatTime(m.timestamp)),
    datasets: [
      {
        label: 'Bitrate (Mbps)',
        data: metrics.map(m => m.bitrate / 1_000_000),
        borderColor: '#3b82f6',
        fill: false,
      },
      {
        label: 'Buffer (seconds)',
        data: metrics.map(m => calculateBufferAhead(m)),
        borderColor: '#10b981',
        fill: false,
        yAxisID: 'y2',
      },
    ],
  };

  return <Line data={data} options={chartOptions} />;
}
```

**Buffer Timeline Visualization:**

```tsx
function BufferTimeline({ video, metrics }: Props) {
  const duration = video.duration;
  const currentTime = video.currentTime;
  const buffered = metrics.buffered;

  return (
    <div className="buffer-timeline">
      {/* Progress bar */}
      <div
        className="progress"
        style={{ width: `${(currentTime / duration) * 100}%` }}
      />

      {/* Buffer ranges */}
      {buffered.map((range, i) => (
        <div
          key={i}
          className="buffer-range"
          style={{
            left: `${(range.start / duration) * 100}%`,
            width: `${((range.end - range.start) / duration) * 100}%`,
          }}
        />
      ))}

      {/* Playhead */}
      <div
        className="playhead"
        style={{ left: `${(currentTime / duration) * 100}%` }}
      />
    </div>
  );
}
```

---

## Part 3: What Data CAN Be Extracted

### From Manifest (Available Now)

| Data | HLS | DASH | Parser Field |
|------|-----|------|--------------|
| Duration | ✅ | ✅ | `manifest.duration` |
| Is Live | ✅ | ✅ | `manifest.isLive` |
| Video Variants | ✅ | ✅ | `manifest.videoVariants[]` |
| Resolution | ✅ | ✅ | `variant.width`, `variant.height` |
| Bandwidth | ✅ | ✅ | `variant.bandwidth` |
| Codecs | ✅ | ✅ | `variant.codecs` |
| Frame Rate | ✅ | ✅ | `variant.frameRate` |
| Audio Tracks | ✅ | ✅ | `manifest.audioVariants[]` |
| Audio Language | ✅ | ✅ | `audio.language` |
| Audio Channels | ✅ | ⚠️ | `audio.channels` |
| Subtitles | ✅ | ✅ | `manifest.subtitles[]` |
| DRM Type | ✅ | ✅ | `manifest.drm[].type` |
| License URL | ✅ | ✅ | `manifest.drm[].licenseUrl` |
| PSSH Data | ❌ | ✅ | `manifest.drm[].pssh` |
| Segments | ✅ | ✅ | `manifest.segments[]` |
| Segment Duration | ✅ | ✅ | `segment.duration` |

### From HTMLVideoElement (Available Now)

| Data | Method | Notes |
|------|--------|-------|
| Current resolution | `video.videoWidth/Height` | Actual decoded resolution |
| Buffer ranges | `video.buffered` | TimeRanges object |
| Current time | `video.currentTime` | Playback position |
| Duration | `video.duration` | Total length |
| Paused state | `video.paused` | Boolean |
| Volume | `video.volume` | 0-1 float |
| Muted | `video.muted` | Boolean |
| Dropped frames | `video.getVideoPlaybackQuality()` | Chrome/Firefox |
| Total frames | `video.getVideoPlaybackQuality()` | Chrome/Firefox |

### From Player Libraries (Requires Hooking)

| Data | hls.js | dash.js | Shaka |
|------|--------|---------|-------|
| Current bitrate | `hls.levels[hls.currentLevel].bitrate` | `player.getBitrateInfoListFor('video')[idx]` | `track.bandwidth` |
| Current level | `hls.currentLevel` | `player.getQualityFor('video')` | `player.getVariantTracks().find(t => t.active)` |
| Bandwidth estimate | `hls.bandwidthEstimate` | `player.getAverageThroughput()` | `player.getStats().estimatedBandwidth` |
| Quality switch events | `LEVEL_SWITCHED` | `QUALITY_CHANGE_RENDERED` | `adaptation` |
| Buffer level | `hls.maxBufferLength` | `player.getBufferLength()` | `player.getBufferedInfo()` |

### Cannot Get Without Player Hooking

- Current playing bitrate/quality (only resolution available)
- ABR algorithm decisions
- Bandwidth estimates
- Quality switch history
- License request/response content
- Key session status
- Segment download timing

---

## Part 4: Implementation Priority

### Phase 1: Fix Stream Info Panel (Week 1)
1. Auto-fetch manifest on stream detection
2. Include `hasAudio` in initial detection
3. Fix URL matching for playback state updates

### Phase 2: Core Features (Week 2-3)
1. Error explanations system
2. Enhanced variants table with sorting
3. DRM inspector panel

### Phase 3: Metrics & Visualization (Week 4-5)
1. Real-time metrics collection
2. Bitrate/buffer charts
3. Buffer timeline visualization

### Phase 4: Advanced Features (Week 6+)
1. Player library detection and hooking
2. Active quality tracking
3. Quality switch event logging
4. PSSH decoder

---

## Part 5: File Locations Summary

| Feature | Files to Create/Modify |
|---------|------------------------|
| Error Explanations | `src/shared/utils/errorExplanations.ts` (expand) |
| | `src/entrypoints/devtools-panel/components/ErrorDisplay.tsx` (exists) |
| Manifest Visualization | `src/entrypoints/devtools-panel/components/ManifestViewer.tsx` (enhance) |
| Auto-Detection | `src/core/services/StreamDetector.ts` (enhance) |
| | `src/entrypoints/content/index.ts` (enhance) |
| DRM Inspector | `src/entrypoints/devtools-panel/components/DrmInspector.tsx` (exists) |
| | `src/shared/utils/psshDecoder.ts` (new) |
| Metrics/Charts | `src/entrypoints/devtools-panel/components/MetricsView.tsx` (enhance) |
| | `src/entrypoints/content/metricsCollector.ts` (new) |
| Player Hooking | `src/entrypoints/content/playerDetector.ts` (new) |
| | `src/entrypoints/content/playerHooks/hlsjs.ts` (new) |
| | `src/entrypoints/content/playerHooks/dashjs.ts` (new) |
| | `src/entrypoints/content/playerHooks/shaka.ts` (new) |

---

## Research Files Index

| File | Purpose |
|------|---------|
| `hls-manifest-spec.md` | HLS tag reference, EXT-X-MEDIA structure |
| `dash-mpd-spec.md` | MPD structure, ContentProtection UUIDs |
| `hls-curl-analysis.md` | Real manifest examples with extractable data |
| `dash-curl-analysis.md` | Real MPD examples with extractable data |
| `parser-library-apis.md` | m3u8-parser and mpd-parser output structures |
| `active-playback-detection.md` | How to get current quality from players |
| `chrome-devtools-network-api.md` | Network interception capabilities |
| `ux-best-practices.md` | UI/UX patterns from competitors |

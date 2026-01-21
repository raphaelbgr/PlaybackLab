# Active Playback Detection Research

## Overview

This document explores how PlaybackLab can detect and display the **currently playing video quality/variant** during HLS/DASH playback. The key question: can we show "Active Stream" info without hooking into the player?

## Executive Summary

| Approach | Feasibility | Notes |
|----------|-------------|-------|
| HTMLVideoElement native properties | **Partial** | Gets resolution, dropped frames, but NOT bitrate/variant |
| MediaSource API | **No** | Doesn't expose current quality/bitrate |
| Player API hooking (hls.js, dash.js, Shaka) | **Yes, but complex** | Requires script injection into page context |
| Content script world="MAIN" | **Yes** | Best approach for Manifest V3 |

**Recommendation:** PlaybackLab can show basic playback info (resolution, dropped frames) without player hooking. To show active bitrate/variant, we need to inject into the page context and detect which player is being used.

---

## 1. HTMLVideoElement Native Properties

The `<video>` element provides limited but useful playback information without needing player access.

### Available Properties

```javascript
const video = document.querySelector('video');

// Current video resolution (what's being decoded)
video.videoWidth;   // e.g., 1920
video.videoHeight;  // e.g., 1080

// Playback state
video.currentTime;  // Current playback position
video.duration;     // Total duration
video.paused;       // Is paused?
video.readyState;   // Buffer readiness (0-4)

// Buffered ranges
video.buffered;     // TimeRanges object
```

### VideoPlaybackQuality API

```javascript
const quality = video.getVideoPlaybackQuality();

// Available metrics
quality.totalVideoFrames;      // Total frames presented
quality.droppedVideoFrames;    // Frames dropped (performance issues)
quality.corruptedVideoFrames;  // DEPRECATED - may not be available
quality.creationTime;          // High-resolution timestamp
```

**Use case:** Calculate dropped frame percentage to show playback health:
```javascript
const dropRate = quality.droppedVideoFrames / quality.totalVideoFrames;
if (dropRate > 0.1) {
  console.warn('High frame drop rate:', (dropRate * 100).toFixed(1) + '%');
}
```

### Resize Event

```javascript
video.addEventListener('resize', () => {
  console.log('Resolution changed to:', video.videoWidth, 'x', video.videoHeight);
});
```

### Limitations

- **No bitrate information** - Cannot determine current stream bitrate
- **No variant/level info** - Don't know which quality level is active
- **No codec info** - Can't determine if playing H.264, H.265, VP9, AV1
- **No audio track info** - Can't see audio bitrate or codec

---

## 2. MediaSource API

The MediaSource Extensions (MSE) API is used by players to feed video data to the browser, but it doesn't expose quality information.

### What's Available

```javascript
// Check if video is using MSE
const mediaSource = video.srcObject; // or check if src starts with "blob:"

// If we have access to MediaSource
mediaSource.readyState;        // "open", "closed", "ended"
mediaSource.sourceBuffers;     // SourceBufferList
mediaSource.activeSourceBuffers; // Currently active buffers

// Each SourceBuffer
const sb = mediaSource.sourceBuffers[0];
sb.buffered;                   // TimeRanges of buffered content
sb.updating;                   // Is currently appending?
sb.mode;                       // "segments" or "sequence"
```

### What's NOT Available

- **Current bitrate** - Not exposed
- **Resolution of buffered content** - Not exposed after buffer creation
- **Codec being decoded** - Only known at SourceBuffer creation time
- **Quality level** - Managed by the player, not MSE

### Key Insight

The codec string is specified when creating a SourceBuffer:
```javascript
mediaSource.addSourceBuffer('video/mp4; codecs="avc1.4d0020,mp4a.40.2"');
```

But this is done by the player, and we can't query it afterward from the video element.

---

## 3. Player-Specific APIs

To get detailed quality information, we must hook into the player library itself.

### 3.1 hls.js

**GitHub:** https://github.com/video-dev/hls.js

#### Getting Current Level

```javascript
// Current quality level index (-1 = auto)
hls.currentLevel;

// All available levels
hls.levels;  // Array of level objects

// Current level details
const level = hls.levels[hls.currentLevel];
level.bitrate;    // e.g., 2500000 (bits/sec)
level.width;      // e.g., 1920
level.height;     // e.g., 1080
level.codecSet;   // e.g., "avc1,mp4a"
level.url;        // Playlist URL
```

#### Listening for Quality Changes

```javascript
hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
  const newLevel = hls.levels[data.level];
  console.log('Switched to:', {
    bitrate: newLevel.bitrate,
    resolution: `${newLevel.width}x${newLevel.height}`
  });
});

hls.on(Hls.Events.LEVEL_SWITCHING, (event, data) => {
  console.log('Starting switch to level:', data.level);
});
```

#### Bandwidth Estimation

```javascript
hls.bandwidthEstimate;  // Current estimated bandwidth (bits/sec)
Hls.ttfbEstimate;       // Time to first byte estimate
```

#### Manual Quality Selection

```javascript
// Set specific quality
hls.currentLevel = 2;  // Third quality level

// Enable auto quality
hls.currentLevel = -1;
```

**Source:** [hls.js API Documentation](https://github.com/video-dev/hls.js/blob/master/docs/API.md)

---

### 3.2 dash.js

**GitHub:** https://github.com/Dash-Industry-Forum/dash.js

#### Getting Current Quality

```javascript
// Get current quality index for video
player.getQualityFor('video');  // Returns index (e.g., 2)
player.getQualityFor('audio');  // Same for audio

// Get all available qualities
player.getBitrateInfoListFor('video');
// Returns: [{
//   mediaType: "video",
//   bitrate: 300000,
//   width: 640,
//   height: 360,
//   qualityIndex: 0
// }, ...]

// v5+ alternative
player.getRepresentationsByType('video');
```

#### Listening for Quality Changes

```javascript
player.on(dashjs.MediaPlayer.events.QUALITY_CHANGE_REQUESTED, (e) => {
  console.log('Quality change requested:', e);
});

player.on(dashjs.MediaPlayer.events.QUALITY_CHANGE_RENDERED, (e) => {
  console.log('Quality change rendered:', e);
  // e.mediaType, e.oldQuality, e.newQuality
});
```

#### Manual Quality Selection

```javascript
// Switch to quality index 2
player.setQualityFor('video', 2);

// Set initial bitrate
player.setInitialBitrateFor('video', 5000000); // 5 Mbps

// Disable ABR
player.updateSettings({ streaming: { abr: { autoSwitchBitrate: false } } });
```

**Source:** [dash.js Listening to Events Example](https://reference.dashif.org/dash.js/latest/samples/getting-started/listening-to-events.html)

---

### 3.3 Shaka Player

**GitHub:** https://github.com/shaka-project/shaka-player

#### Getting Active Variant

```javascript
// Get current active track
const activeTrack = player.getVariantTracks().find(track => track.active);

activeTrack.bandwidth;    // Bitrate in bits/sec
activeTrack.width;        // Video width
activeTrack.height;       // Video height
activeTrack.videoCodec;   // e.g., "avc1.4d401e"
activeTrack.audioCodec;   // e.g., "mp4a.40.2"
activeTrack.language;     // e.g., "en"
```

#### Comprehensive Stats

```javascript
const stats = player.getStats();

stats.estimatedBandwidth;  // Current estimated bandwidth
stats.streamBandwidth;     // Bandwidth of current stream
stats.width;               // Current video width
stats.height;              // Current video height
stats.currentCodecs;       // Current codec string
stats.decodedFrames;       // Total decoded frames
stats.droppedFrames;       // Dropped frames
stats.switchHistory;       // Array of quality switches
stats.bufferingTime;       // Total time spent buffering
stats.playTime;            // Total play time
```

#### Listening for Changes

```javascript
player.addEventListener('adaptation', (event) => {
  // Automatic ABR switch
  console.log('ABR adaptation occurred');
});

player.addEventListener('variantchanged', (event) => {
  // Manual selection or ABR switch
  const active = player.getVariantTracks().find(t => t.active);
  console.log('Variant changed to:', active);
});
```

**Source:** [Shaka Player API Documentation](https://shaka-player-demo.appspot.com/docs/api/shaka.Player.html)

---

## 4. Detection Strategy for PlaybackLab

### Challenge: Content Script Isolation

Chrome extensions run content scripts in an **isolated world** - they can access the DOM but NOT JavaScript variables on the page (like `hls`, `dashjs`, `shaka` instances).

### Solutions

#### Option A: Manifest V3 "MAIN" World (Recommended)

Inject a script that runs in the page's JavaScript context:

```javascript
// manifest.json
{
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content-isolated.js"],
    "world": "ISOLATED"  // Has chrome.* APIs
  }, {
    "matches": ["<all_urls>"],
    "js": ["content-main.js"],
    "world": "MAIN"  // Has page's window object
  }]
}
```

Communication between worlds via `window.postMessage`:

```javascript
// content-main.js (MAIN world - can see page variables)
function detectPlayers() {
  const players = [];

  // Check for hls.js
  if (window.Hls) {
    // Find instances attached to video elements
    document.querySelectorAll('video').forEach(video => {
      if (video.hls) {
        players.push({ type: 'hls', instance: video.hls });
      }
    });
  }

  // Check for dash.js
  if (window.dashjs) {
    // Implementation varies by site
  }

  // Check for Shaka
  if (window.shaka) {
    // Implementation varies by site
  }

  return players;
}

// Send data to isolated world
window.postMessage({
  type: 'PLAYBACKLAB_PLAYER_INFO',
  data: getPlayerInfo()
}, '*');

// content-isolated.js (ISOLATED world - has chrome.* APIs)
window.addEventListener('message', (event) => {
  if (event.data.type === 'PLAYBACKLAB_PLAYER_INFO') {
    chrome.runtime.sendMessage(event.data);
  }
});
```

#### Option B: Script Injection via DOM

Inject a `<script>` tag into the page:

```javascript
// content.js
const script = document.createElement('script');
script.src = chrome.runtime.getURL('injected.js');
script.onload = () => script.remove();
document.documentElement.appendChild(script);
```

Requires `web_accessible_resources` in manifest:

```json
{
  "web_accessible_resources": [{
    "resources": ["injected.js"],
    "matches": ["<all_urls>"]
  }]
}
```

---

## 5. Implementation Tiers for PlaybackLab

### Tier 1: Basic Info (No Player Hooking)

What we can show without any player detection:

| Metric | Source | Notes |
|--------|--------|-------|
| Video resolution | `video.videoWidth/Height` | Current decoded resolution |
| Dropped frames | `getVideoPlaybackQuality()` | Performance indicator |
| Buffer health | `video.buffered` | Time ranges buffered |
| Playback state | `video.paused`, `currentTime` | Basic state |

**Effort:** Low - works with existing content script

### Tier 2: Player Detection (Read-Only)

Detect which player is in use and display its state:

| Player | Detection | Key Info |
|--------|-----------|----------|
| hls.js | `window.Hls`, `video.hls` | currentLevel, bandwidth |
| dash.js | `window.dashjs` | getQualityFor(), getBitrateInfoListFor() |
| Shaka | `window.shaka` | getVariantTracks(), getStats() |

**Effort:** Medium - requires MAIN world script

### Tier 3: Real-Time Monitoring

Subscribe to player events for live updates:

- `LEVEL_SWITCHED` (hls.js)
- `QUALITY_CHANGE_RENDERED` (dash.js)
- `adaptation`, `variantchanged` (Shaka)

**Effort:** Medium-High - event subscription, state management

### Tier 4: Active Control

Allow users to:
- Force specific quality
- Disable ABR
- Adjust buffer settings

**Effort:** High - UI for controls, careful API usage

---

## 6. Summary Table

| Information | HTMLVideoElement | MSE API | Player API Required |
|-------------|------------------|---------|---------------------|
| Current resolution | Yes (`videoWidth/Height`) | No | Not needed |
| Current bitrate | No | No | **Yes** |
| Active quality level | No | No | **Yes** |
| Available qualities | No | No | **Yes** |
| Codec in use | No | No | **Yes** |
| Dropped frames | Yes (`getVideoPlaybackQuality()`) | No | Not needed |
| Buffer ranges | Yes (`buffered`) | Yes | Not needed |
| Bandwidth estimate | No | No | **Yes** |
| Quality switch history | No | No | **Yes** |

---

## 7. Recommended Implementation Path

1. **Phase 1 (MVP):** Implement Tier 1
   - Show `videoWidth x videoHeight`
   - Show dropped frame count/percentage
   - Show buffer ahead time
   - No player hooking required

2. **Phase 2:** Add MAIN world detection
   - Detect if hls.js, dash.js, or Shaka is present
   - Show player type in UI
   - Read current quality level (read-only)

3. **Phase 3:** Real-time monitoring
   - Subscribe to quality change events
   - Show live bitrate graph
   - Log quality switches with timestamps

4. **Phase 4 (Pro feature):** Quality control
   - Allow forcing specific quality
   - ABR disable/enable toggle
   - Export quality switch history

---

## References

### Official Documentation
- [hls.js API Documentation](https://github.com/video-dev/hls.js/blob/master/docs/API.md)
- [dash.js Events Example](https://reference.dashif.org/dash.js/latest/samples/getting-started/listening-to-events.html)
- [dash.js MediaPlayerEvents](https://cdn.dashjs.org/latest/jsdoc/MediaPlayerEvents.html)
- [Shaka Player API](https://shaka-player-demo.appspot.com/docs/api/shaka.Player.html)
- [MDN: HTMLVideoElement](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement)
- [MDN: VideoPlaybackQuality](https://developer.mozilla.org/en-US/docs/Web/API/VideoPlaybackQuality)
- [MDN: MediaSource API](https://developer.mozilla.org/en-US/docs/Web/API/MediaSource)
- [MDN: SourceBuffer](https://developer.mozilla.org/en-US/docs/Web/API/SourceBuffer)

### Chrome Extension Resources
- [Sharing objects with page scripts (MDN)](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Sharing_objects_with_page_scripts)
- [Accessing page variables from Chrome extension](https://kpracuk.dev/articles/accessing-websites-window-object-in-chrome-extension/)
- [Chrome Extension Message Passing (freeCodeCamp)](https://www.freecodecamp.org/news/chrome-extension-message-passing-essentials/)

### GitHub Issues & Discussions
- [hls.js Issue #1441: Confused about levels](https://github.com/video-dev/hls.js/issues/1441)
- [dash.js Issue #2528: Get current resolution](https://github.com/Dash-Industry-Forum/dash.js/issues/2528)
- [Shaka Issue #3510: getVariantTracks() no active tracks](https://github.com/shaka-project/shaka-player/issues/3510)
- [whatwg/html Issue #562: Expose quality levels](https://github.com/whatwg/html/issues/562)

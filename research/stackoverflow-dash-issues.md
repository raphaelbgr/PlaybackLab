# Stack Overflow & Community Research: DASH Streaming Debugging Issues

## Overview

This document summarizes common DASH streaming problems, dash.js issues, MPD manifest challenges, and adaptive bitrate streaming debugging challenges found across Stack Overflow, GitHub Issues, and developer communities. These insights inform PlaybackLab feature development.

**Research Date:** January 2026
**Sources:** Stack Overflow, GitHub (dash.js, Shaka Player, video.js), Fraunhofer Video-Dev, Mozilla Bugzilla

---

## 1. MPD Manifest Parsing & Structure Issues

### 1.1 SegmentTimeline Parsing Errors
**Source:** [GitHub dash.js Issue #1705](https://github.com/Dash-Industry-Forum/dash.js/issues/1705)
**Problem:** Manifests that worked in dash.js 1.5.0 fail with "Failed loading manifest...parsing failed" in versions after 1.5.1. Same manifests work in Shaka Player 2.0.1.

**PlaybackLab Features to Address:**
- Side-by-side manifest parser comparison (dash.js vs Shaka interpretation)
- SegmentTimeline repeat value (r) visualization
- Automatic validation against DASH-IF Conformance Tool

### 1.2 Duration Mismatch in Periods
**Source:** [GitHub dash.js Issue - enableManifestDurationMismatchFix](https://github.com/Dash-Industry-Forum/dash.js)
**Problem:** When `enableManifestDurationMismatchFix` is true and some periods lack `duration` field, the fix fails because calculating sum of periods returns `NaN`.

**PlaybackLab Features to Address:**
- Period duration analyzer showing missing/incorrect durations
- Visual timeline of all periods with duration validation
- Warning flags for periods without explicit duration

### 1.3 Multi-Period Manifest Playback
**Source:** [GitHub dash.js Issue #3222](https://github.com/Dash-Industry-Forum/dash.js/issues/3222)
**Problem:** Player cannot fully play manifests where periods are incrementally added on each MPD reload. Works if all periods returned in initial load.

**PlaybackLab Features to Address:**
- MPD update tracking showing period additions over time
- Period boundary visualization
- Comparison view between consecutive MPD updates

### 1.4 Timing Model Problems (DVR Window)
**Source:** [Fraunhofer Video-Dev - Common Pitfalls](https://websites.fraunhofer.de/video-dev/common-pitfalls-in-mpeg-dash-streaming/)
**Problem:** Presentation times of available media segments fall outside the time shift buffer. Player has no valid segment to download.

**PlaybackLab Features to Address:**
- DVR window calculator/visualizer
- Segment availability range display
- UTC time sync status indicator
- `calcSegmentAvailabilityRangeFromTimeline` recommendation

---

## 2. Buffer & Stalling Issues

### 2.1 Buffer Levels Too Low (dash.js v4)
**Source:** [GitHub dash.js Issue #3723](https://github.com/Dash-Industry-Forum/dash.js/issues/3723)
**Problem:** With dash.js 4.0.x, buffer levels drop under 2-3s causing constant stalling. Same streams play fine with v3.2.2 maintaining 10s+ buffer.

**PlaybackLab Features to Address:**
- Real-time buffer level visualization (target vs actual)
- Version comparison mode for testing across dash.js versions
- Buffer health score indicator

### 2.2 Stalling with Non-Empty Buffer
**Source:** [GitHub dash.js Issue #2522](https://github.com/Dash-Industry-Forum/dash.js/issues/2522)
**Problem:** Buffer shows 9s available but video stops with no error or exception thrown.

**PlaybackLab Features to Address:**
- Buffer continuity checker (detect gaps in buffered ranges)
- Silent stall detection and alerting
- Buffered ranges timeline visualization

### 2.3 Player Stalls After Pause
**Source:** [GitHub dash.js Issue #2893](https://github.com/Dash-Industry-Forum/dash.js/issues/2893)
**Problem:** Pausing live stream until buffer exhausted causes live latency jump to ~300 and playback cannot continue.

**PlaybackLab Features to Address:**
- Live latency tracker
- Pause/resume state monitoring
- Recovery state visualization

### 2.4 Low Latency Multi-Period Freezes
**Source:** [GitHub dash.js Issue #4873](https://github.com/Dash-Industry-Forum/dash.js/issues/4873)
**Problem:** Low latency DASH with multi-period content freezes at each period boundary. Both video and audio buffers drain completely.

**PlaybackLab Features to Address:**
- Period boundary stress indicator
- Low-latency specific metrics panel
- Audio/video buffer sync visualization

---

## 3. Adaptive Bitrate (ABR) Switching Problems

### 3.1 ABR Not Switching
**Source:** [GitHub dash.js Issue #991](https://github.com/Dash-Industry-Forum/dash.js/issues/991)
**Problem:** Video plays at single bitrate without switching according to network conditions.

**PlaybackLab Features to Address:**
- ABR decision log viewer
- Throughput vs selected bitrate comparison
- ABR algorithm state visualization

### 3.2 Green Artifacts on Quality Switch + Seek
**Source:** [GitHub dash.js Issue #2968](https://github.com/Dash-Industry-Forum/dash.js/issues/2968)
**Problem:** Quality switch combined with seek causes green video artifacts. ScheduleController aborts Init Fragment request.

**PlaybackLab Features to Address:**
- Quality switch event timeline
- Init segment request tracker
- Seek + switch interaction warnings

### 3.3 Stability Issues at High Bitrates
**Source:** [GitHub dash.js Issue #3853](https://github.com/Dash-Industry-Forum/dash.js/issues/3853)
**Problem:** Player switches bitrates frequently at start, then throws QuotaExceededError when SourceBuffer becomes full.

**PlaybackLab Features to Address:**
- SourceBuffer quota monitor
- Bitrate stability graph
- Memory usage tracking

### 3.4 Manual Bitrate Switch Stops Playback
**Source:** [GitHub dash.js Issue #1571](https://github.com/Dash-Industry-Forum/dash.js/issues/1571)
**Problem:** Manually changing bitrate on dynamic ABR manifests causes playback to stop (regression from v2.2 to v2.3).

**PlaybackLab Features to Address:**
- Manual bitrate control testing panel
- Playback continuity monitor during switches
- Version regression indicator

---

## 4. DRM & Encryption Issues

### 4.1 Debugging DRM-Encrypted Streams (PlayReady)
**Source:** [GitHub dash.js Issue #1615](https://github.com/Dash-Industry-Forum/dash.js/issues/1615)
**Problem:** Streams don't play in MS Edge with PlayReady DRM. Error: MEDIA_ERR_SRC_NOT_SUPPORTED (0xC00D002F). Same stream works with Widevine on Chrome.

**PlaybackLab Features to Address:**
- DRM system detection and display
- PSSH box inspector
- License request/response viewer
- Cross-browser DRM compatibility checker

### 4.2 Widevine License Request Failed
**Source:** [GitHub shaka-player Issue #8934](https://github.com/shaka-project/shaka-player/issues/8934)
**Problem:** Playback fails with MANIFEST.RESTRICTIONS_CANNOT_BE_MET in Shaka v4.12+. Older versions fall back from HD to SD gracefully.

**PlaybackLab Features to Address:**
- DRM restrictions analyzer
- Key system capability checker
- License server response decoder

### 4.3 EME Implementation Variations
**Source:** [dash.js DRM Documentation](https://dashif.org/dash.js/pages/usage/drm.html)
**Problem:** dash.js implements three EME versions. Smart TVs and STBs need customized protection models with prefixed EME calls.

**PlaybackLab Features to Address:**
- EME API version detector
- Platform-specific DRM capability report
- Robustness level tester

---

## 5. CORS & Network Errors

### 5.1 CORS Policy Violations
**Source:** [GitHub dash.js Issue #2052](https://github.com/Dash-Industry-Forum/dash.js/issues/2052)
**Problem:** No catchable error when stream lacks Access-Control-Allow-Origin header. CORS errors indistinguishable from network errors by design.

**PlaybackLab Features to Address:**
- Pre-flight CORS checker for manifest and segments
- CORS error explanation with fix suggestions
- Header inspector for all requests

### 5.2 Token-Protected Stream Parsing
**Source:** [GitHub dash.js Issue #2091](https://github.com/Dash-Industry-Forum/dash.js/issues/2091)
**Problem:** Token-protected Akamai streams parsed incorrectly in dash.js > 2.3, leading to 404 errors on subsequent segments.

**PlaybackLab Features to Address:**
- Token/query parameter preservation checker
- URL transformation tracker
- 404 pattern analyzer

---

## 6. Codec & Media Decode Errors

### 6.1 MEDIA_ERR_DECODE Recovery
**Source:** [Fraunhofer Video-Dev - Recovering from MEDIA_ERR_DECODE](https://websites.fraunhofer.de/video-dev/recovering-from-media_err_decode-errors-in-dash-js/)
**Problem:** MEDIA_ERR_DECODE errors are among the most common. dash.js 4.1.0 introduced recovery mechanism but issues persist.

**PlaybackLab Features to Address:**
- Decode error counter and classifier
- Codec compatibility checker
- Recovery attempt tracker

### 6.2 Codec Mismatch Errors
**Source:** GitHub dash.js issues
**Problem:** "Video stream codec h264 doesn't match SourceBuffer codecs" occurs intermittently (~50% failure ratio).

**PlaybackLab Features to Address:**
- SourceBuffer codec tracker
- Codec string analyzer
- Mismatch pattern detection

---

## 7. Seek & Position Issues

### 7.1 Video Freezes After Seeking
**Source:** [GitHub dash.js Issue #1784](https://github.com/Dash-Industry-Forum/dash.js/issues/1784)
**Problem:** Video freezes after seek while audio continues. Timeline progresses but video stuck. Recovery requires pause/play or another seek.

**PlaybackLab Features to Address:**
- Seek state machine visualization
- Audio/video sync detector
- Frozen frame detector

### 7.2 Player Freezes at End Positions
**Source:** [GitHub dash.js Issue #3019](https://github.com/Dash-Industry-Forum/dash.js/issues/3019)
**Problem:** Seeking to last available timecode positions causes player freeze (readyState=1, paused=false). No error raised.

**PlaybackLab Features to Address:**
- Seekable range validator
- Edge position warning
- ReadyState monitor

---

## 8. Live Stream Specific Issues

### 8.1 Live Streams Not Starting
**Source:** [GitHub shaka-player Issue #3632](https://github.com/shaka-project/shaka-player/issues/3632)
**Problem:** Segments load up to bufferingGoal but playback never starts. Stream worked previously then suddenly stopped.

**PlaybackLab Features to Address:**
- Startup sequence analyzer
- Live edge calculator
- UTCTiming element checker

### 8.2 Audio/Video Sync Issues (Multi-Period)
**Source:** [GitHub shaka-player Issue #2736](https://github.com/shaka-project/shaka-player/issues/2736)
**Problem:** Multi-Period DASH with ads causes audio/video desync. Video lags behind audio, worsening after period changes.

**PlaybackLab Features to Address:**
- A/V sync measurement tool
- Period transition analyzer
- Presentation time offset calculator

### 8.3 Dynamic to Static Manifest Switch
**Source:** [GitHub shaka-player Issue #3902](https://github.com/shaka-project/shaka-player/issues/3902)
**Problem:** DASH streams stall unpredictably after manifest switches from dynamic to static.

**PlaybackLab Features to Address:**
- Manifest type transition detector
- State machine for dynamic/static handling
- Transition health indicator

---

## 9. Error Handling & Debugging

### 9.1 Play Request Interrupted by Pause
**Source:** [GitHub dash.js Issue #1372](https://github.com/Dash-Industry-Forum/dash.js/issues/1372)
**Problem:** Uncaught DOMException breaks video.js integration. Requires hard refresh to recover.

**PlaybackLab Features to Address:**
- Play/pause state tracker
- Promise rejection handler visibility
- Integration health monitor

### 9.2 Autoplay Policy Errors
**Source:** [GitHub dash.js Issue #2873](https://github.com/Dash-Industry-Forum/dash.js/issues/2873)
**Problem:** When Chrome blocks autoplay, PLAYBACK_NOT_ALLOWED event not raised properly.

**PlaybackLab Features to Address:**
- Autoplay policy detector
- Muted autoplay fallback indicator
- Event emission tracker

---

## Feature Priority Matrix

| Issue Category | Frequency | User Impact | PlaybackLab MVP | Priority |
|---------------|-----------|-------------|-----------------|----------|
| Buffer/Stalling | Very High | Critical | Yes | P0 |
| MPD Parsing | High | High | Yes | P0 |
| ABR Switching | High | Medium | Yes | P1 |
| CORS Errors | High | Critical | Yes | P0 |
| DRM Issues | Medium | Critical | Pro | P1 |
| Codec Errors | Medium | High | Yes | P1 |
| Seek Issues | Medium | Medium | Yes | P2 |
| Live Specific | Medium | High | Pro | P1 |
| A/V Sync | Low | High | Pro | P2 |

---

## Recommended PlaybackLab Features Summary

### MVP (Free Tier)
1. **Manifest Inspector** - Parse and visualize MPD structure, periods, segments
2. **Buffer Visualizer** - Real-time buffer levels with gap detection
3. **ABR Dashboard** - Quality switches, throughput, selected bitrate
4. **Network Monitor** - Request timing, CORS checker, error classification
5. **Error Explainer** - Human-readable explanations for common errors

### Pro Tier
1. **DRM Inspector** - PSSH, license requests, key system capabilities
2. **Multi-Player Comparison** - Test same stream across dash.js/Shaka/etc
3. **Live Stream Analyzer** - DVR window, UTC sync, latency tracking
4. **A/V Sync Monitor** - Detect desync issues
5. **Regression Tester** - Compare behavior across player versions

### Team Tier
1. **Stream Health Scoring** - Automated quality metrics
2. **CI/CD Integration** - Automated stream validation
3. **Historical Comparison** - Track stream health over time
4. **Alerting** - Notifications for common issues

---

## References

- [dash.js GitHub Repository](https://github.com/Dash-Industry-Forum/dash.js)
- [Shaka Player GitHub Repository](https://github.com/shaka-project/shaka-player)
- [Fraunhofer Video-Dev Blog](https://websites.fraunhofer.de/video-dev/)
- [DASH-IF Conformance Tool](https://conformance.dashif.org/)
- [Chrome Media Panel Documentation](https://developer.chrome.com/docs/devtools/media-panel)
- [dash.js DRM Documentation](https://dashif.org/dash.js/pages/usage/drm.html)
- [OTTVerse MPEG-DASH Resources](https://ottverse.com/mpeg-dash-video-streaming-the-complete-guide/)

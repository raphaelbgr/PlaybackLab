# GitHub Issues Analysis: Video Player Debugging Feature Requests

Research on debugging features, error messages, and developer tools requests from major video streaming player repositories.

---

## Summary of Key Pain Points

### 1. **Logging and Debug Configuration Issues**
- Debug logs are hard to customize and control
- Multiple player instances share global logger state
- Console spam when debugging is enabled
- No intermediate logging levels (all or nothing)

### 2. **Error Messages Are Unhelpful**
- Numeric error codes are confusing without documentation
- Error data stored in arrays is hard to use with crash reporting tools
- Fatal errors stop playback instead of graceful recovery
- Technical jargon in errors is not user-friendly

### 3. **DRM Debugging Is Particularly Difficult**
- Widevine/PlayReady errors provide minimal context
- System codes (e.g., "Rejected with system code (30)") are undocumented
- Debug vs compiled builds behave differently with DRM

### 4. **No Integrated DevTools Experience**
- Developers must rely on console.log debugging
- No visualization of buffer states, ABR decisions, or manifest structure
- Manual network tab inspection required for troubleshooting

---

## hls.js (video-dev/hls.js)

### Debug Logging Issues

| Issue | Title | Reactions | Comments | Status |
|-------|-------|-----------|----------|--------|
| [#787](https://github.com/video-dev/hls.js/issues/787) | Not every log message goes through the debug custom logger | 0 | 3 | Closed (Wontfix) |
| [#2461](https://github.com/video-dev/hls.js/issues/2461) | Multiple Hls instances share debug/logger configuration | 0 | 0 | Closed (Fixed in v1.6.0) |
| [#4286](https://github.com/video-dev/hls.js/issues/4286) | Logs from config.debug sometimes go to the wrong place | 0 | 3 | Open |
| [#1827](https://github.com/video-dev/hls.js/issues/1827) | Hls.js Debug - showing logs in actual app | - | - | - |

**Key Pain Points:**
- Custom loggers don't receive all messages (some bypass through workers)
- Global `exportedLogger` variable causes log leakage between instances
- No example for building custom debug components
- Debug mode changes exception handling behavior unexpectedly

### Error Handling Issues

| Issue | Title | Reactions | Comments | Status |
|-------|-------|-----------|----------|--------|
| [#1714](https://github.com/video-dev/hls.js/issues/1714) | Retry on network error rather than throwing a fatal error | 2 | 6 | Closed (Answered) |
| [#7433](https://github.com/video-dev/hls.js/issues/7433) | BUFFER_STALLED_ERROR executes many times very quickly | - | - | Open |
| [#7471](https://github.com/video-dev/hls.js/issues/7471) | Regression treating HTTP status 0 differently from 404 | - | - | Open |
| [#7472](https://github.com/video-dev/hls.js/issues/7472) | Fast seeking results in fatal fragParsingError | - | - | Open |

**Key Pain Points:**
- Fatal errors stop playback entirely instead of graceful recovery
- Network errors (mobile on train) cause immediate failure
- BUFFER_STALLED_ERROR flooding causes UI freezes
- Users want configurable retry behavior, not just fatal errors

### DRM Debugging Issues

| Issue | Title | Status |
|-------|-------|--------|
| [#6947](https://github.com/video-dev/hls.js/issues/6947) | PlayReady+Widevine MultiDRM error cases | Open |
| [#5589](https://github.com/video-dev/hls.js/issues/5589) | Playing Widevine DRM video on Chromecast Receiver | - |
| [#3052](https://github.com/video-dev/hls.js/issues/3052) | DRM protected stream with AES 128 integration issues | - |

---

## video.js (videojs/video.js)

### Debug Build and Logging Issues

| Issue | Title | Reactions | Comments | Status |
|-------|-------|-----------|----------|--------|
| [#5858](https://github.com/videojs/video.js/issues/5858) | Create a debug build of videojs | 1 | 1 | Open |
| [#3803](https://github.com/videojs/video.js/issues/3803) | Disable all logs | - | - | - |
| [#3176](https://github.com/videojs/video.js/issues/3176) | Turn off warnings on browser console | - | - | - |

**Feature Request Details (Issue #5858):**
- Wrap debug code in flags for removal during production build
- Add `console.trace()` to try/catch blocks for better stack traces
- Expose internal DomData for verification during debugging
- Preserve function property names (prevent obfuscation of wrapped functions)

### Error Reporting Issues

| Issue | Title | Reactions | Comments | Status |
|-------|-------|-----------|----------|--------|
| [#1035](https://github.com/videojs/video.js/issues/1035) | Better error reporting | 0 | 13 | Closed |
| [#6799](https://github.com/videojs/video.js/issues/6799) | Get original error that caused videojs error | - | - | - |
| [#6280](https://github.com/videojs/video.js/issues/6280) | How to catch VIDEOJS ERROR? | - | - | - |

**Key Pain Points:**
- Error messages show only `["Video Error", Object]` with no context
- `player.error()` doesn't always provide meaningful information
- MediaError API provides limited error details
- Users want descriptive messages like "MEDIA_ERR_DECODE" not raw objects

### Console Spam (videojs/http-streaming)

| Issue | Title | Reactions | Comments | Status |
|-------|-------|-----------|----------|--------|
| [#1041](https://github.com/videojs/http-streaming/issues/1041) | BufferBasedABR + log.debug spams console | 0 | 11 | - |

**Problem:** Enabling debug logging with experimentalBufferBasedABR floods console with repeated messages about playlist selection and bitrate switching:
- Performance impact: Multiple players become sluggish due to logging overhead
- Log noise: Messages repeat rapidly, making it impossible to find relevant info
- **Suggested Fix:** Implement deduplication ("last message repeated X times")

### DRM Issues

| Issue | Title | Status |
|-------|-------|--------|
| [#6374](https://github.com/videojs/video.js/issues/6374) | PlayReady not working v7.6.6 | - |
| [#8352](https://github.com/videojs/video.js/issues/8352) | Widevine DRM + DASH Audio not playing, no error | - |
| [#260](https://github.com/videojs/http-streaming/issues/260) | Unable to play dash with widevine drm | - |

---

## dash.js (Dash-Industry-Forum/dash.js)

### Logging System Improvements

| Issue | Title | Reactions | Comments | Status |
|-------|-------|-----------|----------|--------|
| [#2601](https://github.com/Dash-Industry-Forum/dash.js/issues/2601) | Improve logging | 0 | 1 | Closed (Implemented in PR #2613) |
| [#2537](https://github.com/Dash-Industry-Forum/dash.js/issues/2537) | How do I disable logging if not directly interacting with MediaPlayer? | - | - | - |

**Original Problem (Issue #2601):**
> "The current dash.js framework produces a flood of log information. It can be turned off entirely or consumed in totality - there is no intermediate level."

**Requested Features:**
- Level-based logging system (debug, info, warning, error, fatal)
- New MediaPlayer API method to select log levels
- Class names enabled by default
- Deprecation of log EVENT function

**Resolution:** Implemented log levels in PR #2613:
- `dashjs.Debug.LOG_LEVEL_DEBUG`
- `dashjs.Debug.LOG_LEVEL_WARNING`
- `dashjs.Debug.LOG_LEVEL_ERROR`
- `dashjs.Debug.LOG_LEVEL_FATAL`

---

## shaka-player (shaka-project/shaka-player)

### Error Reporting Issues

| Issue | Title | Reactions | Comments | Status |
|-------|-------|-----------|----------|--------|
| [#2617](https://github.com/shaka-project/shaka-player/issues/2617) | Error reporting refactor | 0 | 5 | Closed (Seeking PR, P3) |
| [#201](https://github.com/shaka-project/shaka-player/issues/201) | Error codes | 0 | 9 | Closed (Resolved in v2.0) |
| [#6533](https://github.com/shaka-project/shaka-player/issues/6533) | webOS 4032 error in compiled version but not debug version | - | - | Open |

**Error Reporting Refactor Request (Issue #2617):**

> "Error details in error.data array is fine when debugging, but for filtering and grouping errors in a crash reporting tool it's almost impossible to work with. Those tools usually only support simple operations like 'equals' and 'contains' in their query languages and can't access a JSON blob to check elements of an array."

**Requested Changes:**
1. Replace numeric error codes with string names
2. Convert error.data from array to key-value object
3. Add "domain" attribute for SDK identification

**Key Pain Points:**
- Numeric codes require documentation lookup (e.g., "1001 means BAD_HTTP_STATUS")
- Crash reporting tools can't easily query array-based error data
- Compiled build shows cryptic errors like "Error code 1001" vs debug build shows human-readable text
- Different behavior between debug and compiled builds causes confusion

### Debug vs Production Differences

| Issue | Title | Status |
|-------|-------|--------|
| [#6533](https://github.com/shaka-project/shaka-player/issues/6533) | webOS 4032 error in compiled version but not debug version | Open |

**Problem:** Playback works with debug build (`shaka-player.compiled.debug.js`) but fails with compiled build on webOS devices.

### DRM Debugging Challenges

| Issue | Title | Status |
|-------|-------|--------|
| [#2702](https://github.com/shaka-project/shaka-player/issues/2702) | Rejected with system code (30) | - |

**Problem:** Widevine errors return cryptic system codes (e.g., "Rejected with system code (30)") with no documentation available. The FAQ notes these indicate "something is wrong at the policy level" but provides no specifics.

---

## Common Feature Requests Across All Players

### 1. Better Logging Control
- **Request:** Granular log levels (debug, info, warn, error, fatal)
- **Request:** Per-instance logger configuration
- **Request:** Ability to completely disable console output
- **Request:** Log deduplication to prevent console spam

### 2. Human-Readable Error Messages
- **Request:** String-based error codes instead of numeric
- **Request:** Structured error data (objects vs arrays)
- **Request:** Actionable error messages with suggested fixes
- **Request:** Same error format in debug and production builds

### 3. Graceful Error Recovery
- **Request:** Configurable retry behavior for network errors
- **Request:** Non-fatal errors that allow playback to continue
- **Request:** Better backoff strategies for intermittent failures

### 4. DRM Debugging Tools
- **Request:** Clearer Widevine/PlayReady error explanations
- **Request:** System code documentation
- **Request:** License request/response inspection tools

### 5. Developer Tools Integration
- **Request:** Chrome DevTools panel for video debugging
- **Request:** Buffer visualization
- **Request:** ABR decision logging
- **Request:** Manifest structure viewer
- **Request:** Real-time metrics dashboard

---

## Opportunity for PlaybackLab

Based on this research, PlaybackLab can address these pain points:

### High-Value Features
1. **Unified logging viewer** - Capture and display logs from all player types with filtering
2. **Human-readable error explanations** - Map error codes to descriptions and suggested fixes
3. **Manifest structure visualization** - Parse and display HLS/DASH manifest hierarchy
4. **Buffer state visualization** - Real-time buffer level charts
5. **DRM debugging panel** - Show license request/response details, key status
6. **Network request inspector** - Track segment/manifest fetches with timing
7. **ABR decision logger** - Show quality level switches with reasons

### Pain Points PlaybackLab Directly Solves
- "No usable stack traces in compiled builds" - Capture all events regardless of build
- "Crash reporting tools can't query array data" - Structured export of error data
- "Console spam makes debugging impossible" - Filtered, searchable log view
- "Numeric error codes require documentation lookup" - Built-in error code database
- "Different behavior between debug/production" - Works with any build

---

## References

### hls.js
- Repository: https://github.com/video-dev/hls.js
- Issues: https://github.com/video-dev/hls.js/issues

### video.js
- Repository: https://github.com/videojs/video.js
- HTTP Streaming: https://github.com/videojs/http-streaming
- Issues: https://github.com/videojs/video.js/issues

### dash.js
- Repository: https://github.com/Dash-Industry-Forum/dash.js
- Documentation: https://dsilhavy.github.io/dashjs-jekyll-documentation/

### shaka-player
- Repository: https://github.com/shaka-project/shaka-player
- Debugging Guide: https://shaka-player-demo.appspot.com/docs/api/tutorial-debugging.html
- Error Codes: https://shaka-player-demo.appspot.com/docs/api/shaka.util.Error.html

### Related Tools
- EME Logger (Chrome Extension): https://developer.chrome.com/blog/eme-logger
- Mux Data (Monitoring): https://www.mux.com/data
- chrome://media-internals (Chrome built-in)

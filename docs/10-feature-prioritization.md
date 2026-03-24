# StreamLens Feature Prioritization Matrix

> **Opinionated Recommendations for MVP Development**
> Last Updated: January 2026

---

## Executive Summary

Based on developer pain points research, competitor analysis, and monetization best practices, this document provides a definitive feature prioritization for StreamLens - a Chrome extension for HLS/DASH stream debugging.

**Core Principle**: Solve the top 3 pain points exceptionally well. Don't be another "does everything poorly" tool.

**Target Users**: Video streaming developers, QA engineers, DevOps teams debugging playback issues.

---

## The Top 3 Pain Points to Solve (In Order)

From the developer pain points research, these cause the most frustration:

| Rank | Pain Point | Frequency | Current Solutions | Opportunity |
|------|-----------|-----------|-------------------|-------------|
| 1 | **Cryptic/Unhelpful Error Messages** | Very High | Trial and error, GitHub searches | Plain-language error translation |
| 2 | **DRM Debugging is Extremely Difficult** | Very High | Multiple physical devices, custom logging | License request/response inspection |
| 3 | **Manifest/Playlist Parsing Failures** | High | Apple tools (Mac only), manual inspection | Real-time manifest validation |

---

## Feature Prioritization Matrix

### MUST-HAVE: MVP Features (v1.0)

**These are the minimum features to charge money. Ship these FIRST.**

#### 1. Stream Detection & Basic Playback
- **What**: Auto-detect HLS (m3u8) and DASH (mpd) streams on any page
- **Why**: Table stakes - every competitor does this
- **Effort**: Low
- **Impact**: High (enables all other features)
- **Implementation**: Use hls.js and dash.js libraries

#### 2. Manifest Inspector with Validation
- **What**: Parse and display manifest structure, highlight errors/warnings
- **Why**: Solves Pain Point #3 (Manifest Parsing Failures)
- **Effort**: Medium
- **Impact**: Very High
- **Differentiator**: No Chrome extension does this well
- **Details**:
  - Show all variant streams with bitrates
  - Display segment URLs and durations
  - Highlight malformed tags or missing required fields
  - Support both HLS and DASH in single view

#### 3. Plain-Language Error Reporting
- **What**: Translate cryptic error codes to human-readable explanations
- **Why**: Solves Pain Point #1 (Cryptic Error Messages)
- **Effort**: Medium
- **Impact**: Very High (most requested feature)
- **Differentiator**: NO tool does this - massive opportunity
- **Details**:
  - Build error code database from ExoPlayer, hls.js, dash.js, Shaka Player
  - Include common causes and suggested fixes
  - Provide links to relevant documentation
  - Copy-able error reports for bug filing

#### 4. Real-Time Buffer Health Visualization
- **What**: Visual indicator of buffer level (green/yellow/red)
- **Why**: Solves buffering stall debugging
- **Effort**: Low
- **Impact**: High
- **Details**:
  - Current buffer size in seconds
  - Network throughput graph
  - Visual timeline of segment downloads

#### 5. Basic Network Request Inspector
- **What**: Show all streaming-related network requests
- **Why**: CORS issues are Pain Point #8
- **Effort**: Low-Medium
- **Impact**: High
- **Details**:
  - Filter for streaming requests only (m3u8, mpd, segments)
  - Show response codes and headers
  - Highlight failed requests with clear reasons

#### 6. DevTools Panel Integration
- **What**: Appear as a DevTools panel (like MP4Inspector does)
- **Why**: Developer-friendly, doesn't inject into pages
- **Effort**: Low
- **Impact**: High (professional feel)
- **Differentiator**: Most tools inject popups or overlays

**MVP TOTAL: 6 features that solve real problems.**

---

### SHOULD-HAVE: Version 1.1 Features

**Important but not critical for launch. Build after validating MVP.**

#### 7. DRM Debugging Panel
- **What**: Inspect license request/response, show key system info
- **Why**: Solves Pain Point #2 (DRM Debugging)
- **Effort**: High
- **Impact**: Very High for enterprise users
- **Why Not MVP**: Complex to implement, smaller user base initially
- **Details**:
  - License server request/response viewer
  - Key system detection (Widevine, FairPlay, PlayReady, ClearKey)
  - Security level indicator
  - Common DRM error explanations

#### 8. ABR (Adaptive Bitrate) Debugging
- **What**: Show quality switch history with reasoning
- **Why**: Solves Pain Point #7 (ABR Algorithm Debugging)
- **Effort**: Medium
- **Impact**: Medium-High
- **Details**:
  - Timeline of quality switches
  - Throughput estimation visualization
  - Current vs available bitrates

#### 9. A/V Sync Monitoring
- **What**: Show audio/video timestamp drift
- **Why**: Solves Pain Point #6 (Audio/Video Sync Issues)
- **Effort**: Medium
- **Impact**: Medium
- **Details**:
  - PTS/DTS timestamp display
  - Drift detection alerts
  - Sync status indicator

#### 10. Export & Share Debug Reports
- **What**: Generate shareable JSON/PDF reports
- **Why**: Team collaboration, bug filing
- **Effort**: Low
- **Impact**: Medium-High
- **Premium Potential**: This is a PAID tier feature
- **Details**:
  - Export session data as JSON
  - Include device info, stream details, error history
  - Shareable link option

#### 11. WebVTT/Subtitle Validator
- **What**: Parse and validate caption files
- **Why**: Solves Pain Point #9 (Subtitle Issues)
- **Effort**: Low-Medium
- **Impact**: Medium
- **Details**:
  - Preview captions alongside video
  - Timing validation
  - Format error detection

#### 12. Segment Metadata Inspector
- **What**: View individual segment details (duration, keyframes, codecs)
- **Why**: Deep debugging for encoding issues
- **Effort**: Medium
- **Impact**: Medium
- **Details**:
  - Click any segment to inspect
  - Show codec information
  - Keyframe placement visualization

---

### NICE-TO-HAVE: Version 2.0 Features

**Advanced features for power users. Build based on user feedback.**

#### 13. Stream Comparison Mode
- **What**: Side-by-side comparison of two streams
- **Why**: A/B testing, troubleshooting production vs staging
- **Effort**: High
- **Impact**: Medium
- **Premium Potential**: Team/Enterprise tier feature

#### 14. Network Condition Simulation
- **What**: Throttle bandwidth to test ABR behavior
- **Why**: Test streams under various conditions
- **Effort**: High
- **Impact**: Medium
- **Alternative**: Chrome DevTools already has network throttling

#### 15. Live Latency Dashboard
- **What**: Show live edge distance, catch-up behavior
- **Why**: Solves Pain Point #10 (Live Streaming Latency)
- **Effort**: Medium
- **Impact**: Medium (only for live streams)

#### 16. Platform Capability Matrix
- **What**: Show what codecs/formats current browser supports
- **Why**: Solves Pain Point #5 (Cross-Platform Issues)
- **Effort**: Low
- **Impact**: Low-Medium

#### 17. Historical Playback Timeline
- **What**: Record and replay debug session
- **Why**: Post-mortem debugging
- **Effort**: High
- **Impact**: Low-Medium

#### 18. API/Webhook Integration
- **What**: Send debug data to external monitoring systems
- **Why**: Enterprise integration with DataDog, Splunk, etc.
- **Effort**: High
- **Impact**: Medium
- **Premium Potential**: Enterprise tier feature

#### 19. Team Collaboration Features
- **What**: Share debug sessions, comments, annotations
- **Why**: Team debugging workflows
- **Effort**: Very High
- **Impact**: Medium
- **Premium Potential**: Enterprise tier feature

#### 20. AI-Powered Error Suggestions
- **What**: Use LLM to suggest fixes based on error context
- **Why**: Differentiation, modern approach
- **Effort**: High
- **Impact**: Unknown (experimental)
- **Risk**: API costs, accuracy concerns

---

### WON'T-HAVE: Features to Avoid

**Features that add complexity without value or create risks.**

#### Proxy/MITM Functionality
- **Why Avoid**:
  - Complex to implement correctly
  - Security/privacy concerns
  - Potential for misuse
  - Certificate management headaches
  - Extension store policy violations risk

#### Stream Downloading
- **Why Avoid**:
  - Attracts pirates, not developers
  - DMCA/legal risks
  - Gets extensions removed from store (see HLS Downloader)
  - Distracts from debugging focus
  - Competitors already saturate this space

#### Cryptocurrency/Payment Features
- **Why Avoid**:
  - Banned by Chrome Web Store
  - Instant rejection

#### Ad Injection
- **Why Avoid**:
  - Policy violation
  - User trust destruction
  - Single-purpose violation

#### Remote Code Execution
- **Why Avoid**:
  - Manifest V3 prohibits this
  - Security risk

#### Browser Performance Monitoring
- **Why Avoid**:
  - Scope creep
  - Not related to video debugging
  - Single-purpose violation risk

#### Video Editing/Conversion
- **Why Avoid**:
  - Completely different product
  - Scope creep
  - Resource intensive

#### Cross-Tab/Browser Sync
- **Why Avoid**:
  - Complex to implement
  - Requires cloud infrastructure
  - Privacy concerns
  - Save for v3.0 if ever

---

## Competitor Feature Analysis

### How Competitors Prioritize Features

| Tool | Focus Area | What They Got Right | What They Got Wrong |
|------|-----------|---------------------|---------------------|
| **Native HLS Playback** | Simple playback | Easy to use, lightweight | No debugging, HLS only |
| **Native DASH+HLS** | Multi-protocol playback | Supports both protocols | No debugging at all |
| **Stream Recorder** | Downloading | Large user base | Pirates > developers, reliability issues |
| **MP4Inspector** | Container analysis | DevTools integration, technical depth | MP4 only, no manifest analysis |
| **debug.video** | Deep debugging | Excellent for power users | Desktop only, requires ffmpeg |
| **Shaka Player Demo** | Reference implementation | Comprehensive player features | Web only, no extension |

### Features Competitors Charge For

Based on ExtensionPay and premium extension research:

| Feature | Price Point | Justification |
|---------|-------------|---------------|
| **Export/Reports** | $5-15/month | Saves time filing bugs |
| **Team Sharing** | $20-50/month | Collaboration value |
| **API Access** | $30-100/month | Integration value |
| **Priority Support** | $10-20/month | Time savings |
| **Extended History** | $5-10/month | More data retention |

### Features That Get Complaints When Missing

From competitor reviews:

1. **"No debug information"** - Most common complaint
2. **"Can't see manifest details"** - High frequency
3. **"Doesn't work with DRM"** - Medium frequency
4. **"Playback fails with no explanation"** - High frequency
5. **"Need command line tools"** - Medium frequency

---

## Recommended Pricing Tiers

### Free Tier (Get Users + Reviews)
- Stream detection and basic playback
- Manifest inspector (view only, no export)
- Plain-language errors (last 5 errors)
- Buffer visualization
- Network request viewer (last 10 requests)

### Pro Tier ($9/month or $79/year)
- Everything in Free
- Full error history
- Export debug reports
- DRM debugging panel
- ABR debugging
- A/V sync monitoring
- Priority email support

### Team Tier ($29/month per seat)
- Everything in Pro
- Shareable debug sessions
- Team management
- Extended data retention (30 days)
- Priority support

---

## Development Roadmap Recommendation

### Phase 1: MVP (4-6 weeks)
**Goal: Launch and validate market**

Week 1-2:
- Stream detection + basic playback (hls.js, dash.js integration)
- DevTools panel structure
- Basic UI framework

Week 3-4:
- Manifest inspector with validation
- Plain-language error database
- Buffer visualization

Week 5-6:
- Network request inspector
- Polish and testing
- Chrome Web Store submission

### Phase 2: v1.1 (4 weeks after MVP launch)
**Goal: Add premium features, enable monetization**

Week 1-2:
- DRM debugging panel
- ABR debugging

Week 3-4:
- Export/share functionality
- ExtensionPay integration
- Pricing tiers implementation

### Phase 3: v2.0 (Based on user feedback)
**Goal: Power user features, enterprise tier**

- Prioritize based on actual user requests
- Consider: stream comparison, API integration, team features

---

## Key Success Metrics

### MVP Success Criteria
- 100+ installs in first week
- 3+ reviews (any rating)
- <5% uninstall rate
- Zero policy violations

### v1.1 Success Criteria
- 1,000+ installs
- 4.0+ rating
- First paying customer
- <10% churn on paid tier

### v2.0 Targets
- 10,000+ installs
- $500+ MRR
- Enterprise customer acquired

---

## Final Recommendation: Build THIS First

**If you only have 2 weeks, build these 3 features:**

1. **Manifest Inspector** - No good Chrome extension does this
2. **Plain-Language Error Reporter** - Biggest unmet need
3. **Buffer Visualization** - Quick win, high visibility

**Skip these until you have paying users:**
- DRM debugging (complex, smaller audience)
- Team features (requires infrastructure)
- AI features (experimental, costly)

**Never build:**
- Downloading functionality
- Proxy/MITM features
- Anything that could be seen as enabling piracy

---

## Sources

### Feature Prioritization Methods
- [MVP Prioritization for 2025 & Beyond](https://www.aalpha.net/blog/how-to-prioritize-mvp-features/) - Aalpha
- [Top Methods to Prioritize Features for MVP](https://easternpeak.com/blog/top-methods-to-prioritize-features-for-your-mvp/) - Eastern Peak
- [UX Prioritization: 80/20, MoSCoW, Kano, RICE](https://www.curiosum.com/blog/prioritizing-ux-in-your-mvp-80-20-rule-and-other-practical-methods) - Curiosum
- [Feature Prioritization in Enterprise SaaS](https://medium.com/design-bootcamp/feature-prioritization-in-enterprise-saas-b7e20a1fcb1f) - Medium
- [SaaS Feature Prioritization Frameworks](https://www.matrixflows.com/blog/frameworks-for-prioritizing-saas-product) - MatrixFlows
- [How to Prioritize Features in SaaS](https://www.aalpha.net/blog/how-to-prioritize-features-in-saas/) - Aalpha

### Video Debugging Tools
- [debug.video](https://www.debug.video/) - HLS/DASH debugging tool
- [How to Test and Debug HLS and DASH Streams](https://www.linkedin.com/advice/3/how-do-you-test-debug-hls-dash-streams-different) - LinkedIn
- [HLS Player Extension: Features & 2025 Trends](https://www.videosdk.live/developer-hub/hls/hls-player-extension) - VideoSDK
- [Chrome DevTools Media Panel](https://developer.chrome.com/docs/devtools/media-panel) - Google
- [Using Media Panel to Debug Players](https://ottverse.com/media-panel-in-google-chrome-to-debug-media-players/) - OTTVerse

### Chrome Extension Monetization
- [How to Monetize Chrome Extension in 2025](https://www.extensionradar.com/blog/how-to-monetize-chrome-extension) - Extension Radar
- [8 Chrome Extensions with Impressive Revenue](https://extensionpay.com/articles/browser-extensions-make-money) - ExtensionPay
- [ExtensionPay](https://extensionpay.com/) - Payment processing for extensions
- [Chrome Extension MVP Development](https://mvpwizards.com/blog/chrome-extension-mvp-development-key-steps-to-success/) - MVP Wizards
- [How to Make Chrome Extension in 2025](https://www.extensionradar.com/blog/how-to-make-chrome-extension) - Extension Radar

### Developer Pain Points Research
- [ExoPlayer GitHub Issues](https://github.com/google/ExoPlayer/issues) - Common error patterns
- [hls.js GitHub Issues](https://github.com/video-dev/hls.js/issues) - Manifest parsing problems
- [dash.js GitHub Issues](https://github.com/Dash-Industry-Forum/dash.js/issues) - ABR algorithm complaints
- [Shaka Player GitHub Issues](https://github.com/shaka-project/shaka-player/issues) - DRM debugging needs

---

*This prioritization matrix reflects opinionated recommendations based on market research, competitor analysis, and developer pain point frequency. Priorities should be validated with real user feedback post-launch.*

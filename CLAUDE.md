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
- **m3u8-parser** - HLS manifest parsing
- **mpd-parser** - DASH manifest parsing
- **Chart.js** - Metrics visualization

## Commands

```bash
npm run dev        # Development mode with hot reload
npm run build      # Production build
npm run zip        # Create Chrome Web Store package
npm run test       # Run tests
npm run typecheck  # TypeScript check
```

## MVP Features (v1.0)

1. Stream URL detection (webRequest API)
2. Manifest parsing (HLS + DASH)
3. Video variants display
4. Audio tracks display
5. Basic error reporting
6. DevTools panel UI

## Research Documentation

All technical research is in `docs/`:
- URL input architecture
- Headers/auth handling
- Stream interception methods
- HLS/DASH parsing strategies
- DRM detection approaches
- Real-time metrics visualization
- Naming/branding research

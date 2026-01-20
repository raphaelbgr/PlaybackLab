# PlaybackLab

> HLS & DASH Stream Debugger Chrome Extension

Test and debug HLS, DASH, and DRM video streams. Analyze manifests, monitor quality levels, inspect DRM licenses, and visualize playback metrics.

## Features

### MVP (v1.0)
- [x] Stream URL detection (HLS/DASH)
- [x] Manifest parsing and visualization
- [ ] Video quality variants display
- [ ] Audio tracks display
- [ ] Basic error reporting
- [ ] DevTools panel UI

### Roadmap (v1.1+)
- [ ] DRM inspection (Widevine, PlayReady, FairPlay)
- [ ] Real-time metrics visualization
- [ ] Buffer state monitoring
- [ ] ABR algorithm debugging
- [ ] Network request inspector
- [ ] Export/share stream data

## Architecture

Built with **SOLID principles**:

```
src/
├── core/
│   ├── interfaces/     # Contracts (Dependency Inversion)
│   └── services/       # Implementations (Single Responsibility)
├── features/           # Feature modules
├── shared/             # Shared utilities
├── store/              # Zustand state management
└── entrypoints/        # Extension entry points
    ├── background/     # Service worker
    ├── devtools/       # DevTools page
    ├── devtools-panel/ # React panel app
    └── content/        # Content script
```

## Tech Stack

- **Framework:** WXT (Web Extension Tools)
- **UI:** React 18 + TypeScript
- **State:** Zustand
- **Parsing:** m3u8-parser, mpd-parser
- **Charts:** Chart.js + react-chartjs-2

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Create zip for Chrome Web Store
npm run zip
```

## License

MIT

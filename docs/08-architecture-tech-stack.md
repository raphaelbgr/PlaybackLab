# StreamLens Chrome Extension - Architecture & Tech Stack Research

> Research compiled: January 2026
> Purpose: Define the optimal architecture and technology stack for building StreamLens, a video stream debugging Chrome extension.

---

## Table of Contents

1. [Manifest V3 Architecture](#1-manifest-v3-architecture)
2. [UI Framework Comparison](#2-ui-framework-comparison)
3. [State Management Strategies](#3-state-management-strategies)
4. [DevTools Panel Extension Architecture](#4-devtools-panel-extension-architecture)
5. [Storage Options](#5-storage-options)
6. [Project Structure Best Practices](#6-project-structure-best-practices)
7. [Testing Strategies](#7-testing-strategies)
8. [Recommended Tech Stack](#8-recommended-tech-stack)
9. [Proposed Project Structure](#9-proposed-project-structure)

---

## 1. Manifest V3 Architecture

### Overview

Manifest V3 (MV3) is the current standard for Chrome extensions, mandatory since 2025. It introduces significant architectural changes focused on security, privacy, and performance.

### Key Components

#### 1.1 Service Workers (Replacing Background Pages)

In Manifest V2, extensions used persistent background pages that consumed resources continuously. MV3 replaces these with **service workers** that are event-driven and terminate when idle.

**Key Characteristics:**
- No DOM access (cannot use `document`, `window.localStorage`, etc.)
- Event-based lifecycle - runs only when needed
- Cannot rely on long-lived global variables
- Significantly reduced memory and CPU consumption
- Must persist state using chrome.storage or IndexedDB

**Implications for StreamLens:**
- Network monitoring logic must be event-driven
- State must be persisted to survive service worker restarts
- Use `chrome.alarms` for periodic tasks instead of `setInterval`

#### 1.2 Content Scripts

Content scripts run in the context of web pages and can:
- Access and modify the DOM
- Communicate with the service worker via messaging
- Inject scripts into the page context for deeper access

**For StreamLens:**
- Intercept video element events
- Monitor Media Source Extensions (MSE) activity
- Capture HLS.js/DASH.js player events

#### 1.3 Popup UI

The extension's popup is a small HTML page displayed when clicking the extension icon. It:
- Provides quick access to core functionality
- Cannot persist between closings
- Communicates with service worker via messaging

#### 1.4 Message Passing Architecture

Since each component runs in a separate process, communication happens through the messaging API:

```javascript
// Content script -> Service worker
chrome.runtime.sendMessage({ type: 'NETWORK_REQUEST', data: requestData });

// Service worker -> Content script
chrome.tabs.sendMessage(tabId, { type: 'UPDATE_CONFIG', config });

// Long-lived connections
const port = chrome.runtime.connect({ name: 'stream-monitor' });
port.postMessage({ type: 'START_MONITORING' });
```

### Security Restrictions

**Remote Code Execution Blocked:**
- Cannot load or execute remotely hosted JavaScript
- All code must be bundled within the extension package
- Content Security Policy (CSP) strictly enforced

**Network Request API Changes:**
- Blocking `webRequest` API deprecated for most use cases
- `declarativeNetRequest` API preferred for filtering
- For passive monitoring (like StreamLens), `webRequest` can still be used in observe mode

### References
- [Chrome Manifest V3 Documentation](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
- [Chrome Extension Architecture Guide 2026](https://jinlow.medium.com/chrome-extension-development-the-complete-system-architecture-guide-for-2026-9ae81415f93e)

---

## 2. UI Framework Comparison

### Option A: React

**Pros:**
- Rich ecosystem and component libraries
- Strong typing with TypeScript
- Virtual DOM handles frequent UI updates efficiently
- Familiar to most developers
- Excellent developer tools (React DevTools)
- 35% improvement in debugging times with component-driven architecture

**Cons:**
- Bundle size can exceed 300KB (vs ~50KB vanilla)
- Additional build configuration required
- Overkill for simple extensions

**Best For:** Complex UIs with dynamic data like StreamLens's network monitoring dashboard

### Option B: Vue

**Pros:**
- Smaller bundle than React
- Single-file components
- Gentle learning curve
- Good TypeScript support

**Cons:**
- Smaller ecosystem than React
- Less common in Chrome extension examples

### Option C: Vanilla JavaScript/TypeScript

**Pros:**
- Smallest bundle size (~50KB or less)
- No framework overhead
- Direct DOM manipulation
- Simplest build setup

**Cons:**
- Manual state management
- More boilerplate for complex UIs
- Harder to maintain at scale

### Option D: Preact

**Pros:**
- React-compatible API
- Only ~3KB gzipped
- Drop-in replacement for React in most cases

**Cons:**
- Some React features missing
- Smaller community

### Recommendation for StreamLens

**React with careful optimization** is recommended because:
1. StreamLens needs a complex, data-rich UI (network requests, timelines, charts)
2. Component reusability is essential (request lists, timeline components, etc.)
3. TypeScript integration is excellent
4. React DevTools aid debugging

**Bundle Size Mitigation:**
- Use code splitting
- Tree-shaking with Vite
- Consider Preact for production with `@preact/compat`

### References
- [React Chrome Extension Guide](https://blog.logrocket.com/creating-chrome-extension-react-typescript/)
- [Should You Use React for Chrome Extensions](https://moldstud.com/articles/p-should-you-use-react-for-chrome-extension-development-answers-to-your-questions)

---

## 3. State Management Strategies

### Challenge: Distributed State

Chrome extensions have state spread across:
- Service worker (background)
- Content scripts (per tab)
- Popup UI
- DevTools panel

Each runs in a separate process, requiring synchronization.

### State Categories

1. **Shared/Global State** - Data shared across all components:
   - User settings
   - Feature flags
   - Monitoring configuration

2. **Local/Pseudo-Global State** - Tab-specific data:
   - Captured network requests
   - Video player state
   - Timeline data

### State Management Options

#### Option 1: Chrome Storage API + React Hooks

**Best for:** Simple to medium complexity

```typescript
// Custom hook for chrome.storage
import { useChromeStorageLocal } from 'use-chrome-storage';

function SettingsPanel() {
  const [settings, setSettings] = useChromeStorageLocal('settings', defaultSettings);
  // Automatically syncs across components
}
```

**Pros:**
- Built-in sync across extension contexts
- Persistence handled automatically
- Triggers `chrome.storage.onChanged` for reactive updates

#### Option 2: Zustand with Chrome Extension Adapter

**Best for:** Complex state with multiple stores

```typescript
import create from 'zustand';
import { persist } from 'zustand/middleware';
import { chromeStorageAdapter } from '@webext-pegasus/store-zustand';

const useNetworkStore = create(
  persist(
    (set) => ({
      requests: [],
      addRequest: (req) => set((state) => ({
        requests: [...state.requests, req]
      })),
    }),
    { name: 'network-store', storage: chromeStorageAdapter }
  )
);
```

**Pros:**
- Familiar API for React developers
- DevTools support (Zukeeper, Zusty extensions)
- `@webext-pegasus/store-zustand` handles cross-context sync
- Time-travel debugging available

#### Option 3: Background Script as State Manager

**Pattern:** Centralized state in service worker

```typescript
// background.ts (service worker)
let state = { requests: [], settings: {} };

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'ADD_REQUEST':
      state.requests.push(message.payload);
      broadcastState();
      break;
    case 'GET_STATE':
      sendResponse(state);
      break;
  }
});

function broadcastState() {
  chrome.runtime.sendMessage({ type: 'STATE_UPDATE', state });
}
```

**Pros:**
- Single source of truth
- Atomic updates guaranteed
- Works without external libraries

**Cons:**
- More boilerplate
- Manual sync implementation

### Recommendation for StreamLens

**Zustand with @webext-pegasus/store-zustand** because:
1. Clean API for complex state (network requests, timeline data)
2. Automatic cross-context synchronization
3. DevTools integration for debugging
4. Middleware support for persistence

### References
- [Effective State Management in Chrome Extensions](https://reintech.io/blog/effective-state-management-chrome-extensions)
- [Zustand Chrome Extension Discussion](https://github.com/pmndrs/zustand/discussions/2020)
- [@webext-pegasus/store-zustand](https://www.npmjs.com/package/@webext-pegasus/store-zustand)

---

## 4. DevTools Panel Extension Architecture

### Overview

DevTools extensions add custom panels to Chrome DevTools, similar to Elements, Network, and Sources panels. This is **ideal for StreamLens** as it integrates naturally with the developer workflow.

### Architecture Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Chrome DevTools                          │
├─────────────────────────────────────────────────────────────┤
│  Elements │ Console │ Network │ ... │ StreamLens Panel │   │
│                                      ├──────────────────────┤
│                                      │  Panel.html          │
│                                      │  ├── React App       │
│                                      │  └── Panel.js        │
└─────────────────────────────────────────────────────────────┘
         ▲                                      │
         │                                      │
         │ chrome.devtools.inspectedWindow      │
         │ chrome.devtools.network              │
         ▼                                      ▼
┌─────────────────────┐              ┌─────────────────────┐
│   Inspected Page    │◄────────────►│   Service Worker    │
│   (Content Script)  │   messaging  │   (Background)      │
└─────────────────────┘              └─────────────────────┘
```

### Creating a DevTools Panel

#### 1. Manifest Configuration

```json
{
  "manifest_version": 3,
  "name": "StreamLens",
  "devtools_page": "devtools.html"
}
```

#### 2. DevTools Entry Point (devtools.html)

```html
<!DOCTYPE html>
<html>
<body>
  <script src="devtools.js"></script>
</body>
</html>
```

#### 3. Panel Creation (devtools.js)

```javascript
chrome.devtools.panels.create(
  "StreamLens",           // Panel title
  "icons/icon16.png",     // Panel icon
  "panel.html",           // Panel HTML page
  (panel) => {
    // Panel created callback
    panel.onShown.addListener((panelWindow) => {
      // Panel is now visible
    });
    panel.onHidden.addListener(() => {
      // Panel is hidden
    });
  }
);
```

### DevTools APIs Available

| API | Purpose | Use in StreamLens |
|-----|---------|-------------------|
| `chrome.devtools.panels` | Create/manage panels | Main UI panel |
| `chrome.devtools.inspectedWindow` | Evaluate code in page | Get video player state |
| `chrome.devtools.network` | Monitor network | Capture HLS/DASH requests |
| `chrome.devtools.performance` | Performance monitoring | Playback performance |

### Communication Pattern

```javascript
// In DevTools panel - evaluate code in inspected page
chrome.devtools.inspectedWindow.eval(
  'window.hlsPlayer?.levels',
  (result, isException) => {
    if (!isException) {
      console.log('HLS levels:', result);
    }
  }
);

// Get network requests
chrome.devtools.network.onRequestFinished.addListener((request) => {
  if (request.request.url.includes('.m3u8') ||
      request.request.url.includes('.mpd')) {
    // Capture streaming manifest
  }
});
```

### References
- [chrome.devtools.panels API](https://developer.chrome.com/docs/extensions/reference/api/devtools/panels)
- [Extend DevTools Guide](https://developer.chrome.com/docs/extensions/how-to/devtools/extend-devtools)
- [Microsoft Edge DevTools Extension Tutorial](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/devtools-extension)

---

## 5. Storage Options

### Comparison Matrix

| Feature | chrome.storage.local | chrome.storage.sync | IndexedDB |
|---------|---------------------|---------------------|-----------|
| **Max Size** | 10MB (unlimited with permission) | 100KB total | Several GB |
| **Data Types** | JSON-serializable | JSON-serializable | Any (including Blobs) |
| **Sync Across Devices** | No | Yes | No |
| **Async** | Yes | Yes | Yes |
| **Query Capability** | Key-based only | Key-based only | Full queries, indexes |
| **Special Permissions** | `storage` | `storage` | None required |
| **Best For** | Settings, small data | User preferences | Large datasets |

### chrome.storage API

**Advantages:**
- Optimized specifically for extensions
- Automatic sync capability (sync storage)
- `onChanged` event for reactive updates
- Simple key-value API

```typescript
// Write
await chrome.storage.local.set({
  settings: { captureVideo: true },
  recentRequests: requests.slice(-100)
});

// Read
const { settings } = await chrome.storage.local.get('settings');

// Listen for changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.settings) {
    updateUI(changes.settings.newValue);
  }
});
```

### IndexedDB

**Advantages:**
- Much larger storage capacity
- Complex queries with indexes
- Stores binary data (Blobs)
- Concurrent operations via Web Workers
- 2-3x faster for large datasets (Chrome 126+)

**Use Cases for StreamLens:**
- Storing thousands of network requests
- Binary segment data for analysis
- Video frame captures

```typescript
// IndexedDB setup
const db = await openDB('streamlens', 1, {
  upgrade(db) {
    const store = db.createObjectStore('requests', { keyPath: 'id' });
    store.createIndex('timestamp', 'timestamp');
    store.createIndex('type', 'type');
  }
});

// Complex query
const hlsRequests = await db.getAllFromIndex('requests', 'type', 'hls');
```

**Note:** In MV3, use offscreen documents for IndexedDB access from service workers.

### Recommendation for StreamLens

**Hybrid Approach:**

| Data Type | Storage |
|-----------|---------|
| User settings | `chrome.storage.sync` |
| Session configuration | `chrome.storage.local` |
| Network request history | IndexedDB |
| Segment binary data | IndexedDB |
| Quick access cache | `chrome.storage.local` |

### References
- [Chrome Storage Improvements](https://developer.chrome.com/docs/chromium/indexeddb-storage-improvements)
- [IndexedDB Performance with Storage Buckets](https://developer.chrome.com/blog/maximum-idb-performance-with-storage-buckets)
- [Local Database and Chrome Extensions](https://dev.to/anobjectisa/local-database-and-chrome-extensions-indexeddb-36n)

---

## 6. Project Structure Best Practices

### Framework Comparison for 2025-2026

| Framework | GitHub Stars | Maintenance | Best For |
|-----------|-------------|-------------|----------|
| **WXT** | ~9,000 | Active (Jan 2026) | All projects - **Recommended** |
| **Plasmo** | ~10,000+ | Uncertain | React-focused projects |
| **CRXJS** | ~2,500 | Limited | Vite integration only |
| **Manual Vite** | N/A | Self-maintained | Full control |

### Why WXT is Recommended

According to the [2025 State of Browser Extension Frameworks](https://redreamality.com/blog/the-2025-state-of-browser-extension-frameworks-a-comparative-analysis-of-plasmo-wxt-and-crxjs/):

> "WXT is the superior choice for nearly all new browser extension projects in 2025."

**Key Advantages:**
1. Framework-agnostic (React, Vue, Svelte, Solid)
2. Vite-powered with fast HMR
3. Auto-generates manifest from file structure
4. Cross-browser support (Chrome, Firefox, Safari, Edge)
5. TypeScript by default
6. Nuxt-like auto-imports
7. Active maintenance and community

### WXT Project Structure

```
streamlens/
├── wxt.config.ts              # WXT configuration
├── package.json
├── tsconfig.json
├── tailwind.config.js         # If using Tailwind
│
├── entrypoints/               # Extension entry points
│   ├── background.ts          # Service worker
│   ├── content.ts             # Content script
│   ├── popup/                 # Popup UI
│   │   ├── index.html
│   │   ├── main.tsx
│   │   └── App.tsx
│   └── devtools/              # DevTools panel
│       ├── index.html
│       ├── devtools.ts        # Panel registration
│       ├── panel.html
│       └── panel/
│           ├── main.tsx
│           └── App.tsx
│
├── components/                # Shared React components
│   ├── ui/                    # Base UI components
│   │   ├── Button.tsx
│   │   ├── Table.tsx
│   │   └── Timeline.tsx
│   ├── network/               # Network monitoring
│   │   ├── RequestList.tsx
│   │   ├── RequestDetails.tsx
│   │   └── NetworkTimeline.tsx
│   └── video/                 # Video analysis
│       ├── PlayerInfo.tsx
│       ├── QualityChart.tsx
│       └── BufferStatus.tsx
│
├── lib/                       # Core libraries
│   ├── storage/               # Storage utilities
│   │   ├── chrome-storage.ts
│   │   └── indexed-db.ts
│   ├── network/               # Network interception
│   │   ├── request-capture.ts
│   │   └── hls-parser.ts
│   ├── video/                 # Video analysis
│   │   ├── player-detector.ts
│   │   └── mse-monitor.ts
│   └── messaging/             # Cross-context messaging
│       ├── types.ts
│       └── bridge.ts
│
├── stores/                    # Zustand stores
│   ├── network-store.ts
│   ├── settings-store.ts
│   └── video-store.ts
│
├── hooks/                     # Custom React hooks
│   ├── useNetworkRequests.ts
│   ├── useVideoPlayer.ts
│   └── useChromeStorage.ts
│
├── types/                     # TypeScript types
│   ├── network.ts
│   ├── video.ts
│   └── hls.ts
│
├── utils/                     # Utility functions
│   ├── formatting.ts
│   ├── timing.ts
│   └── validators.ts
│
├── assets/                    # Static assets
│   ├── icons/
│   └── styles/
│
└── public/                    # Public files copied to output
    └── icons/
        ├── icon-16.png
        ├── icon-48.png
        └── icon-128.png
```

### Alternative: Manual Vite Setup

If not using WXT, structure with multiple Vite configs:

```
streamlens/
├── vite.config.ts             # Popup/Panel config
├── vite.content.config.ts     # Content script config
├── vite.background.config.ts  # Service worker config
├── manifest.json              # Manual manifest
├── src/
│   ├── popup/
│   ├── panel/
│   ├── content/
│   ├── background/
│   └── shared/
└── dist/                      # Build output
```

### References
- [WXT Documentation](https://wxt.dev/)
- [Chrome Extension File Structure Guide 2025](https://www.extensionradar.com/blog/chrome-extension-file-structure)
- [Clean Architecture for Chrome Extensions](https://medium.com/@lucas.abgodoy/chrome-extension-development-with-clean-architecture-a-poc-22e861aa4ede)

---

## 7. Testing Strategies

### Testing Layers

```
┌─────────────────────────────────────────┐
│           E2E Tests (Playwright)        │  Integration with real browser
├─────────────────────────────────────────┤
│       Integration Tests (Vitest)        │  Component + messaging
├─────────────────────────────────────────┤
│         Unit Tests (Vitest)             │  Pure functions, utilities
└─────────────────────────────────────────┘
```

### Unit Testing with Vitest

```typescript
// lib/network/hls-parser.test.ts
import { describe, it, expect } from 'vitest';
import { parseM3U8 } from './hls-parser';

describe('HLS Parser', () => {
  it('should parse master playlist', () => {
    const playlist = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=1280000
low/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2560000
high/index.m3u8`;

    const result = parseM3U8(playlist);
    expect(result.variants).toHaveLength(2);
    expect(result.variants[0].bandwidth).toBe(1280000);
  });
});
```

### Component Testing with React Testing Library

```typescript
// components/network/RequestList.test.tsx
import { render, screen } from '@testing-library/react';
import { RequestList } from './RequestList';

describe('RequestList', () => {
  it('renders network requests', () => {
    const requests = [
      { id: '1', url: 'video.m3u8', type: 'hls', status: 200 },
      { id: '2', url: 'segment.ts', type: 'segment', status: 200 },
    ];

    render(<RequestList requests={requests} />);

    expect(screen.getByText('video.m3u8')).toBeInTheDocument();
    expect(screen.getByText('segment.ts')).toBeInTheDocument();
  });
});
```

### E2E Testing with Playwright

Playwright supports Chrome extension testing with a custom fixture:

```typescript
// e2e/fixtures.ts
import { test as base, chromium, type BrowserContext } from '@playwright/test';
import path from 'path';

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  context: async ({}, use) => {
    const pathToExtension = path.join(__dirname, '../dist');
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker');
    }
    const extensionId = background.url().split('/')[2];
    await use(extensionId);
  },
});

// e2e/devtools-panel.spec.ts
import { test } from './fixtures';
import { expect } from '@playwright/test';

test('DevTools panel loads', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto('https://example.com');

  // Open DevTools panel
  const panelPage = await context.newPage();
  await panelPage.goto(`chrome-extension://${extensionId}/panel.html`);

  // Verify panel content
  await expect(panelPage.locator('h1')).toContainText('StreamLens');
});
```

### Mocking Chrome APIs

```typescript
// test/mocks/chrome.ts
export const mockChrome = {
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
    },
    onChanged: {
      addListener: vi.fn(),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
    },
  },
  devtools: {
    inspectedWindow: {
      eval: vi.fn(),
      tabId: 1,
    },
    network: {
      onRequestFinished: {
        addListener: vi.fn(),
      },
    },
  },
};

// Setup in vitest.setup.ts
vi.stubGlobal('chrome', mockChrome);
```

### CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm test:unit
      - run: pnpm test:e2e

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

### References
- [Playwright Chrome Extensions Testing](https://playwright.dev/docs/chrome-extensions)
- [E2E Testing Chrome Extensions with Playwright](https://dev.to/corrupt952/how-i-built-e2e-tests-for-chrome-extensions-using-playwright-and-cdp-11fl)
- [Playwright Extension Testing Template](https://github.com/kelseyaubrecht/playwright-chrome-extension-testing-template)

---

## 8. Recommended Tech Stack

### Core Stack

| Category | Technology | Rationale |
|----------|------------|-----------|
| **Framework** | [WXT](https://wxt.dev/) | Best-maintained, framework-agnostic, excellent DX |
| **UI Library** | React 18+ | Rich ecosystem, component reusability, TypeScript support |
| **Language** | TypeScript | Type safety essential for complex extension |
| **Build Tool** | Vite (via WXT) | Fast HMR, modern bundling |
| **Styling** | Tailwind CSS | Utility-first, small bundle, rapid development |

### State Management

| Type | Technology | Use Case |
|------|------------|----------|
| **Global State** | [Zustand](https://github.com/pmndrs/zustand) + [@webext-pegasus/store-zustand](https://www.npmjs.com/package/@webext-pegasus/store-zustand) | Cross-context state sync |
| **Server State** | React Query (optional) | If fetching external APIs |
| **Form State** | React Hook Form | Settings forms |

### Storage

| Data Type | Storage | Reason |
|-----------|---------|--------|
| User Settings | `chrome.storage.sync` | Sync across devices |
| Session Config | `chrome.storage.local` | Quick access, small data |
| Request History | IndexedDB (via idb) | Large datasets, queries |
| Binary Data | IndexedDB | Segment analysis |

### Testing

| Type | Tool |
|------|------|
| Unit Tests | Vitest |
| Component Tests | React Testing Library |
| E2E Tests | Playwright |
| Coverage | Vitest Coverage (v8) |

### Development Tools

| Tool | Purpose |
|------|---------|
| ESLint | Linting |
| Prettier | Formatting |
| Zukeeper/Zusty | State debugging |
| React DevTools | Component debugging |

### Optional Enhancements

| Category | Options |
|----------|---------|
| Charts | Recharts, Victory, D3 |
| Icons | Lucide React, Heroicons |
| Component Library | shadcn/ui, Radix UI |
| Date Handling | date-fns |
| Data Parsing | hls.js (reference), mpd-parser |

---

## 9. Proposed Project Structure

### StreamLens Directory Structure

```
streamlens/
│
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Lint, test, build
│       └── release.yml               # Chrome Web Store deployment
│
├── wxt.config.ts                     # WXT configuration
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── vitest.config.ts
├── playwright.config.ts
│
├── entrypoints/
│   │
│   ├── background/                   # Service Worker
│   │   ├── index.ts                  # Main entry
│   │   ├── network-monitor.ts        # webRequest handling
│   │   └── message-handler.ts        # Messaging hub
│   │
│   ├── content/                      # Content Script
│   │   ├── index.ts                  # Main entry
│   │   ├── video-detector.ts         # Detect video elements
│   │   ├── player-hooks.ts           # Hook into HLS.js/dash.js
│   │   └── mse-observer.ts           # Media Source Extensions
│   │
│   ├── popup/                        # Extension Popup
│   │   ├── index.html
│   │   ├── main.tsx
│   │   └── App.tsx
│   │
│   └── devtools/                     # DevTools Panel (Main UI)
│       ├── index.html                # DevTools entry
│       ├── devtools.ts               # Panel registration
│       ├── panel.html                # Panel HTML
│       └── panel/
│           ├── main.tsx              # Panel React entry
│           ├── App.tsx               # Panel root component
│           └── routes/               # Panel views
│               ├── NetworkView.tsx
│               ├── VideoView.tsx
│               ├── TimelineView.tsx
│               └── SettingsView.tsx
│
├── components/
│   │
│   ├── ui/                           # Base UI (shadcn/ui style)
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── table.tsx
│   │   ├── tabs.tsx
│   │   ├── badge.tsx
│   │   └── tooltip.tsx
│   │
│   ├── network/                      # Network monitoring
│   │   ├── RequestList.tsx
│   │   ├── RequestDetails.tsx
│   │   ├── RequestFilters.tsx
│   │   ├── NetworkTimeline.tsx
│   │   └── WaterfallChart.tsx
│   │
│   ├── video/                        # Video analysis
│   │   ├── PlayerCard.tsx
│   │   ├── QualityLevelChart.tsx
│   │   ├── BufferVisualization.tsx
│   │   ├── BitrateGraph.tsx
│   │   └── EventLog.tsx
│   │
│   ├── hls/                          # HLS-specific
│   │   ├── ManifestViewer.tsx
│   │   ├── VariantSelector.tsx
│   │   └── SegmentList.tsx
│   │
│   └── common/                       # Shared components
│       ├── StatusIndicator.tsx
│       ├── JsonViewer.tsx
│       ├── CopyButton.tsx
│       └── EmptyState.tsx
│
├── lib/
│   │
│   ├── storage/
│   │   ├── chrome-storage.ts         # chrome.storage wrapper
│   │   ├── indexed-db.ts             # IndexedDB with idb
│   │   └── storage-keys.ts           # Storage key constants
│   │
│   ├── network/
│   │   ├── request-capture.ts        # webRequest interception
│   │   ├── request-parser.ts         # Parse request data
│   │   ├── hls-parser.ts             # M3U8 parsing
│   │   ├── dash-parser.ts            # MPD parsing
│   │   └── timing-calculator.ts      # Network timing
│   │
│   ├── video/
│   │   ├── player-detector.ts        # Detect player type
│   │   ├── hls-hooks.ts              # HLS.js integration
│   │   ├── shaka-hooks.ts            # Shaka Player integration
│   │   ├── mse-monitor.ts            # MSE API monitoring
│   │   └── quality-metrics.ts        # QoE calculations
│   │
│   ├── messaging/
│   │   ├── types.ts                  # Message type definitions
│   │   ├── bridge.ts                 # Cross-context communication
│   │   └── handlers.ts               # Message handlers
│   │
│   └── utils/
│       ├── formatting.ts             # Data formatting
│       ├── timing.ts                 # Time utilities
│       ├── filtering.ts              # Request filtering
│       └── export.ts                 # HAR/JSON export
│
├── stores/
│   ├── network-store.ts              # Network request state
│   ├── video-store.ts                # Video player state
│   ├── settings-store.ts             # User settings
│   └── ui-store.ts                   # UI state (filters, etc.)
│
├── hooks/
│   ├── useNetworkRequests.ts
│   ├── useVideoPlayer.ts
│   ├── useChromeStorage.ts
│   ├── useDevToolsNetwork.ts
│   └── useMessageBridge.ts
│
├── types/
│   ├── network.ts                    # Network request types
│   ├── video.ts                      # Video/player types
│   ├── hls.ts                        # HLS-specific types
│   ├── dash.ts                       # DASH-specific types
│   ├── messages.ts                   # Message types
│   └── storage.ts                    # Storage schemas
│
├── constants/
│   ├── mime-types.ts
│   ├── player-events.ts
│   └── defaults.ts
│
├── assets/
│   ├── icons/
│   └── styles/
│       └── globals.css
│
├── public/
│   └── icons/
│       ├── icon-16.png
│       ├── icon-48.png
│       └── icon-128.png
│
├── test/
│   ├── mocks/
│   │   └── chrome.ts                 # Chrome API mocks
│   ├── fixtures/
│   │   ├── hls-manifest.m3u8
│   │   └── network-requests.json
│   └── setup.ts                      # Test setup
│
└── e2e/
    ├── fixtures.ts                   # Playwright fixtures
    ├── devtools-panel.spec.ts
    ├── network-capture.spec.ts
    └── video-detection.spec.ts
```

### Package.json Scripts

```json
{
  "scripts": {
    "dev": "wxt",
    "dev:firefox": "wxt -b firefox",
    "build": "wxt build",
    "build:firefox": "wxt build -b firefox",
    "zip": "wxt zip",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "lint": "eslint . --ext .ts,.tsx",
    "lint:fix": "eslint . --ext .ts,.tsx --fix",
    "typecheck": "tsc --noEmit",
    "prepare": "husky install"
  }
}
```

### Key Dependencies

```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "zustand": "^5.0.0",
    "@webext-pegasus/store-zustand": "^0.5.0",
    "idb": "^8.0.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.5.0"
  },
  "devDependencies": {
    "wxt": "^0.20.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@types/chrome": "^0.0.280",
    "typescript": "^5.6.0",
    "tailwindcss": "^3.4.0",
    "vitest": "^2.1.0",
    "@testing-library/react": "^16.0.0",
    "@playwright/test": "^1.48.0",
    "eslint": "^9.0.0",
    "prettier": "^3.4.0"
  }
}
```

---

## Summary

### Key Decisions for StreamLens

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Extension Type** | DevTools Panel | Natural fit for developer tool |
| **Framework** | WXT | Best 2025-2026 framework, active maintenance |
| **UI** | React + TypeScript | Complex UI needs, ecosystem, type safety |
| **State** | Zustand + pegasus adapter | Cross-context sync, simple API |
| **Storage** | Hybrid (chrome.storage + IndexedDB) | Settings sync + large data support |
| **Testing** | Vitest + Playwright | Fast unit tests + real browser E2E |
| **Styling** | Tailwind CSS | Rapid development, small bundle |

### Next Steps

1. Initialize WXT project with React template
2. Set up DevTools panel entry point
3. Implement core network capture in service worker
4. Build content script for video player detection
5. Create React components for the panel UI
6. Integrate Zustand for state management
7. Add IndexedDB for request history storage
8. Write tests and set up CI/CD

---

## References Summary

### Official Documentation
- [Chrome Manifest V3](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
- [Chrome DevTools Panels API](https://developer.chrome.com/docs/extensions/reference/api/devtools/panels)
- [Extend DevTools Guide](https://developer.chrome.com/docs/extensions/how-to/devtools/extend-devtools)
- [Playwright Chrome Extensions](https://playwright.dev/docs/chrome-extensions)

### Frameworks & Tools
- [WXT Framework](https://wxt.dev/)
- [Zustand State Management](https://github.com/pmndrs/zustand)
- [@webext-pegasus/store-zustand](https://www.npmjs.com/package/@webext-pegasus/store-zustand)

### Guides & Tutorials
- [2025 State of Browser Extension Frameworks](https://redreamality.com/blog/the-2025-state-of-browser-extension-frameworks-a-comparative-analysis-of-plasmo-wxt-and-crxjs/)
- [Chrome Extension Architecture Guide 2026](https://jinlow.medium.com/chrome-extension-development-the-complete-system-architecture-guide-for-2026-9ae81415f93e)
- [Building Chrome Extensions with Vite, React, and Tailwind 2025](https://www.artmann.co/articles/building-a-chrome-extension-with-vite-react-and-tailwind-css-in-2025)
- [E2E Testing Chrome Extensions with Playwright](https://dev.to/corrupt952/how-i-built-e2e-tests-for-chrome-extensions-using-playwright-and-cdp-11fl)

### Storage
- [Chrome IndexedDB Improvements](https://developer.chrome.com/docs/chromium/indexeddb-storage-improvements)
- [IndexedDB Performance with Storage Buckets](https://developer.chrome.com/blog/maximum-idb-performance-with-storage-buckets)

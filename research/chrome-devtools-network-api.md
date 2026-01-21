# Chrome DevTools Network Interception Research

Research on Chrome extension APIs for intercepting and analyzing network requests in a DevTools panel context, specifically for video stream (HLS/DASH) debugging.

## Table of Contents

1. [Overview of Available APIs](#overview-of-available-apis)
2. [chrome.devtools.network API](#chromedevtoolsnetwork-api)
3. [chrome.webRequest API](#chromewebrequest-api)
4. [chrome.debugger API (CDP)](#chromedebugger-api-cdp)
5. [Content Script Injection (XHR/Fetch Interception)](#content-script-injection)
6. [Manifest V3 Limitations](#manifest-v3-limitations)
7. [Comparison Matrix](#comparison-matrix)
8. [Recommended Architecture for PlaybackLab](#recommended-architecture)
9. [Implementation Examples](#implementation-examples)

---

## Overview of Available APIs

For a DevTools extension like PlaybackLab, there are four main approaches to intercept network requests:

| Approach | Response Body Access | Headers Access | Works Without DevTools | Manifest V3 Compatible |
|----------|---------------------|----------------|----------------------|------------------------|
| `chrome.devtools.network` | Yes (via `getContent()`) | Yes (HAR format) | No | Yes |
| `chrome.webRequest` | No | Limited | Yes | Yes (non-blocking) |
| `chrome.debugger` (CDP) | Yes | Yes | Yes | Yes |
| Content Script Injection | Yes (XHR/fetch only) | Limited | Yes | Yes |

---

## chrome.devtools.network API

### Overview

The `chrome.devtools.network` API provides access to network requests displayed in Chrome's Network panel. Data is provided in HAR (HTTP Archive) format.

**Documentation**: https://developer.chrome.com/docs/extensions/reference/api/devtools/network

### Required Permissions

```json
{
  "devtools_page": "devtools.html"
}
```

### Key Methods and Events

#### `chrome.devtools.network.getHAR(callback)`

Returns the complete HAR log containing all captured network requests.

```typescript
chrome.devtools.network.getHAR((harLog) => {
  harLog.entries.forEach((entry) => {
    console.log('Request URL:', entry.request.url);
    console.log('Response Status:', entry.response.status);
    console.log('Response Headers:', entry.response.headers);
  });
});
```

**Important Limitation**: If DevTools opens after page load, some requests may be missing. Users must reload the page to capture all requests.

#### `chrome.devtools.network.onRequestFinished`

Fired when a network request completes and all data is available.

```typescript
chrome.devtools.network.onRequestFinished.addListener((request) => {
  // HAR entry object with request/response details
  console.log('Request:', request.request.url);
  console.log('Response Status:', request.response.status);
  console.log('Response Headers:', request.response.headers);
  console.log('Server IP:', request.serverIPAddress);

  // Get response body content
  request.getContent((content, encoding) => {
    if (encoding === 'base64') {
      // Binary content - decode if needed
      const decoded = atob(content);
      console.log('Binary content length:', decoded.length);
    } else {
      // Text content (HLS/DASH manifests)
      console.log('Text content:', content);
    }
  });
});
```

**Critical Note**: The event only fires after the user has activated the Network panel at least once in the current DevTools session.

#### `request.getContent(callback)`

Retrieves the response body for a specific request.

- **Returns**: `(content: string, encoding: string) => void`
- **Encoding**: Empty string for text content, `"base64"` for binary content
- **Usage**: Must be called asynchronously; content is not included in HAR entries for efficiency

### HAR Entry Structure

```typescript
interface HAREntry {
  request: {
    method: string;
    url: string;
    httpVersion: string;
    cookies: Cookie[];
    headers: NameValue[];
    queryString: NameValue[];
    postData?: PostData;
    headersSize: number;
    bodySize: number;
  };
  response: {
    status: number;
    statusText: string;
    httpVersion: string;
    cookies: Cookie[];
    headers: NameValue[];
    content: {
      size: number;
      compression?: number;
      mimeType: string;
      text?: string;  // Not always populated - use getContent()
    };
    redirectURL: string;
    headersSize: number;
    bodySize: number;
  };
  serverIPAddress?: string;
  startedDateTime: string;
  time: number;
  timings: Timings;
}
```

### Advantages

1. **Full response body access** via `getContent()`
2. **Complete headers** for both request and response
3. **HAR format** - standardized and well-documented
4. **No user-facing warnings** (unlike debugger API)
5. **Timing information** included

### Limitations

1. **Requires DevTools to be open** - only works in DevTools context
2. **May miss early requests** if DevTools opens after page load
3. **Network panel must be activated** at least once
4. **No real-time interception** - only observes completed requests

### Best For

- DevTools panel extensions (like PlaybackLab)
- Post-request analysis
- Capturing manifest content for parsing
- Getting complete request/response headers

---

## chrome.webRequest API

### Overview

The `chrome.webRequest` API observes and analyzes network traffic. In Manifest V3, it can observe but cannot block or modify requests (without policy installation).

**Documentation**: https://developer.chrome.com/docs/extensions/reference/api/webRequest

### Required Permissions

```json
{
  "permissions": ["webRequest"],
  "host_permissions": ["<all_urls>"]
}
```

For blocking (policy-installed only in MV3):
```json
{
  "permissions": ["webRequest", "webRequestBlocking"]
}
```

### Request Lifecycle Events

```
onBeforeRequest → onBeforeSendHeaders → onSendHeaders →
onHeadersReceived → onResponseStarted → onCompleted/onErrorOccurred
```

| Event | Blocking | Data Available |
|-------|----------|----------------|
| `onBeforeRequest` | Yes (MV2/Policy MV3) | URL, method, type, tabId, frameId |
| `onBeforeSendHeaders` | Yes | + request headers |
| `onSendHeaders` | No | Final request headers |
| `onHeadersReceived` | Yes | + response headers |
| `onResponseStarted` | No | + status code, IP address |
| `onCompleted` | No | Final response info |
| `onErrorOccurred` | No | Error information |

### Example: Detecting Stream URLs

```typescript
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    const url = details.url.toLowerCase();

    // Detect HLS manifests
    if (url.endsWith('.m3u8') || url.includes('.m3u8?')) {
      console.log('HLS manifest detected:', details.url);
    }

    // Detect DASH manifests
    if (url.endsWith('.mpd') || url.includes('.mpd?')) {
      console.log('DASH manifest detected:', details.url);
    }

    return {}; // Don't block
  },
  { urls: ['<all_urls>'] },
  ['requestBody'] // Optional: include request body
);
```

### Accessing Headers

```typescript
// Request headers
chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    const headers: Record<string, string> = {};
    details.requestHeaders?.forEach(h => {
      headers[h.name] = h.value || '';
    });
    console.log('Request headers:', headers);
    return {};
  },
  { urls: ['<all_urls>'] },
  ['requestHeaders']
);

// Response headers
chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    const headers: Record<string, string> = {};
    details.responseHeaders?.forEach(h => {
      headers[h.name] = h.value || '';
    });
    console.log('Response headers:', headers);
    return {};
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders']
);
```

### Critical Limitation: No Response Body Access

**The webRequest API does NOT provide access to response bodies.** This is a fundamental limitation that cannot be worked around within the API itself.

To get response bodies, you must use alternative approaches:
1. `chrome.devtools.network.getContent()` (DevTools context)
2. `chrome.debugger` API with CDP (shows warning banner)
3. Content script injection with XHR/fetch monkey-patching

### Advantages

1. **Works without DevTools open**
2. **Real-time detection** of requests as they happen
3. **URL pattern filtering** built-in
4. **Tab/frame identification** included

### Limitations

1. **No response body access**
2. **Limited headers** - some sensitive headers filtered
3. **Blocking disabled** in Manifest V3 (except policy-installed)
4. **No request modification** in Manifest V3

### Best For

- Real-time stream URL detection
- Request timing/performance monitoring
- URL-based filtering and categorization

---

## chrome.debugger API (CDP)

### Overview

The `chrome.debugger` API provides access to Chrome DevTools Protocol (CDP), enabling full network interception including response bodies.

**Documentation**:
- API: https://developer.chrome.com/docs/extensions/reference/api/debugger
- CDP Network: https://chromedevtools.github.io/devtools-protocol/tot/Network/

### Required Permissions

```json
{
  "permissions": ["debugger"]
}
```

### User-Facing Warning

When attached, Chrome shows a warning banner: "Extension is debugging this browser"

This cannot be hidden and may confuse users.

### Basic Setup

```typescript
// Attach to a tab
await chrome.debugger.attach({ tabId }, '1.3');

// Enable Network domain
await chrome.debugger.sendCommand({ tabId }, 'Network.enable', {
  maxResourceBufferSize: 10000000, // 10MB per resource
  maxTotalBufferSize: 50000000    // 50MB total
});

// Listen for events
chrome.debugger.onEvent.addListener((source, method, params) => {
  if (source.tabId !== tabId) return;

  switch (method) {
    case 'Network.responseReceived':
      handleResponse(params);
      break;
    case 'Network.loadingFinished':
      handleLoadingFinished(params);
      break;
  }
});
```

### Getting Response Bodies

```typescript
async function getResponseBody(tabId: number, requestId: string) {
  try {
    const result = await chrome.debugger.sendCommand(
      { tabId },
      'Network.getResponseBody',
      { requestId }
    );

    if (result.base64Encoded) {
      return atob(result.body);
    }
    return result.body;
  } catch (error) {
    console.error('Failed to get response body:', error);
    return null;
  }
}
```

### Key CDP Network Methods

| Method | Purpose |
|--------|---------|
| `Network.enable` | Start network tracking |
| `Network.disable` | Stop network tracking |
| `Network.getResponseBody` | Get response content |
| `Network.setRequestInterception` | Intercept requests (experimental) |
| `Network.getResponseBodyForInterception` | Get body during interception |

### Key CDP Network Events

| Event | Description |
|-------|-------------|
| `Network.requestWillBeSent` | Request is about to be sent |
| `Network.responseReceived` | Response headers received |
| `Network.dataReceived` | Data chunk received |
| `Network.loadingFinished` | Request completed successfully |
| `Network.loadingFailed` | Request failed |

### Advantages

1. **Full response body access**
2. **Complete headers**
3. **Works without DevTools panel**
4. **Can intercept and modify** (with experimental APIs)
5. **Access to all CDP domains** (DOM, CSS, etc.)

### Limitations

1. **Warning banner** shown to users
2. **Complex API** - requires CDP knowledge
3. **Detaches when DevTools opens** for same tab
4. **Limited domains** - only 23 approved domains
5. **May interfere** with other debugging tools

### Best For

- Full network analysis when DevTools isn't suitable
- Automated testing/debugging tools
- When response body access is critical and DevTools panel isn't available

---

## Content Script Injection

### Overview

Monkey-patching `XMLHttpRequest` and `fetch` in the page context allows intercepting AJAX responses, but requires script injection due to isolated worlds.

### Architecture

```
Page Context          Content Script        Background Script
    |                      |                      |
[XHR/fetch]  ------->  [Observer]  ------->  [Storage/UI]
 patched              mutation/message
```

### Injecting the Patch Script

```typescript
// content-script.ts
function injectScript() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('inject.js');
  (document.head || document.documentElement).appendChild(script);
  script.onload = () => script.remove();
}

// Must be in manifest's web_accessible_resources
```

### XHR Monkey-Patch Example

```typescript
// inject.js (runs in page context)
(function() {
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    this._interceptedUrl = url;
    this._interceptedMethod = method;
    return originalOpen.apply(this, [method, url, ...args]);
  };

  XMLHttpRequest.prototype.send = function(body) {
    this.addEventListener('load', function() {
      if (this._interceptedUrl.includes('.m3u8')) {
        window.postMessage({
          type: 'XHR_INTERCEPTED',
          url: this._interceptedUrl,
          response: this.responseText,
          status: this.status
        }, '*');
      }
    });
    return originalSend.apply(this, arguments);
  };
})();
```

### Fetch Monkey-Patch Example

```typescript
// inject.js
(function() {
  const originalFetch = window.fetch;

  window.fetch = async function(input, init) {
    const response = await originalFetch.apply(this, arguments);

    // Clone response to read body without consuming
    const clone = response.clone();
    const url = typeof input === 'string' ? input : input.url;

    if (url.includes('.m3u8') || url.includes('.mpd')) {
      clone.text().then(body => {
        window.postMessage({
          type: 'FETCH_INTERCEPTED',
          url: url,
          response: body,
          status: response.status
        }, '*');
      });
    }

    return response;
  };
})();
```

### Receiving in Content Script

```typescript
// content-script.ts
window.addEventListener('message', (event) => {
  if (event.source !== window) return;

  if (event.data.type === 'XHR_INTERCEPTED' ||
      event.data.type === 'FETCH_INTERCEPTED') {
    chrome.runtime.sendMessage({
      type: 'MANIFEST_CONTENT',
      url: event.data.url,
      content: event.data.response
    });
  }
});
```

### Advantages

1. **Works without DevTools**
2. **Response body access** for XHR/fetch
3. **No warning banners**
4. **Works in Manifest V3**

### Limitations

1. **Only XHR/fetch requests** - doesn't capture `<video>` src, images, etc.
2. **Page context injection** required (security considerations)
3. **May conflict** with page scripts
4. **No access to request headers** sent by browser
5. **Doesn't capture** requests made before script injection

### Best For

- Supplementing other APIs
- Capturing AJAX-loaded manifests
- When DevTools isn't open

---

## Manifest V3 Limitations

### Key Changes from MV2

| Feature | Manifest V2 | Manifest V3 |
|---------|-------------|-------------|
| Background context | Persistent page | Service worker |
| `webRequestBlocking` | All extensions | Policy-installed only |
| Remote code | Allowed | Forbidden |
| Content script injection | `tabs.executeScript` | `scripting.executeScript` |
| XHR in background | Supported | Must use `fetch` |

### Impact on Network Interception

1. **Cannot block/modify requests** dynamically (use `declarativeNetRequest` instead)
2. **Service worker may sleep** - persistent listeners harder to maintain
3. **No remotely hosted code** - all scripts must be bundled

### What Still Works

- `chrome.devtools.network` (fully functional)
- `chrome.webRequest` for observation (non-blocking)
- `chrome.debugger` (fully functional)
- Content script injection (with `scripting` API)

### declarativeNetRequest Alternative

For blocking/redirecting (but NOT for getting response bodies):

```json
{
  "permissions": ["declarativeNetRequest"],
  "host_permissions": ["<all_urls>"]
}
```

```typescript
// Static rules in rules.json
[
  {
    "id": 1,
    "priority": 1,
    "action": { "type": "block" },
    "condition": {
      "urlFilter": "ads.m3u8",
      "resourceTypes": ["xmlhttprequest"]
    }
  }
]
```

---

## Comparison Matrix

### Feature Comparison for Video Stream Analysis

| Feature | devtools.network | webRequest | debugger (CDP) | Script Injection |
|---------|-----------------|------------|----------------|------------------|
| Response body | Yes | No | Yes | XHR/fetch only |
| Request headers | Yes (HAR) | Yes | Yes | Limited |
| Response headers | Yes (HAR) | Yes | Yes | Limited |
| Timing info | Yes (HAR) | Basic | Yes | No |
| Works w/o DevTools | No | Yes | Yes | Yes |
| User warning | No | No | Yes (banner) | No |
| Real-time detection | Yes | Yes | Yes | Yes |
| All request types | Yes | Yes | Yes | No |
| MV3 compatible | Yes | Yes | Yes | Yes |

### Recommended Approach by Use Case

| Use Case | Recommended API |
|----------|----------------|
| DevTools panel stream analysis | `chrome.devtools.network` |
| Background stream detection | `chrome.webRequest` |
| Full network inspection (no DevTools) | `chrome.debugger` |
| XHR/fetch content capture | Script injection |

---

## Recommended Architecture for PlaybackLab

### Hybrid Approach

Given PlaybackLab is a DevTools extension, the optimal architecture combines:

1. **`chrome.webRequest`** in background script for:
   - Real-time stream URL detection
   - Request timing and metrics
   - Works immediately when extension loads

2. **`chrome.devtools.network`** in DevTools panel for:
   - Getting manifest content (via `getContent()`)
   - Complete request/response headers
   - HAR export functionality

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Chrome Browser                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌─────────────┐ │
│  │   Web Page   │────▶│  Background  │◀───▶│   DevTools  │ │
│  │              │     │   (SW)       │     │   Panel     │ │
│  └──────────────┘     └──────────────┘     └─────────────┘ │
│         │                    │                    │         │
│         │                    │                    │         │
│         ▼                    ▼                    ▼         │
│  ┌──────────────┐     ┌──────────────┐     ┌─────────────┐ │
│  │   Network    │     │  webRequest  │     │  devtools.  │ │
│  │   Requests   │────▶│   API        │     │  network    │ │
│  │              │     │              │     │  API        │ │
│  └──────────────┘     └──────────────┘     └─────────────┘ │
│                              │                    │         │
│                              │ URL Detection      │ Content │
│                              ▼                    ▼         │
│                       ┌─────────────────────────────┐      │
│                       │     Stream Store (Zustand)   │      │
│                       └─────────────────────────────┘      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Strategy

#### Phase 1: Current Implementation (webRequest)
- Detect stream URLs in background script
- Pass URLs to DevTools panel via messaging
- Fetch manifest content using `fetch()` in background

#### Phase 2: Enhanced Implementation (Add devtools.network)
- Add `onRequestFinished` listener in DevTools panel
- Use `getContent()` for manifest bodies
- Capture full headers for cURL export
- Build HAR export feature

### Benefits of Hybrid Approach

1. **Immediate detection** via webRequest (no page reload needed)
2. **Full content access** via devtools.network (when panel open)
3. **No user warnings** (unlike debugger API)
4. **Future-proof** for Manifest V3

---

## Implementation Examples

### Example 1: DevTools Panel Stream Capture

```typescript
// devtools-panel.ts
interface CapturedStream {
  url: string;
  type: 'hls' | 'dash';
  content: string;
  headers: Record<string, string>;
  timing: {
    started: string;
    duration: number;
  };
}

const capturedStreams: CapturedStream[] = [];

chrome.devtools.network.onRequestFinished.addListener((request) => {
  const url = request.request.url;

  // Check if it's a manifest
  if (url.match(/\.(m3u8|mpd)(\?|$)/i)) {
    const type = url.includes('.m3u8') ? 'hls' : 'dash';

    // Extract headers
    const headers: Record<string, string> = {};
    request.response.headers.forEach(h => {
      headers[h.name] = h.value;
    });

    // Get content
    request.getContent((content, encoding) => {
      const decodedContent = encoding === 'base64'
        ? atob(content)
        : content;

      capturedStreams.push({
        url,
        type,
        content: decodedContent,
        headers,
        timing: {
          started: request.startedDateTime,
          duration: request.time
        }
      });

      console.log(`Captured ${type.toUpperCase()} manifest:`, url);
    });
  }
});
```

### Example 2: Generate cURL Command from HAR Entry

```typescript
function generateCurl(request: chrome.devtools.network.Request): string {
  const { method, url, headers, postData } = request.request;

  let curl = `curl -X ${method} '${url}'`;

  // Add headers
  headers.forEach(h => {
    // Skip pseudo-headers and browser-specific
    if (!h.name.startsWith(':') &&
        !['host', 'content-length'].includes(h.name.toLowerCase())) {
      curl += ` \\\n  -H '${h.name}: ${h.value}'`;
    }
  });

  // Add body if present
  if (postData?.text) {
    curl += ` \\\n  -d '${postData.text}'`;
  }

  return curl;
}
```

### Example 3: Filter Streams by Content-Type

```typescript
chrome.devtools.network.onRequestFinished.addListener((request) => {
  const contentType = request.response.headers
    .find(h => h.name.toLowerCase() === 'content-type')?.value || '';

  const isManifest =
    contentType.includes('application/vnd.apple.mpegurl') ||  // HLS
    contentType.includes('application/x-mpegurl') ||           // HLS alt
    contentType.includes('audio/mpegurl') ||                   // HLS audio
    contentType.includes('application/dash+xml');              // DASH

  if (isManifest) {
    console.log('Manifest detected via Content-Type:', request.request.url);
  }
});
```

---

## References

- [chrome.devtools.network API](https://developer.chrome.com/docs/extensions/reference/api/devtools/network)
- [chrome.webRequest API](https://developer.chrome.com/docs/extensions/reference/api/webRequest)
- [chrome.debugger API](https://developer.chrome.com/docs/extensions/reference/api/debugger)
- [Chrome DevTools Protocol - Network](https://chromedevtools.github.io/devtools-protocol/tot/Network/)
- [HAR 1.2 Specification](http://www.softwareishard.com/blog/har-12-spec/)
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
- [MDN devtools.network.onRequestFinished](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/devtools/network/onRequestFinished)

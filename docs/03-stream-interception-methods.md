# Stream Interception Methods for Chrome Extensions

> Research on intercepting and analyzing video streams in Chrome extensions WITHOUT proxy/MITM
> Date: January 2026

---

## Executive Summary

Chrome extensions have several methods to intercept network requests, but each comes with trade-offs between capability, privacy restrictions, and Manifest V3 compatibility. For capturing HLS (m3u8) and DASH (mpd) streams, the most viable approaches are:

1. **webRequest API** (MV3) - For URL/header observation (no body access)
2. **chrome.debugger API** - For full response body access (requires user acknowledgment)
3. **chrome.devtools.network API** - For HAR-based capture (requires DevTools open)
4. **Content Script Injection** - For XMLHttpRequest/fetch monkey-patching

---

## 1. Can We Intercept Network Requests in Chrome Extensions?

**Yes, with limitations.**

### webRequest API (Available in MV3)

The [chrome.webRequest API](https://developer.chrome.com/docs/extensions/reference/api/webRequest) allows extensions to observe and analyze traffic. As of Manifest V3:

- **Available**: `webRequest` permission for observing requests
- **Removed**: `webRequestBlocking` permission (except for policy-installed extensions)
- **Can capture**: URLs, headers, timing, request/response metadata
- **Cannot capture**: Response body content

```javascript
// Example: Capturing m3u8/mpd URLs
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.url.includes('.m3u8') || details.url.includes('.mpd')) {
      console.log('Stream detected:', details.url);
    }
  },
  { urls: ['<all_urls>'] }
);
```

### Key Permissions Required

```json
{
  "permissions": ["webRequest"],
  "host_permissions": ["<all_urls>"]
}
```

**Source**: [Chrome webRequest API Documentation](https://developer.chrome.com/docs/extensions/reference/api/webRequest)

---

## 2. Chrome DevTools Protocol for Network Monitoring

The [Chrome DevTools Protocol (CDP)](https://chromedevtools.github.io/devtools-protocol/) provides powerful network instrumentation capabilities.

### Using chrome.debugger API

The [chrome.debugger API](https://developer.chrome.com/docs/extensions/reference/api/debugger) allows extensions to use CDP commands:

```javascript
// Attach debugger to a tab
chrome.debugger.attach({ tabId: tabId }, '1.3', () => {
  // Enable network domain
  chrome.debugger.sendCommand({ tabId }, 'Network.enable', {});
});

// Listen for network events
chrome.debugger.onEvent.addListener((source, method, params) => {
  if (method === 'Network.responseReceived') {
    // Can detect m3u8/mpd responses
    if (params.response.mimeType.includes('mpegurl') ||
        params.response.mimeType.includes('dash+xml')) {
      // Get response body
      chrome.debugger.sendCommand(
        { tabId: source.tabId },
        'Network.getResponseBody',
        { requestId: params.requestId },
        (response) => {
          console.log('Manifest content:', response.body);
        }
      );
    }
  }
});
```

### Available CDP Network Methods

| Method | Description |
|--------|-------------|
| `Network.enable` | Enables network tracking |
| `Network.getResponseBody` | Returns response body content |
| `Network.setRequestInterception` | Intercept requests (can modify) |
| `Network.getCookies` | Get cookies for URL |

### Limitations

- **User notification**: Chrome shows "debugging started" banner
- **Single debugger**: Only one debugger can attach to a tab (conflicts with DevTools)
- **Permission**: Requires `"debugger"` permission

**Source**: [Chrome DevTools Protocol - Network Domain](https://chromedevtools.github.io/devtools-protocol/tot/Network/)

---

## 3. webRequest API vs declarativeNetRequest (Manifest V3)

### webRequest API (Still Available)

| Feature | MV2 | MV3 |
|---------|-----|-----|
| Observe requests | Yes | Yes |
| Read headers | Yes | Yes |
| Block requests | Yes | **No** (blocking removed) |
| Modify requests | Yes | **No** |
| Read response body | **No** | **No** |

### declarativeNetRequest API (MV3 Replacement)

The [declarativeNetRequest API](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest) is designed for privacy-focused request modification:

```javascript
// Example: Block or redirect requests (declarative rules)
{
  "id": 1,
  "priority": 1,
  "action": { "type": "block" },
  "condition": {
    "urlFilter": "ads.example.com",
    "resourceTypes": ["script"]
  }
}
```

### Key Differences

| Feature | webRequest | declarativeNetRequest |
|---------|------------|----------------------|
| Request observation | Yes | No |
| Dynamic decision making | Yes | No (rules only) |
| Response body access | No | **No** |
| Header modification | No (MV3) | Yes (via rules) |
| Privacy impact | Higher | Lower |
| Performance | Lower | Higher |

### For Stream Detection

**webRequest is better** because:
- Can observe URLs in real-time
- Can filter by URL pattern (`.m3u8`, `.mpd`)
- Can capture timing and headers
- declarativeNetRequest cannot observe or report detected requests back to extension

**Source**: [Migrating from Blocking Web Requests](https://developer.chrome.com/docs/extensions/develop/migrate/blocking-web-requests)

---

## 4. How to Capture m3u8/mpd Requests on Any Page

### Method 1: webRequest API (URL Detection Only)

```javascript
// background.js (service worker)
const STREAM_PATTERNS = [
  '*://*/*.m3u8*',
  '*://*/*.mpd*',
  '*://*/*/manifest*',
  '*://*/*playlist*'
];

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    const url = details.url.toLowerCase();
    if (url.includes('.m3u8') || url.includes('.mpd') ||
        url.includes('manifest') || url.includes('playlist')) {
      // Store or process detected stream URL
      chrome.storage.local.get(['streams'], (result) => {
        const streams = result.streams || [];
        streams.push({
          url: details.url,
          tabId: details.tabId,
          timestamp: Date.now(),
          type: details.type
        });
        chrome.storage.local.set({ streams });
      });
    }
  },
  { urls: ['<all_urls>'] }
);
```

### Method 2: chrome.debugger API (Full Content Access)

```javascript
// For getting actual manifest content
async function captureStreamManifest(tabId, requestId) {
  return new Promise((resolve) => {
    chrome.debugger.sendCommand(
      { tabId },
      'Network.getResponseBody',
      { requestId },
      (response) => {
        resolve(response?.body || null);
      }
    );
  });
}
```

### Method 3: Content Script + Fetch Override

Inject a script to intercept fetch/XHR calls:

```javascript
// injected-script.js (runs in page context)
(function() {
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);
    const url = args[0]?.url || args[0];

    if (typeof url === 'string' &&
        (url.includes('.m3u8') || url.includes('.mpd'))) {
      const clone = response.clone();
      const text = await clone.text();
      window.postMessage({
        type: 'STREAM_DETECTED',
        url: url,
        content: text
      }, '*');
    }
    return response;
  };
})();
```

### Method 4: PerformanceObserver (Resource Timing)

```javascript
// content-script.js
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.name.includes('.m3u8') || entry.name.includes('.mpd')) {
      console.log('Stream resource detected:', entry.name);
      // Note: Cannot get response body, only URL and timing
    }
  }
});
observer.observe({ entryTypes: ['resource'] });
```

**Source**: [m3u8 Sniffer TV Extension](https://chromewebstore.google.com/detail/m3u8-sniffer-tv-find-and/akkncdpkjlfanomlnpmmolafofpnpjgn)

---

## 5. Can We Read Response Bodies in Extensions?

### Short Answer: **Limited**

| Method | Can Read Body? | Conditions |
|--------|---------------|------------|
| webRequest API | **No** | Never supported for responses |
| declarativeNetRequest | **No** | By design |
| chrome.debugger API | **Yes** | Requires debugger attachment |
| chrome.devtools.network | **Yes** | Requires DevTools open |
| Fetch/XHR override | **Yes** | Only for JS-initiated requests |

### Method A: chrome.debugger (Best Option)

```javascript
chrome.debugger.sendCommand(
  { tabId },
  'Network.getResponseBody',
  { requestId },
  (result) => {
    // result.body contains the response content
    // result.base64Encoded indicates if binary
  }
);
```

**Pros**: Full access to all response bodies
**Cons**: User sees "debugging" banner, can't use with DevTools open

### Method B: chrome.devtools.network.getHAR()

```javascript
// Only works in DevTools panel
chrome.devtools.network.getHAR((harLog) => {
  harLog.entries.forEach((entry) => {
    if (entry.request.url.includes('.m3u8')) {
      entry.getContent((content, encoding) => {
        console.log('Manifest:', content);
      });
    }
  });
});
```

**Pros**: Clean HAR format, includes all metadata
**Cons**: Only works when DevTools is open

### Method C: Content Script Injection (Monkey Patching)

Intercept XMLHttpRequest and fetch at the page level:

```javascript
// Override XMLHttpRequest
const XHR = XMLHttpRequest.prototype;
const originalOpen = XHR.open;
const originalSend = XHR.send;

XHR.open = function(method, url) {
  this._url = url;
  return originalOpen.apply(this, arguments);
};

XHR.send = function() {
  this.addEventListener('load', function() {
    if (this._url.includes('.m3u8') || this._url.includes('.mpd')) {
      window.postMessage({
        type: 'XHR_RESPONSE',
        url: this._url,
        response: this.responseText
      }, '*');
    }
  });
  return originalSend.apply(this, arguments);
};
```

**Pros**: Works for AJAX requests, no special permissions
**Cons**: Cannot intercept initial page requests, requires script injection

**Source**: [Chrome Extension: Reading HTTP Response Body](https://betterprogramming.pub/chrome-extension-intercepting-and-reading-the-body-of-http-requests-dd9ebdf2348b)

---

## 6. Limitations of Chrome Extension Network Access

### Manifest V3 Restrictions

1. **No blocking**: Cannot block or modify requests dynamically
2. **No response body in webRequest**: By design for privacy
3. **Service worker lifecycle**: Background scripts can be terminated
4. **Limited rule count**: declarativeNetRequest has rule limits

### Technical Limitations

| Limitation | Impact | Workaround |
|------------|--------|------------|
| No response body in webRequest | Cannot read manifest content | Use debugger API |
| Service worker termination | May miss requests | Use persistent connections |
| Content script isolation | Cannot access page JS context | Inject script tags |
| Same-origin restrictions | Limited cross-origin access | Request host_permissions |
| Debugger conflicts | Can't use with DevTools | Use devtools.network API |

### What We CANNOT Do

1. **Modify encrypted streams** - DRM content is protected
2. **Access ServiceWorker responses** - If page uses SW, may not see request
3. **Read binary without debugger** - webRequest only provides metadata
4. **Run indefinitely** - MV3 service workers terminate when idle

### What We CAN Do

1. **Detect stream URLs** - webRequest captures all URLs
2. **Capture headers** - Request/response headers available
3. **Read manifest content** - Via debugger or fetch override
4. **Analyze timing** - PerformanceObserver provides metrics

---

## Recommended Architecture for Stream Tester

### Hybrid Approach

```
[User visits page with video]
         |
         v
[webRequest API] -----> Detect m3u8/mpd URLs
         |
         v
[chrome.debugger API] -----> Get manifest content (if enabled)
         |                         |
         |                         v
         |               [Parse manifest for variants/segments]
         |
         v
[Content Script] -----> Monitor video element metrics
         |
         v
[Store results] -----> Display in popup/panel
```

### Manifest.json Configuration

```json
{
  "manifest_version": 3,
  "name": "Video Stream Tester",
  "permissions": [
    "webRequest",
    "storage",
    "tabs",
    "debugger"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"]
  }]
}
```

---

## Comparison with Existing Extensions

| Extension | Method | MV3 Compatible | Body Access |
|-----------|--------|----------------|-------------|
| [m3u8 Sniffer TV](https://chromewebstore.google.com/detail/m3u8-sniffer-tv-find-and/akkncdpkjlfanomlnpmmolafofpnpjgn) | webRequest | Yes | No (URL only) |
| [Stream Recorder](https://chromewebstore.google.com/detail/stream-recorder-hls-m3u8/iogidnfllpdhagebkblkgbfijkbkjdmm) | webRequest + Fetch | Yes | Yes (via fetch) |
| [.MPD Detector](https://chromewebstore.google.com/detail/mpd-detector/lpoohbdbmggiknlpcmhhdkpaclfcdapk) | webRequest | Yes | No (URL only) |
| [Netify](https://github.com/vladlavrik/netify) | Debugger API | Partial | Yes |
| [Request Interceptor](https://chromewebstore.google.com/detail/request-interceptor/hkkjcknodnahjdnemannhkhnfedifkoh) | webRequest + DNR | Yes | Limited |

---

## Key Takeaways

1. **URL Detection**: Easy with webRequest API (no proxy needed)
2. **Response Body**: Requires debugger API or fetch override
3. **MV3 Compatible**: All methods work, but blocking is removed
4. **Best Approach**: Combine webRequest (detection) + debugger (content) + content script (video metrics)
5. **Trade-offs**: Privacy vs capability - debugger gives full access but shows notification

---

## References

- [Chrome webRequest API](https://developer.chrome.com/docs/extensions/reference/api/webRequest)
- [Chrome declarativeNetRequest API](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)
- [Chrome Debugger API](https://developer.chrome.com/docs/extensions/reference/api/debugger)
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
- [chrome.devtools.network API](https://developer.chrome.com/docs/extensions/reference/api/devtools/network)
- [Migrating to Manifest V3](https://developer.chrome.com/docs/extensions/develop/migrate/blocking-web-requests)
- [Chrome Extension Network Interception Guide](https://medium.com/@ddamico.125/intercepting-network-response-body-with-a-chrome-extension-b5b9f2ef9466)

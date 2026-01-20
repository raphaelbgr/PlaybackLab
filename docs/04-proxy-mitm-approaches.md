# Proxy and MITM Approaches for Deep Video Stream Analysis

## Research Summary

This document evaluates proxy and man-in-the-middle (MITM) approaches for analyzing video streams, including when they are necessary, how major tools work, and alternatives that avoid proxy complexity.

---

## 1. When is a Proxy/MITM Necessary vs Optional?

### Proxy is NECESSARY when:

| Use Case | Reason |
|----------|--------|
| **Full response body inspection** | Chrome's webRequest API does NOT expose response body content |
| **Modifying video segments on-the-fly** | Requires intercepting and altering data before it reaches the player |
| **Certificate pinning bypass** | Streaming apps with pinning reject non-trusted certificates |
| **Cross-application traffic capture** | System-wide traffic analysis beyond browser tabs |
| **Deep protocol analysis** | Examining raw TLS handshake, DRM key exchanges |
| **Mobile device traffic inspection** | iOS/Android apps require proxy configuration |

### Proxy is OPTIONAL when:

| Use Case | Alternative Approach |
|----------|---------------------|
| **HLS/DASH manifest analysis** | Fetch API interception via monkey-patching |
| **Player event monitoring** | HLS.js/DASH.js built-in events and debug mode |
| **Network timing/performance** | Chrome DevTools Network panel, Performance Observer API |
| **Quality level tracking** | Player APIs expose current quality, buffer state |
| **Error debugging** | Player error events + console logging |
| **Basic header inspection** | webRequest API provides headers (not body) |

### Decision Matrix

```
Need response body modification? ──YES──> Proxy Required
                │
               NO
                │
                v
Need system-wide capture? ──YES──> Proxy Required
                │
               NO
                │
                v
Analyzing browser-based player? ──YES──> Use Extension + Player APIs
                │
               NO
                │
                v
Mobile/Desktop app? ──YES──> Proxy Required (or Frida for pinning bypass)
```

---

## 2. How Major Proxy Tools Work

### Charles Proxy

**How it works:**
- Acts as an HTTP/HTTPS proxy sitting between client and server
- For HTTPS, performs MITM by dynamically generating certificates signed by its root CA
- Client must trust Charles' root certificate

**Key features for video analysis:**
- Compare segments retrieved during HLS playback (VBR vs CBR encoding)
- Bandwidth throttling for simulating constrained playback
- Session recording/export to HAR format
- Mobile device debugging (iOS/Android)

**Limitations:**
- Written in Java, requires JRE
- Commercial license ($50)
- Memory-heavy for long streaming sessions

**Source:** [Charles Proxy SSL Documentation](https://www.charlesproxy.com/documentation/proxying/ssl-proxying/)

---

### mitmproxy

**How it works:**
- Python-based intercepting proxy
- Transparent proxy mode or explicit configuration
- Scripting via Python for request/response modification

**Key features:**
- Fully programmable via Python scripts
- Console UI (mitmproxy), web UI (mitmweb), or CLI (mitmdump)
- SSL certificate auto-generation via node-forge

**Known issues with video streams:**
- "Tears through memory rather quickly against HLS streams"
- MemoryError with MPEG-DASH video seeking
- HTTP/2 issues with video streams
- Live video may not display properly during interception

**Best for:** Automated testing, scripted analysis, CI/CD pipelines

**Source:** [mitmproxy GitHub Issues](https://github.com/mitmproxy/mitmproxy/issues/3399)

---

### Fiddler

**How it works:**
- Windows-centric proxy (Fiddler Everywhere is cross-platform)
- System proxy integration
- HTTPS decryption via MITM certificate

**Key features:**
- Comprehensive protocol support: HTTPS, WebSocket, SSE, gRPC, Socket.IO
- Streaming HTTP support for long-lived connections
- FiddlerScript for custom request/response handling
- Per-application traffic filtering

**Best for:** Windows development, enterprise environments

**Source:** [Fiddler HTTPS Decryption](https://docs.telerik.com/fiddler/configure-fiddler/tasks/decrypthttps)

---

### HTTP Toolkit

**How it works:**
- Modern, developer-focused HTTP debugging tool
- One-click interception for specific applications
- Built-in Electron app support

**Key features:**
- Breakpoints for pausing and modifying requests
- Rules engine for automated modifications
- MockRTC for WebRTC traffic inspection
- Precise targeting (single client, not entire system)

**Best for:** Modern web/Electron development, WebRTC debugging

**Source:** [HTTP Toolkit](https://httptoolkit.com/electron/)

---

## 3. Chrome Extension Local Proxy Capabilities

### Chrome Proxy API Limitations

The chrome.proxy API can configure proxy settings but **cannot act as the proxy itself**:

```javascript
// Can SET proxy configuration
chrome.proxy.settings.set({
  value: {
    mode: "fixed_servers",
    rules: {
      singleProxy: { host: "localhost", port: 8888 }
    }
  }
});

// CANNOT intercept/modify traffic directly
```

**Key limitations:**
- Cannot read response bodies via webRequest API
- Policies can override extension proxy settings
- No SOCKS authentication support
- Incognito mode has separate behavior

**Source:** [Chrome Proxy API](https://developer.chrome.com/docs/extensions/reference/api/proxy)

### WebRequest API Limitations

The webRequest API provides:
- Request/response headers (with some exclusions)
- Ability to block, redirect, or modify headers
- Lifecycle events (onBeforeRequest, onCompleted, etc.)

**Does NOT provide:**
- Response body content
- Ability to modify response data

**Workarounds in Chrome:**

1. **Monkey-patch XMLHttpRequest/fetch:**
   ```javascript
   // Inject script to intercept AJAX calls
   const originalFetch = window.fetch;
   window.fetch = async (...args) => {
     const response = await originalFetch(...args);
     // Clone and inspect response
     return response;
   };
   ```

2. **Chrome DevTools Protocol (Debugger API):**
   ```javascript
   chrome.debugger.attach({ tabId }, "1.3", () => {
     chrome.debugger.sendCommand({ tabId }, "Network.enable");
     chrome.debugger.onEvent.addListener((source, method, params) => {
       if (method === "Network.responseReceived") {
         // Can now get response body
       }
     });
   });
   ```
   - Requires DevTools to be open
   - Shows debugging indicator to user

3. **DevTools Network API:**
   ```javascript
   chrome.devtools.network.onRequestFinished.addListener((request) => {
     request.getContent((content) => {
       // Access response body
     });
   });
   ```
   - Only works in DevTools panel extension

**Source:** [WebRequest API](https://developer.chrome.com/docs/extensions/reference/api/webRequest)

---

## 4. Electron App Approach vs Pure Chrome Extension

### Electron App Advantages

| Aspect | Benefit |
|--------|---------|
| **Full Node.js access** | Can run local proxy server (e.g., electron-http-mitm-proxy) |
| **System-level networking** | Not sandboxed like browser extensions |
| **Certificate management** | Can install/manage CA certificates |
| **Native integrations** | File system, OS notifications, system tray |
| **Custom chromium flags** | Can disable security features for debugging |

**electron-http-mitm-proxy:**
- HTTP MITM proxy in Node.js
- Auto SSL certificate generation
- Configurable hostname/port
- Full request/response modification

```javascript
const Proxy = require('electron-http-mitm-proxy');
const proxy = Proxy();

proxy.onRequest((ctx, callback) => {
  // Full access to request/response
  callback();
});

proxy.listen({ port: 8080, sslCaDir: './certs' });
```

**Source:** [electron-http-mitm-proxy](https://github.com/krishanmarco/electron-http-mitm-proxy)

### Electron App Disadvantages

| Aspect | Drawback |
|--------|----------|
| **Distribution complexity** | 100MB+ app size, requires installer |
| **User trust barrier** | Users must install desktop app |
| **Update mechanism** | More complex than extension auto-update |
| **Cross-platform testing** | Windows/Mac/Linux builds needed |
| **Development overhead** | Separate codebase from web extension |

### Pure Chrome Extension Advantages

| Aspect | Benefit |
|--------|---------|
| **Easy distribution** | Chrome Web Store, 1-click install |
| **Automatic updates** | Handled by browser |
| **Small footprint** | KB-sized package |
| **User familiarity** | Extensions are common |
| **No installation barrier** | Just a browser permission |

### Pure Chrome Extension Disadvantages

| Aspect | Drawback |
|--------|----------|
| **Sandboxed environment** | Cannot run local proxy server |
| **No response body access** | webRequest API limitation |
| **DevTools dependency** | Debugger API requires DevTools open |
| **Manifest V3 restrictions** | Service workers, limited background processing |
| **No system-wide capture** | Only browser traffic |

### Recommendation Matrix

| Requirement | Recommended Approach |
|-------------|---------------------|
| **Casual stream analysis** | Chrome Extension |
| **Professional debugging tool** | Electron App |
| **DRM/encryption analysis** | Electron + External proxy |
| **Mobile traffic capture** | External proxy (Charles/mitmproxy) |
| **Automated testing** | Electron or mitmproxy scripts |

---

## 5. How to Decrypt HTTPS Traffic for Analysis

### Method 1: MITM Proxy (Most Common)

**Process:**
1. Proxy generates its own CA certificate
2. User installs/trusts CA certificate on device
3. Proxy intercepts TLS handshake
4. Proxy presents dynamically-generated certificate to client
5. Proxy establishes separate TLS connection to actual server
6. Traffic decrypted at proxy, re-encrypted for each leg

**Tools:** Charles Proxy, mitmproxy, Fiddler

**Limitations:**
- Certificate pinning defeats this approach
- Some browsers show security warnings
- Mobile apps often reject untrusted certificates

---

### Method 2: SSLKEYLOGFILE (Wireshark)

**Process:**
1. Set environment variable: `SSLKEYLOGFILE=/path/to/keys.log`
2. Browser/app writes TLS session keys to file
3. Wireshark reads keys and decrypts captured traffic

**Advantages:**
- No MITM needed
- Works with certificate pinning
- Captures exact network traffic

**Limitations:**
- Requires application support (browsers support it)
- Cannot modify traffic
- Post-facto analysis only

**Source:** [SSLKEYLOGFILE Method](https://lihaifeng.net/decrypting-https-traffic-with-sslkeylogfile/)

---

### Method 3: Private Key Access (Server-Side)

**Process:**
1. Obtain server's private RSA key
2. Configure Wireshark with key
3. Wireshark decrypts traffic using key

**Limitations:**
- Only works with RSA key exchange (not ECDHE)
- Requires server access
- Not applicable for third-party services

---

### Method 4: Certificate Pinning Bypass (Mobile)

**For Android/iOS apps with pinning:**

1. **Frida:** Dynamic instrumentation to hook SSL functions
   ```javascript
   // Frida script to bypass pinning
   Java.perform(() => {
     const TrustManager = Java.use('X509TrustManager');
     TrustManager.checkServerTrusted.implementation = () => {};
   });
   ```

2. **Xposed Framework:** JustTrustMe module
3. **Objection:** Automated pinning bypass
4. **Rooted device/emulator required**

**Source:** [OWASP Mobile Security - Bypassing Certificate Pinning](https://mas.owasp.org/MASTG/techniques/android/MASTG-TECH-0012/)

---

## 6. User Trust and Security Implications

### Security Risks of HTTPS Decryption

| Risk | Description |
|------|-------------|
| **Credential exposure** | Passwords, tokens visible in cleartext |
| **Data leakage** | Sensitive data logged to disk |
| **CA certificate misuse** | If leaked, enables attacks on user |
| **Legal liability** | Unauthorized interception may violate laws |
| **Privacy concerns** | Users may not consent to inspection |

### Data That Should NEVER Be Decrypted

- Banking/financial transactions
- Healthcare records (HIPAA)
- Personal communications
- Authentication credentials
- DRM license keys (legal implications)

**Source:** [SSL Decryption Best Practices](https://www.cbtnuggets.com/blog/certifications/security/ssl-decryption-benefits-challenges-and-best-practices)

### User Trust Considerations

**For a video stream debugging tool:**

1. **Transparency:** Clearly explain what data is captured
2. **Local-only processing:** Never transmit captured data
3. **No credential logging:** Filter out sensitive headers
4. **User-controlled:** Explicit opt-in for HTTPS decryption
5. **Temporary certificates:** Don't persist CA certificates
6. **Clear uninstall:** Remove certificates when tool is removed

### Trust Model Comparison

| Approach | Trust Level Required | User Concern |
|----------|---------------------|--------------|
| **Extension (no proxy)** | Low | Minimal - extension permissions only |
| **Extension + external proxy** | Medium | User must configure and trust proxy |
| **Electron with built-in proxy** | High | App has full system access |
| **System-wide proxy** | Very High | All traffic flows through tool |

---

## 7. Avoiding Proxy for Most Use Cases

### Browser-Based Video Players

For HLS.js, DASH.js, Shaka Player, Video.js:

**1. Player Event APIs (Best Approach)**

```javascript
// HLS.js example
hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
  console.log('Levels:', data.levels);
});

hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
  console.log('Quality changed to:', data.level);
});

hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
  console.log('Segment loaded:', data.frag.url);
  console.log('Load time:', data.stats.loading.end - data.stats.loading.start);
});

// Enable debug mode
const hls = new Hls({ debug: true });
```

**2. Fetch/XHR Interception**

```javascript
// Monkey-patch fetch for manifest/segment URLs
const originalFetch = window.fetch;
window.fetch = async (url, options) => {
  const response = await originalFetch(url, options);

  if (url.includes('.m3u8') || url.includes('.mpd')) {
    const clone = response.clone();
    const text = await clone.text();
    console.log('Manifest content:', text);
  }

  return response;
};
```

**3. Performance Observer API**

```javascript
// Monitor resource timing
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.name.includes('.ts') || entry.name.includes('.m4s')) {
      console.log('Segment:', entry.name);
      console.log('Duration:', entry.duration);
      console.log('Transfer size:', entry.transferSize);
    }
  }
});

observer.observe({ entryTypes: ['resource'] });
```

**4. Media Source Extensions (MSE) Monitoring**

```javascript
// Monitor buffer state
const video = document.querySelector('video');
const mediaSource = video.srcObject; // If using MSE

setInterval(() => {
  if (video.buffered.length > 0) {
    console.log('Buffered:', video.buffered.end(0) - video.currentTime, 'seconds ahead');
  }
}, 1000);
```

**5. Network Information API**

```javascript
// Monitor connection quality
if ('connection' in navigator) {
  console.log('Effective type:', navigator.connection.effectiveType);
  console.log('Downlink:', navigator.connection.downlink, 'Mbps');

  navigator.connection.addEventListener('change', () => {
    console.log('Network changed:', navigator.connection.effectiveType);
  });
}
```

### What You Can Analyze WITHOUT a Proxy

| Data Point | API/Method |
|------------|------------|
| Current quality level | Player API (currentLevel, representationId) |
| Buffer health | video.buffered, player.bufferLength |
| Segment URLs | Fetch intercept, player events |
| Load times | Performance Observer, player stats |
| Errors | Player error events, window.onerror |
| Manifest content | Fetch intercept (re-fetch manifest URL) |
| Bitrate history | Player quality switch events |
| Dropped frames | video.getVideoPlaybackQuality() |
| Stall events | video timeupdate + waiting events |

### What REQUIRES a Proxy

| Data Point | Reason |
|------------|--------|
| Raw segment binary data | Response body not accessible |
| DRM license requests/responses | Encrypted, body inspection needed |
| Actual HTTP headers (all) | Some headers filtered by browser |
| Server timing details | Not exposed to JavaScript |
| TLS handshake details | Not accessible from browser |
| Cross-origin requests (some) | CORS restrictions |

---

## 8. Complexity vs Functionality Tradeoffs

### Approach Comparison

| Approach | Complexity | Setup Time | Functionality | User Experience |
|----------|------------|------------|---------------|-----------------|
| **Extension only** | Low | Minutes | Basic (70%) | Excellent |
| **Extension + DevTools API** | Medium | Minutes | Good (80%) | Good (DevTools required) |
| **Extension + external proxy** | Medium-High | 10-30 min | Full (95%) | Fair (manual config) |
| **Electron with built-in proxy** | High | N/A (install) | Full (100%) | Good (single app) |
| **Standalone proxy (Charles)** | Medium | 5-15 min | Full (100%) | Fair (separate tool) |

### Recommended Tiered Approach

**Tier 1: Chrome Extension (Default)**
- Manifest/playlist analysis via fetch interception
- Player API integration (HLS.js, DASH.js events)
- Performance metrics via Performance Observer
- Video element state monitoring
- No proxy required, immediate use

**Tier 2: Extension + DevTools Panel**
- Full response body access via devtools.network API
- HAR export capability
- Requires DevTools open
- Still no external dependencies

**Tier 3: External Proxy Integration (Power Users)**
- Link to Charles/mitmproxy setup guide
- Import HAR files from external tools
- For DRM analysis, mobile debugging
- Optional, not required for basic use

### Development Priority Recommendation

```
Phase 1 (MVP):
├── Extension with fetch/XHR interception
├── HLS.js/DASH.js event hooks
├── Basic manifest parsing
└── Video element monitoring

Phase 2 (Enhanced):
├── DevTools panel with network API
├── HAR export/import
├── Session recording
└── Quality metrics visualization

Phase 3 (Advanced - Optional):
├── Electron version with built-in proxy
├── DRM key logging (where legal)
├── Mobile traffic capture guide
└── Certificate pinning bypass documentation
```

---

## 9. Key Recommendations

### For a Video Stream Tester Tool:

1. **Start with extension-only approach** - covers 70-80% of use cases without proxy complexity

2. **Leverage player library APIs** - HLS.js and DASH.js expose extensive debugging information

3. **Add DevTools panel** - for users who need response body inspection

4. **Document external proxy setup** - for advanced users who need full MITM capabilities

5. **Consider Electron only if** - targeting professional/enterprise users who need DRM analysis

6. **Prioritize user trust** - be transparent about data capture, process locally, never transmit

7. **Avoid building proxy into extension** - Chrome extensions cannot run local servers

---

## Sources

- [Charles Proxy SSL Documentation](https://www.charlesproxy.com/documentation/proxying/ssl-proxying/)
- [mitmproxy GitHub](https://github.com/mitmproxy/mitmproxy)
- [Fiddler Everywhere Documentation](https://www.telerik.com/fiddler/fiddler-everywhere/documentation/introduction)
- [HTTP Toolkit](https://httptoolkit.com/)
- [electron-http-mitm-proxy](https://github.com/krishanmarco/electron-http-mitm-proxy)
- [Chrome webRequest API](https://developer.chrome.com/docs/extensions/reference/api/webRequest)
- [Chrome proxy API](https://developer.chrome.com/docs/extensions/reference/api/proxy)
- [HLS.js Documentation](https://github.com/video-dev/hls.js/blob/master/docs/API.md)
- [OWASP Mobile Security - Certificate Pinning Bypass](https://mas.owasp.org/MASTG/techniques/android/MASTG-TECH-0012/)
- [SSL Decryption Best Practices](https://www.cbtnuggets.com/blog/certifications/security/ssl-decryption-benefits-challenges-and-best-practices)
- [Intercepting Network Response Body with Chrome Extension](https://medium.com/@ddamico.125/intercepting-network-response-body-with-a-chrome-extension-b5b9f2ef9466)
- [Chrome DevTools Network Panel](https://developer.chrome.com/docs/devtools/network)

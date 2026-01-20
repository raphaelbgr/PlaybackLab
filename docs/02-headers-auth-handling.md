# HTTP Headers, Authentication, and Cookies for Video Stream Testing

> Research compiled: January 2026
> Focus: Chrome Extension (Manifest V3) implementation for video stream testing

---

## Table of Contents

1. [Adding Custom Headers to Stream Requests](#1-adding-custom-headers-to-stream-requests)
2. [Handling Authentication](#2-handling-authentication)
3. [Passing Cookies with Requests](#3-passing-cookies-with-requests)
4. [How Existing Tools Handle This](#4-how-existing-tools-handle-this)
5. [Chrome Extension Limitations (Manifest V3)](#5-chrome-extension-limitations-manifest-v3)
6. [Handling CORS Issues](#6-handling-cors-issues)
7. [Best Practices for Secure Header Storage](#7-best-practices-for-secure-header-storage)
8. [Implementation Recommendations](#8-implementation-recommendations)

---

## 1. Adding Custom Headers to Stream Requests

### Using hls.js (Recommended for HLS Streams)

hls.js provides two main configuration options for adding custom headers:

#### xhrSetup - General Request Headers

Used for manifest, segment, and subtitle requests:

```javascript
const hls = new Hls({
  xhrSetup: function(xhr, url) {
    // Add Authorization header
    xhr.setRequestHeader('Authorization', 'Bearer YOUR_TOKEN');

    // Add custom headers
    xhr.setRequestHeader('X-Custom-Header', 'value');
    xhr.setRequestHeader('X-API-Key', 'your-api-key');

    // Enable credentials (cookies)
    xhr.withCredentials = true;
  }
});
```

#### licenseXhrSetup - DRM License Requests

Specifically for Widevine/PlayReady license acquisition:

```javascript
const hls = new Hls({
  emeEnabled: true,
  widevineLicenseUrl: 'https://license-server.com/license',
  licenseXhrSetup: function(xhr, url, keyContext, licenseChallenge) {
    xhr.withCredentials = true;
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.setRequestHeader('Authorization', 'Bearer DRM_LICENSE_TOKEN');
    // Can return modified payload or Promise<Uint8Array>
  }
});
```

#### Conditional Header Application

Apply headers only to specific URLs (e.g., encryption keys):

```javascript
const hls = new Hls({
  xhrSetup: (xhr, url) => {
    // Only add auth header for encryption key requests
    if (url.includes('/keys/') || url.endsWith('.key')) {
      xhr.setRequestHeader('Authorization', 'Bearer ' + token);
    }
  }
});
```

### Using video.js with HLS

```javascript
// Before initializing the player
videojs.Hls.xhr.beforeRequest = function(options) {
  if (!options.headers) {
    options.headers = {};
  }
  options.headers['Authorization'] = 'Bearer YOUR_TOKEN';
  options.headers['x-playback-session-id'] = sessionId;
  return options;
};

// Note: This modifies ALL requests except the parent manifest
```

### Using Fetch API (for custom implementations)

```javascript
async function fetchWithHeaders(url, customHeaders = {}) {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + token,
      ...customHeaders
    },
    credentials: 'include' // Include cookies
  });
  return response;
}
```

---

## 2. Handling Authentication

### Authentication Types Supported

| Type | Header Format | Use Case |
|------|--------------|----------|
| Bearer Token | `Authorization: Bearer <token>` | OAuth 2.0, JWT |
| API Key | `X-API-Key: <key>` or `Authorization: ApiKey <key>` | Simple API auth |
| Basic Auth | `Authorization: Basic <base64(user:pass)>` | Legacy systems |
| Custom Token | `X-Auth-Token: <token>` | Proprietary systems |
| Session Token | Cookie-based | Web applications |

### Bearer Token Implementation

```javascript
class StreamAuthenticator {
  constructor(token) {
    this.token = token;
  }

  applyToXHR(xhr) {
    xhr.setRequestHeader('Authorization', `Bearer ${this.token}`);
  }

  applyToFetch(options) {
    options.headers = options.headers || {};
    options.headers['Authorization'] = `Bearer ${this.token}`;
    return options;
  }

  getHeaderObject() {
    return {
      'Authorization': `Bearer ${this.token}`
    };
  }
}
```

### API Key Authentication

```javascript
// Header-based API key
xhr.setRequestHeader('X-API-Key', apiKey);

// Query parameter-based (less secure, but sometimes required)
const urlWithKey = `${streamUrl}?api_key=${apiKey}`;
```

### Token Refresh Handling

```javascript
let authToken = null;
let tokenExpiry = null;

async function getValidToken() {
  if (!authToken || Date.now() >= tokenExpiry) {
    const response = await refreshToken();
    authToken = response.access_token;
    tokenExpiry = Date.now() + (response.expires_in * 1000);
  }
  return authToken;
}

const hls = new Hls({
  xhrSetup: async (xhr, url) => {
    const token = await getValidToken();
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
  }
});
```

---

## 3. Passing Cookies with Requests

### Enable Credentials in XHR/Fetch

```javascript
// XHR
xhr.withCredentials = true;

// Fetch API
fetch(url, {
  credentials: 'include' // or 'same-origin' for same-origin only
});

// hls.js
const hls = new Hls({
  xhrSetup: (xhr, url) => {
    xhr.withCredentials = true;
  }
});
```

### Manual Cookie Header (when withCredentials doesn't work)

```javascript
// Get cookies from chrome.cookies API
async function getCookiesForUrl(url) {
  const cookies = await chrome.cookies.getAll({ url });
  return cookies.map(c => `${c.name}=${c.value}`).join('; ');
}

// Apply to request
const cookieString = await getCookiesForUrl(streamUrl);
xhr.setRequestHeader('Cookie', cookieString);
```

### Important Cookie Considerations

1. **SameSite attribute**: Modern browsers block third-party cookies by default
2. **Secure flag**: HTTPS-only cookies won't be sent over HTTP
3. **HttpOnly**: Cannot be accessed via JavaScript (good for security)
4. **Partitioned cookies**: May require special handling in embedded contexts

---

## 4. How Existing Tools Handle This

### curl

```bash
# Bearer token
curl -X GET "https://stream.example.com/master.m3u8" \
  -H "Authorization: Bearer YOUR_TOKEN"

# API key
curl -X GET "https://stream.example.com/master.m3u8" \
  -H "X-API-Key: your-api-key"

# With cookies
curl -X GET "https://stream.example.com/master.m3u8" \
  -H "Cookie: session=abc123; token=xyz789"

# Multiple headers
curl -X GET "https://stream.example.com/master.m3u8" \
  -H "Authorization: Bearer TOKEN" \
  -H "X-Custom-Header: value" \
  -H "Accept: application/vnd.apple.mpegurl"
```

### FFmpeg

```bash
# With headers (note: requires CRLF termination)
ffmpeg -headers "Authorization: Bearer YOUR_TOKEN\r\nX-Custom: value\r\n" \
  -i "https://stream.example.com/master.m3u8" \
  -c copy output.mp4

# With cookies
ffmpeg -headers "Cookie: session=abc123; CloudFront-Key-Pair-Id=xyz\r\n" \
  -i "https://stream.example.com/master.m3u8" \
  -c copy output.mp4
```

**FFmpeg Header Gotchas:**
- Headers MUST end with `\r\n` (CRLF)
- Use `Cookie:` not `Set-Cookie:` (Set-Cookie is server response)
- Some shells strip escape sequences - use proper quoting

### Postman

1. Open request, go to **Authorization** tab
2. Select **Bearer Token** from dropdown
3. Enter token value
4. Postman automatically formats: `Authorization: Bearer <token>`

**Environment Variables:**
- Store token as `{{bearer_token}}`
- Reference in Authorization field
- Auto-updates across all requests

### Insomnia

1. Navigate to **Auth** tab
2. Select authentication type (Bearer, Basic, OAuth 2.0)
3. Configure token/credentials
4. Supports environment variables and chained requests

**Key Features:**
- `insomnia.request.auth.update()` for scripted auth
- Response chaining for token extraction
- Environment-based configuration

### ModHeader (Chrome Extension)

- Click extension icon
- Add header: Name = `Authorization`, Value = `Bearer YOUR_TOKEN`
- Enable/disable per domain
- Supports regex URL matching

---

## 5. Chrome Extension Limitations (Manifest V3)

### Key Changes from Manifest V2

| Feature | Manifest V2 | Manifest V3 |
|---------|------------|-------------|
| Request blocking | `webRequestBlocking` | `declarativeNetRequest` |
| Dynamic rule changes | Runtime JS modification | Pre-defined rules with limits |
| Background scripts | Persistent | Service workers (ephemeral) |
| Header modification | Any header | Allowlisted headers only |

### declarativeNetRequest API

#### Permissions Required

```json
{
  "manifest_version": 3,
  "permissions": [
    "declarativeNetRequest",
    "declarativeNetRequestFeedback"
  ],
  "host_permissions": [
    "<all_urls>"
  ]
}
```

For header modification without prompts:
```json
{
  "permissions": [
    "declarativeNetRequestWithHostAccess"
  ],
  "host_permissions": [
    "https://*.example.com/*"
  ]
}
```

#### Static Rules (rules.json)

```json
[
  {
    "id": 1,
    "priority": 1,
    "action": {
      "type": "modifyHeaders",
      "requestHeaders": [
        {
          "header": "Authorization",
          "operation": "set",
          "value": "Bearer YOUR_TOKEN"
        },
        {
          "header": "X-Custom-Header",
          "operation": "set",
          "value": "custom-value"
        }
      ]
    },
    "condition": {
      "urlFilter": "*://stream.example.com/*",
      "resourceTypes": ["xmlhttprequest", "media"]
    }
  }
]
```

#### Dynamic Rules (JavaScript)

```javascript
// Add dynamic rule at runtime
chrome.declarativeNetRequest.updateDynamicRules({
  addRules: [{
    id: 1,
    priority: 1,
    action: {
      type: "modifyHeaders",
      requestHeaders: [
        { header: "Authorization", operation: "set", value: "Bearer TOKEN" }
      ]
    },
    condition: {
      urlFilter: "*.m3u8",
      resourceTypes: ["xmlhttprequest", "media"]
    }
  }],
  removeRuleIds: [1] // Remove existing rule with same ID
});

// Remove rules
chrome.declarativeNetRequest.updateDynamicRules({
  removeRuleIds: [1, 2, 3]
});
```

### Header Modification Restrictions

**Appendable Headers Only:**
The `append` operation only works for these headers:
- `accept`, `accept-encoding`, `accept-language`
- `access-control-request-headers`
- `cache-control`, `connection`, `content-language`
- `cookie`, `forwarded`
- `if-match`, `if-none-match`
- `keep-alive`, `range`, `te`, `trailer`
- `transfer-encoding`, `upgrade`, `user-agent`
- `via`, `want-digest`, `x-forwarded-for`

**Note:** `Authorization` can be SET but not APPENDED.

### Rule Limits

| Rule Type | Limit |
|-----------|-------|
| Static rulesets | Up to 100, max 50 enabled |
| Static rules (guaranteed) | 30,000 |
| Dynamic rules | 5,000 |
| Session rules | 5,000 |

### chrome.cookies API (Still Available)

```javascript
// Manifest permissions
{
  "permissions": ["cookies"],
  "host_permissions": ["*://*.example.com/*"]
}

// Get all cookies for a URL
const cookies = await chrome.cookies.getAll({
  url: 'https://stream.example.com'
});

// Set a cookie
await chrome.cookies.set({
  url: 'https://stream.example.com',
  name: 'session',
  value: 'abc123',
  secure: true,
  httpOnly: false
});

// Listen for cookie changes
chrome.cookies.onChanged.addListener((changeInfo) => {
  console.log('Cookie changed:', changeInfo);
});
```

### webRequest API (Read-Only in MV3)

```javascript
// Can still observe requests, but cannot modify
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    console.log('Request to:', details.url);
    // Cannot return blocking response in MV3
  },
  { urls: ["<all_urls>"] }
);
```

---

## 6. Handling CORS Issues

### Understanding CORS for Streaming

CORS issues occur when:
1. Playing HLS/DASH from a different origin than the page
2. Fetching manifests or segments cross-origin
3. DRM license servers have strict CORS policies

### Extension-Based Solutions

#### Option 1: Modify Response Headers (declarativeNetRequest)

```json
[
  {
    "id": 2,
    "priority": 1,
    "action": {
      "type": "modifyHeaders",
      "responseHeaders": [
        {
          "header": "Access-Control-Allow-Origin",
          "operation": "set",
          "value": "*"
        },
        {
          "header": "Access-Control-Allow-Methods",
          "operation": "set",
          "value": "GET, POST, OPTIONS"
        },
        {
          "header": "Access-Control-Allow-Headers",
          "operation": "set",
          "value": "Authorization, Content-Type"
        }
      ]
    },
    "condition": {
      "urlFilter": "*",
      "resourceTypes": ["xmlhttprequest", "media"]
    }
  }
]
```

#### Option 2: Use Extension Background Script as Proxy

```javascript
// background.js (service worker)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'fetch') {
    fetch(request.url, {
      headers: request.headers,
      credentials: 'include'
    })
    .then(response => response.text())
    .then(data => sendResponse({ data }))
    .catch(error => sendResponse({ error: error.message }));
    return true; // Keep channel open for async response
  }
});

// content script or popup
const response = await chrome.runtime.sendMessage({
  type: 'fetch',
  url: 'https://stream.example.com/manifest.m3u8',
  headers: { 'Authorization': 'Bearer TOKEN' }
});
```

#### Option 3: CORS Proxy Services

**Self-hosted options:**
- cors-anywhere
- CORS Proxy (Node.js)

**Caution:** Don't send sensitive tokens through third-party proxies.

### Existing CORS Extensions

| Extension | Features | Manifest Version |
|-----------|----------|-----------------|
| CORS Unblock | Modifies response headers, per-domain toggle | MV3 |
| Anti-CORS | Auto-enable for specific hosts | MV3 |
| Moesif Origin | Request/response header modification | MV3 |

---

## 7. Best Practices for Secure Header Storage

### Never Hardcode Credentials

```javascript
// BAD - Never do this
const API_KEY = 'sk-1234567890abcdef';

// GOOD - Load from secure storage
const apiKey = await getSecureApiKey();
```

### Use chrome.storage API

```javascript
// Store encrypted credentials
async function storeCredentials(credentials) {
  // Encrypt before storing
  const encrypted = await encryptData(credentials, userKey);
  await chrome.storage.local.set({ credentials: encrypted });
}

// Retrieve and decrypt
async function getCredentials() {
  const { credentials } = await chrome.storage.local.get('credentials');
  if (credentials) {
    return await decryptData(credentials, userKey);
  }
  return null;
}
```

### Encrypt with Web Crypto API

```javascript
// Generate encryption key from user password
async function deriveKey(password, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypt data
async function encryptData(data, key) {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(JSON.stringify(data))
  );

  return {
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encrypted))
  };
}

// Decrypt data
async function decryptData(encrypted, key) {
  const iv = new Uint8Array(encrypted.iv);
  const data = new Uint8Array(encrypted.data);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(decrypted));
}
```

### Use Session Storage for Temporary Data

```javascript
// Session-only storage (cleared when browser closes)
await chrome.storage.session.set({
  tempToken: accessToken,
  expiry: Date.now() + 3600000 // 1 hour
});

// Retrieve session data
const { tempToken, expiry } = await chrome.storage.session.get(['tempToken', 'expiry']);
```

### Security Checklist

| Practice | Implementation |
|----------|---------------|
| Encrypt at rest | AES-GCM via Web Crypto API |
| Use user-derived keys | PBKDF2 key derivation |
| Minimize storage | Only store what's necessary |
| Short-lived tokens | Use refresh tokens, store in session |
| Validate sources | Check `sender.id` for messages |
| CSP in manifest | Restrict script sources |
| Regular rotation | Implement token refresh logic |
| No console logging | Remove credential logs in production |

---

## 8. Implementation Recommendations

### For the Video Stream Tester Extension

#### Architecture Overview

```
[Popup UI] <-> [Service Worker] <-> [declarativeNetRequest]
     |               |                        |
     v               v                        v
[Header Config] [Cookie Manager]    [Dynamic Rules Engine]
     |               |                        |
     +--> [Encrypted Storage] <---------------+
```

#### Recommended Implementation

1. **Header Management UI**
   - Add/remove custom headers
   - Support common auth types (Bearer, API Key, Basic)
   - Save header profiles per domain

2. **Cookie Handling**
   - Read cookies via chrome.cookies API
   - Option to auto-include cookies with requests
   - Manual cookie entry for testing

3. **Dynamic Rule System**
   ```javascript
   class HeaderRuleManager {
     async addHeaderRule(domain, headers) {
       const rule = this.createRule(domain, headers);
       await chrome.declarativeNetRequest.updateDynamicRules({
         addRules: [rule],
         removeRuleIds: [rule.id]
       });
     }

     createRule(domain, headers) {
       return {
         id: this.generateRuleId(domain),
         priority: 1,
         action: {
           type: "modifyHeaders",
           requestHeaders: headers.map(h => ({
             header: h.name,
             operation: "set",
             value: h.value
           }))
         },
         condition: {
           urlFilter: `*://${domain}/*`,
           resourceTypes: ["xmlhttprequest", "media", "other"]
         }
       };
     }
   }
   ```

4. **Secure Storage**
   ```javascript
   class SecureCredentialStore {
     async store(key, credentials) {
       const encrypted = await this.encrypt(credentials);
       await chrome.storage.local.set({ [key]: encrypted });
     }

     async retrieve(key) {
       const { [key]: encrypted } = await chrome.storage.local.get(key);
       return encrypted ? await this.decrypt(encrypted) : null;
     }
   }
   ```

5. **CORS Handling**
   - Option to add CORS headers to responses
   - Warning about security implications
   - Per-domain CORS rules

#### Manifest Configuration

```json
{
  "manifest_version": 3,
  "name": "Video Stream Tester",
  "version": "1.0.0",
  "permissions": [
    "declarativeNetRequest",
    "declarativeNetRequestFeedback",
    "cookies",
    "storage",
    "activeTab"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "declarative_net_request": {
    "rule_resources": [{
      "id": "default_rules",
      "enabled": true,
      "path": "rules/default.json"
    }]
  },
  "action": {
    "default_popup": "popup.html"
  }
}
```

---

## Sources

### Chrome Extension APIs
- [chrome.declarativeNetRequest API](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)
- [chrome.cookies API](https://developer.chrome.com/docs/extensions/reference/api/cookies)
- [chrome.webRequest API](https://developer.chrome.com/docs/extensions/reference/api/webRequest)
- [Replace blocking web request listeners](https://developer.chrome.com/docs/extensions/develop/migrate/blocking-web-requests)

### Header Modification Tools
- [Requestly - Build Chrome Extension to Modify HTTP Headers](https://requestly.com/blog/guide-to-build-your-own-chrome-extension-to-modify-http-headers/)
- [Top Chrome Extensions for Modifying HTTP Headers 2025](https://requestly.com/guides/top-chrome-extensions-for-modifying-http-headers-in-2025/)
- [ModHeader Authorization Header](https://modheader.com/usecases/headers/authorization)
- [GitHub: requestly/modify-headers-manifest-v3](https://github.com/requestly/modify-headers-manifest-v3)

### Video Streaming
- [hls.js API Documentation](https://github.com/video-dev/hls.js/blob/master/docs/API.md)
- [How to Test HLS Streams - VideoSDK](https://www.videosdk.live/developer-hub/hls/test-hls)
- [Custom Key Acquisition for Encrypted HLS in VideoJS](https://onetdev.medium.com/custom-key-acquisition-for-encrypted-hls-in-videojs-59e495f78e52)

### API Testing Tools
- [Postman Authorization Types](https://learning.postman.com/docs/sending-requests/authorization/authorization-types/)
- [Insomnia Authentication Reference](https://docs.insomnia.rest/insomnia/authentication/)
- [What is a Bearer Token - Postman Blog](https://blog.postman.com/what-is-a-bearer-token/)

### FFmpeg/curl
- [FFmpeg Protocols Documentation](https://ffmpeg.org/ffmpeg-protocols.html)
- [Downloading browser video stream to MP4](https://shivankaul.com/blog/hls-to-mp4)

### CORS
- [CORS Unblock Extension](https://chromewebstore.google.com/detail/cors-unblock/lfhmikememgdcahcdlaciloancbhjino)
- [GitHub: cors-proxy/chrome-extension](https://github.com/cors-proxy/chrome-extension)
- [Bypassing CORS with Chrome Extension](https://medium.com/geekculture/bypassing-cors-with-a-google-chrome-extension-7f95fd953612)

### Security
- [OWASP Browser Extension Vulnerabilities](https://cheatsheetseries.owasp.org/cheatsheets/Browser_Extension_Vulnerabilities_Cheat_Sheet.html)
- [Secure API Keys in Chrome Extension](https://rustyzone.substack.com/p/secure-api-keys-in-a-chrome-extension)
- [How to Encrypt Data for Chrome Storage](https://www.codestudy.net/blog/chrome-extension-encrypting-data-to-be-stored-in-chrome-storage/)
- [Chrome Extension Credentials Security](https://www.security.com/threat-intelligence/chrome-extension-credentials)

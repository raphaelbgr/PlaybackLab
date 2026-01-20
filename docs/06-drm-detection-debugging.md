# DRM Detection and Debugging Research

> Comprehensive guide for detecting and debugging DRM (Widevine, PlayReady, FairPlay) in video streams from a Chrome extension or web application.

---

## Table of Contents

1. [DRM System Identification](#1-drm-system-identification)
2. [Detecting DRM Type from Manifests](#2-detecting-drm-type-from-manifests)
3. [PSSH Box Parsing](#3-pssh-box-parsing)
4. [Chrome EME API Deep Dive](#4-chrome-eme-api-deep-dive)
5. [License Request/Response Inspection](#5-license-requestresponse-inspection)
6. [DRM Error Codes and Meanings](#6-drm-error-codes-and-meanings)
7. [Chrome Extension Capabilities vs Limitations](#7-chrome-extension-capabilities-vs-limitations)
8. [Implementation Strategies](#8-implementation-strategies)

---

## 1. DRM System Identification

### Standard DRM System UUIDs

Each DRM system has a unique UUID used in PSSH boxes and manifest ContentProtection elements:

| DRM System | System ID (UUID) | Key System String |
|------------|------------------|-------------------|
| **Widevine** | `edef8ba9-79d6-4ace-a3c8-27dcd51d21ed` | `com.widevine.alpha` |
| **PlayReady** | `9a04f079-9840-4286-ab92-e65be0885f95` | `com.microsoft.playready` |
| **FairPlay** | `94ce86fb-07ff-4f43-adb8-93d2fa968ca2` | `com.apple.fps` |
| **ClearKey** | `e2719d58-a985-b3c9-781a-b030af78d30e` | `org.w3.clearkey` |
| **ClearKey (alt)** | `1077efec-c0b2-4d02-ace3-3c1e52e2fb4b` | `org.w3.clearkey` |
| **Marlin** | `5e629af5-38da-4063-8977-97ffbd9902d4` | `com.intertrust.marlin` |
| **WisePlay** | `3d5e6d35-9b9a-41e8-b843-dd3c6e72c42c` | `com.huawei.wiseplay` |

### Converting UUID to Bytes

```javascript
function uuidToBytes(uuid) {
  // Remove dashes and convert hex to bytes
  const hex = uuid.replace(/-/g, '');
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

const WIDEVINE_UUID = uuidToBytes('edef8ba9-79d6-4ace-a3c8-27dcd51d21ed');
const PLAYREADY_UUID = uuidToBytes('9a04f079-9840-4286-ab92-e65be0885f95');
const FAIRPLAY_UUID = uuidToBytes('94ce86fb-07ff-4f43-adb8-93d2fa968ca2');
```

---

## 2. Detecting DRM Type from Manifests

### DASH Manifest (MPD) Detection

DASH manifests use `<ContentProtection>` elements within `<AdaptationSet>` to signal DRM:

```xml
<!-- Widevine -->
<ContentProtection
  schemeIdUri="urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed"
  value="Widevine">
  <cenc:pssh>AAAA...</cenc:pssh>
</ContentProtection>

<!-- PlayReady -->
<ContentProtection
  schemeIdUri="urn:uuid:9a04f079-9840-4286-ab92-e65be0885f95"
  value="MSPR 2.0">
  <cenc:pssh>AAAA...</cenc:pssh>
  <mspr:pro>BASE64_PRO_HEADER</mspr:pro>
</ContentProtection>

<!-- Common CENC signaling -->
<ContentProtection
  schemeIdUri="urn:mpeg:dash:mp4protection:2011"
  value="cenc"
  cenc:default_KID="12345678-1234-1234-1234-123456789012"/>
```

#### JavaScript Parser for DASH ContentProtection

```javascript
function parseDashDRM(mpdText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(mpdText, 'text/xml');

  const drmSystems = [];
  const contentProtections = doc.querySelectorAll('ContentProtection');

  contentProtections.forEach(cp => {
    const schemeIdUri = cp.getAttribute('schemeIdUri') || '';
    const value = cp.getAttribute('value') || '';

    // Extract UUID from schemeIdUri
    const uuidMatch = schemeIdUri.match(/urn:uuid:([a-f0-9-]{36})/i);
    if (uuidMatch) {
      const uuid = uuidMatch[1].toLowerCase();

      // Get PSSH if available
      const psshElement = cp.querySelector('pssh');
      const psshBase64 = psshElement?.textContent?.trim();

      // Get PlayReady PRO if available
      const proElement = cp.querySelector('pro');
      const proBase64 = proElement?.textContent?.trim();

      // Get default_KID
      const defaultKID = cp.getAttribute('cenc:default_KID') ||
                         cp.getAttributeNS('urn:mpeg:cenc:2013', 'default_KID');

      drmSystems.push({
        uuid,
        type: identifyDRMType(uuid),
        value,
        pssh: psshBase64,
        playreadyPRO: proBase64,
        defaultKID
      });
    }
  });

  return drmSystems;
}

function identifyDRMType(uuid) {
  const DRM_UUIDS = {
    'edef8ba9-79d6-4ace-a3c8-27dcd51d21ed': 'Widevine',
    '9a04f079-9840-4286-ab92-e65be0885f95': 'PlayReady',
    '94ce86fb-07ff-4f43-adb8-93d2fa968ca2': 'FairPlay',
    'e2719d58-a985-b3c9-781a-b030af78d30e': 'ClearKey',
    '1077efec-c0b2-4d02-ace3-3c1e52e2fb4b': 'ClearKey'
  };
  return DRM_UUIDS[uuid] || 'Unknown';
}
```

### HLS Manifest (M3U8) Detection

HLS signals DRM via `#EXT-X-KEY` or `#EXT-X-SESSION-KEY` tags:

```m3u8
#EXTM3U
#EXT-X-VERSION:5

# FairPlay (most common for HLS)
#EXT-X-KEY:METHOD=SAMPLE-AES,URI="skd://license.example.com/key",KEYFORMAT="com.apple.streamingkeydelivery",KEYFORMATVERSIONS="1"

# Widevine (CBCS encryption)
#EXT-X-KEY:METHOD=SAMPLE-AES,URI="data:text/plain;base64,PSSH_DATA",KEYFORMAT="urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed",KEYFORMATVERSIONS="1"

# PlayReady
#EXT-X-KEY:METHOD=SAMPLE-AES,URI="data:text/plain;base64,PSSH_DATA",KEYFORMAT="urn:uuid:9a04f079-9840-4286-ab92-e65be0885f95",KEYFORMATVERSIONS="1"
```

#### JavaScript Parser for HLS DRM

```javascript
function parseHlsDRM(m3u8Text) {
  const drmSystems = [];
  const lines = m3u8Text.split('\n');

  for (const line of lines) {
    if (line.startsWith('#EXT-X-KEY:') || line.startsWith('#EXT-X-SESSION-KEY:')) {
      const attrs = parseM3U8Attributes(line);

      if (attrs.METHOD === 'SAMPLE-AES' || attrs.METHOD === 'SAMPLE-AES-CTR') {
        const keyFormat = attrs.KEYFORMAT || '';

        let drmType = 'Unknown';
        let uuid = null;

        // FairPlay detection
        if (keyFormat === 'com.apple.streamingkeydelivery') {
          drmType = 'FairPlay';
        }
        // UUID-based detection
        else if (keyFormat.startsWith('urn:uuid:')) {
          uuid = keyFormat.replace('urn:uuid:', '').toLowerCase();
          drmType = identifyDRMType(uuid);
        }

        // Check for skd:// URI (FairPlay)
        if (attrs.URI?.startsWith('skd://')) {
          drmType = 'FairPlay';
        }

        drmSystems.push({
          drmType,
          uuid,
          method: attrs.METHOD,
          keyFormat,
          uri: attrs.URI,
          keyFormatVersions: attrs.KEYFORMATVERSIONS
        });
      }
    }
  }

  return drmSystems;
}

function parseM3U8Attributes(line) {
  const attrs = {};
  const attrString = line.split(':').slice(1).join(':');

  // Parse key=value pairs, handling quoted values
  const regex = /([A-Z0-9-]+)=(?:"([^"]*)"|([^,]*))/gi;
  let match;

  while ((match = regex.exec(attrString)) !== null) {
    const key = match[1];
    const value = match[2] !== undefined ? match[2] : match[3];
    attrs[key] = value;
  }

  return attrs;
}
```

---

## 3. PSSH Box Parsing

### PSSH Box Structure

```
Box Type:  'pssh'
Container: Movie Box ('moov')

Full Box:
- size (4 bytes): total box size
- type (4 bytes): 'pssh' (0x70737368)
- version (1 byte): 0 or 1
- flags (3 bytes): typically 0
- SystemID (16 bytes): UUID identifying the DRM system
- [if version == 1] KID_count (4 bytes) + KID array (16 bytes each)
- DataSize (4 bytes): size of following data
- Data (variable): system-specific data
```

### JavaScript PSSH Parser

```javascript
class PSSHParser {
  static parse(data) {
    // Accept base64 string or ArrayBuffer
    let buffer;
    if (typeof data === 'string') {
      buffer = this.base64ToArrayBuffer(data);
    } else {
      buffer = data;
    }

    const view = new DataView(buffer);
    const results = [];
    let offset = 0;

    while (offset < buffer.byteLength) {
      const boxSize = view.getUint32(offset);
      const boxType = this.readString(view, offset + 4, 4);

      if (boxType !== 'pssh') {
        offset += boxSize;
        continue;
      }

      const version = view.getUint8(offset + 8);
      const flags = (view.getUint8(offset + 9) << 16) |
                    (view.getUint8(offset + 10) << 8) |
                    view.getUint8(offset + 11);

      // Read SystemID (16 bytes UUID)
      const systemID = this.readUUID(view, offset + 12);

      let kidCount = 0;
      let kids = [];
      let dataOffset = offset + 28; // After SystemID

      if (version === 1) {
        kidCount = view.getUint32(offset + 28);
        dataOffset = offset + 32;

        for (let i = 0; i < kidCount; i++) {
          kids.push(this.readUUID(view, dataOffset + (i * 16)));
        }
        dataOffset += kidCount * 16;
      }

      const dataSize = view.getUint32(dataOffset);
      const psshData = new Uint8Array(buffer, dataOffset + 4, dataSize);

      results.push({
        version,
        flags,
        systemID,
        drmType: identifyDRMType(systemID),
        kidCount,
        kids,
        dataSize,
        data: psshData,
        dataBase64: this.arrayBufferToBase64(psshData.buffer.slice(
          psshData.byteOffset,
          psshData.byteOffset + psshData.byteLength
        )),
        rawBox: new Uint8Array(buffer, offset, boxSize),
        rawBoxBase64: this.arrayBufferToBase64(buffer.slice(offset, offset + boxSize))
      });

      offset += boxSize;
    }

    return results;
  }

  static readString(view, offset, length) {
    let str = '';
    for (let i = 0; i < length; i++) {
      str += String.fromCharCode(view.getUint8(offset + i));
    }
    return str;
  }

  static readUUID(view, offset) {
    const hex = [];
    for (let i = 0; i < 16; i++) {
      hex.push(view.getUint8(offset + i).toString(16).padStart(2, '0'));
    }
    // Format as UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    return [
      hex.slice(0, 4).join(''),
      hex.slice(4, 6).join(''),
      hex.slice(6, 8).join(''),
      hex.slice(8, 10).join(''),
      hex.slice(10, 16).join('')
    ].join('-');
  }

  static base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const buffer = new ArrayBuffer(binary.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < binary.length; i++) {
      view[i] = binary.charCodeAt(i);
    }
    return buffer;
  }

  static arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}
```

### Extracting PSSH from Init Segment

```javascript
async function extractPSSHFromInitSegment(url) {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();

  // Find moov box first
  const moovData = findBox(new DataView(buffer), 0, buffer.byteLength, 'moov');
  if (!moovData) return [];

  // Parse PSSH boxes within moov
  return PSSHParser.parse(moovData);
}

function findBox(view, start, end, boxType) {
  let offset = start;

  while (offset < end) {
    const size = view.getUint32(offset);
    const type = String.fromCharCode(
      view.getUint8(offset + 4),
      view.getUint8(offset + 5),
      view.getUint8(offset + 6),
      view.getUint8(offset + 7)
    );

    if (type === boxType) {
      return view.buffer.slice(offset, offset + size);
    }

    // Handle extended size
    if (size === 0) break; // Box extends to end
    if (size === 1) {
      // 64-bit size - skip for simplicity
      break;
    }

    offset += size;
  }

  return null;
}
```

---

## 4. Chrome EME API Deep Dive

### Detecting EME Support

```javascript
function detectEMESupport() {
  return {
    hasEME: 'MediaKeys' in window,
    hasWebKitEME: 'WebKitMediaKeys' in window,
    hasMSEME: 'MSMediaKeys' in window,
    hasRequestMediaKeySystemAccess: 'requestMediaKeySystemAccess' in navigator
  };
}
```

### Detecting CDM (Content Decryption Module) Support

```javascript
async function detectCDMSupport() {
  const keySystems = [
    { name: 'Widevine', keySystem: 'com.widevine.alpha' },
    { name: 'PlayReady', keySystem: 'com.microsoft.playready' },
    { name: 'PlayReady (recommendation)', keySystem: 'com.microsoft.playready.recommendation' },
    { name: 'FairPlay', keySystem: 'com.apple.fps.1_0' },
    { name: 'FairPlay (legacy)', keySystem: 'com.apple.fps' },
    { name: 'ClearKey', keySystem: 'org.w3.clearkey' }
  ];

  const results = {};

  for (const { name, keySystem } of keySystems) {
    try {
      const config = [{
        initDataTypes: ['cenc', 'webm'],
        videoCapabilities: [
          { contentType: 'video/mp4; codecs="avc1.42E01E"' },
          { contentType: 'video/webm; codecs="vp9"' }
        ],
        audioCapabilities: [
          { contentType: 'audio/mp4; codecs="mp4a.40.2"' }
        ]
      }];

      const access = await navigator.requestMediaKeySystemAccess(keySystem, config);
      const configuration = access.getConfiguration();

      results[name] = {
        supported: true,
        keySystem,
        configuration
      };
    } catch (e) {
      results[name] = {
        supported: false,
        keySystem,
        error: e.message
      };
    }
  }

  return results;
}
```

### Widevine Robustness Levels

```javascript
async function detectWidevineSecurityLevel() {
  const robustnessLevels = [
    { name: 'L1 (Hardware)', robustness: 'HW_SECURE_ALL' },
    { name: 'L2 (Hardware Crypto)', robustness: 'HW_SECURE_CRYPTO' },
    { name: 'L2 (Hardware Decode)', robustness: 'HW_SECURE_DECODE' },
    { name: 'L3 (Software)', robustness: 'SW_SECURE_CRYPTO' },
    { name: 'L3 (Software Decode)', robustness: 'SW_SECURE_DECODE' }
  ];

  const results = [];

  for (const { name, robustness } of robustnessLevels) {
    try {
      const config = [{
        initDataTypes: ['cenc'],
        videoCapabilities: [{
          contentType: 'video/mp4; codecs="avc1.42E01E"',
          robustness
        }]
      }];

      await navigator.requestMediaKeySystemAccess('com.widevine.alpha', config);
      results.push({ name, robustness, supported: true });
    } catch (e) {
      results.push({ name, robustness, supported: false });
    }
  }

  return results;
}
```

### MediaKeySession Lifecycle

```javascript
class DRMSessionMonitor {
  constructor(video) {
    this.video = video;
    this.sessions = new Map();
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Listen for encrypted event
    this.video.addEventListener('encrypted', (event) => {
      console.log('Encrypted event:', {
        initDataType: event.initDataType,
        initData: this.arrayBufferToHex(event.initData)
      });

      // Parse PSSH from init data
      if (event.initDataType === 'cenc') {
        const psshBoxes = PSSHParser.parse(event.initData);
        console.log('PSSH boxes found:', psshBoxes);
      }
    });

    // Listen for waitingforkey event
    this.video.addEventListener('waitingforkey', () => {
      console.log('Video waiting for decryption key');
    });
  }

  async monitorMediaKeys(mediaKeys) {
    // Store reference to monitor sessions
    this.mediaKeys = mediaKeys;
  }

  async monitorSession(session) {
    const sessionId = session.sessionId || `temp-${Date.now()}`;
    this.sessions.set(sessionId, session);

    // License request message
    session.addEventListener('message', (event) => {
      console.log('License message event:', {
        messageType: event.messageType,
        message: this.arrayBufferToHex(event.message.slice(0, 100)) + '...',
        messageLength: event.message.byteLength
      });
    });

    // Key status change
    session.addEventListener('keystatuseschange', () => {
      console.log('Key statuses changed:');
      session.keyStatuses.forEach((status, keyId) => {
        console.log(`  Key ${this.arrayBufferToHex(keyId)}: ${status}`);
      });
    });

    // Session closed
    session.closed.then((reason) => {
      console.log(`Session closed: ${reason || 'unknown reason'}`);
      this.sessions.delete(sessionId);
    });
  }

  arrayBufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
```

### MediaKeyStatusMap Values

| Status | Meaning |
|--------|---------|
| `usable` | Key is valid and can be used for decryption |
| `expired` | Key has passed its expiration time |
| `released` | Key has been released and is no longer available |
| `output-restricted` | Output restrictions prevent playback (HDCP issues) |
| `output-downscaled` | Playback allowed but at lower quality due to output restrictions |
| `status-pending` | Key status is being determined |
| `internal-error` | CDM error, key cannot be used |

---

## 5. License Request/Response Inspection

### Intercepting License Requests via Network

```javascript
// Using PerformanceObserver to detect license server requests
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    const url = entry.name.toLowerCase();

    // Common license server URL patterns
    if (url.includes('license') ||
        url.includes('widevine') ||
        url.includes('playready') ||
        url.includes('fairplay') ||
        url.includes('drm') ||
        url.includes('ckc') ||  // FairPlay CKC
        url.includes('rightsmanager')) {

      console.log('Possible license request:', {
        url: entry.name,
        duration: entry.duration,
        transferSize: entry.transferSize,
        initiatorType: entry.initiatorType
      });
    }
  }
});

observer.observe({ entryTypes: ['resource'] });
```

### Identifying License Server URLs

Common license server URL patterns:

| DRM | Common URL Patterns |
|-----|---------------------|
| **Widevine** | `/widevine/`, `/license`, `*license.widevine*`, `*proxy.uat*` |
| **PlayReady** | `/playready/`, `/rightsmanager/`, `*playready*` |
| **FairPlay** | `/fairplay/`, `/fps/`, `/ckc` (Content Key Context) |

### EME Method Wrapping (for Chrome Extension)

To intercept EME calls, inject a script into the main world:

```javascript
// inject.js - Runs in main world (page context)
(function() {
  'use strict';

  const originalRequestMediaKeySystemAccess =
    navigator.requestMediaKeySystemAccess.bind(navigator);

  navigator.requestMediaKeySystemAccess = async function(keySystem, configs) {
    console.log('[DRM Monitor] requestMediaKeySystemAccess:', keySystem);
    console.log('[DRM Monitor] Configurations:', JSON.stringify(configs, null, 2));

    // Notify extension
    window.postMessage({
      type: 'DRM_MONITOR_KEY_SYSTEM_ACCESS',
      keySystem,
      configs
    }, '*');

    const access = await originalRequestMediaKeySystemAccess(keySystem, configs);

    // Wrap createMediaKeys
    const originalCreateMediaKeys = access.createMediaKeys.bind(access);
    access.createMediaKeys = async function() {
      const mediaKeys = await originalCreateMediaKeys();
      return wrapMediaKeys(mediaKeys, keySystem);
    };

    return access;
  };

  function wrapMediaKeys(mediaKeys, keySystem) {
    const originalCreateSession = mediaKeys.createSession.bind(mediaKeys);

    mediaKeys.createSession = function(sessionType = 'temporary') {
      console.log('[DRM Monitor] createSession:', sessionType);

      const session = originalCreateSession(sessionType);
      return wrapMediaKeySession(session, keySystem);
    };

    return mediaKeys;
  }

  function wrapMediaKeySession(session, keySystem) {
    const originalGenerateRequest = session.generateRequest.bind(session);
    const originalUpdate = session.update.bind(session);

    session.generateRequest = async function(initDataType, initData) {
      console.log('[DRM Monitor] generateRequest:', {
        initDataType,
        initDataLength: initData.byteLength
      });

      // Parse and report PSSH
      if (initDataType === 'cenc') {
        try {
          const psshBoxes = PSSHParser.parse(initData);
          window.postMessage({
            type: 'DRM_MONITOR_PSSH',
            keySystem,
            psshBoxes: psshBoxes.map(p => ({
              systemID: p.systemID,
              drmType: p.drmType,
              kids: p.kids,
              dataBase64: p.dataBase64
            }))
          }, '*');
        } catch (e) {
          console.error('[DRM Monitor] PSSH parse error:', e);
        }
      }

      return originalGenerateRequest(initDataType, initData);
    };

    // Intercept license message
    session.addEventListener('message', (event) => {
      window.postMessage({
        type: 'DRM_MONITOR_LICENSE_MESSAGE',
        keySystem,
        messageType: event.messageType,
        messageBase64: arrayBufferToBase64(event.message)
      }, '*');
    });

    session.update = async function(response) {
      console.log('[DRM Monitor] update (license response):', {
        responseLength: response.byteLength
      });

      window.postMessage({
        type: 'DRM_MONITOR_LICENSE_RESPONSE',
        keySystem,
        responseLength: response.byteLength,
        // Don't send actual response for security
      }, '*');

      return originalUpdate(response);
    };

    // Monitor key status changes
    session.addEventListener('keystatuseschange', () => {
      const keyStatuses = [];
      session.keyStatuses.forEach((status, keyId) => {
        keyStatuses.push({
          keyId: arrayBufferToHex(keyId),
          status
        });
      });

      window.postMessage({
        type: 'DRM_MONITOR_KEY_STATUS',
        keySystem,
        keyStatuses
      }, '*');
    });

    return session;
  }

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function arrayBufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  console.log('[DRM Monitor] EME API wrapped successfully');
})();
```

---

## 6. DRM Error Codes and Meanings

### Shaka Player DRM Error Codes

| Code | Name | Description |
|------|------|-------------|
| 6001 | REQUESTED_KEY_SYSTEM_CONFIG_UNAVAILABLE | Key system not supported or not using secure origin (HTTPS) |
| 6002 | FAILED_TO_CREATE_CDM | Could not create Content Decryption Module |
| 6003 | FAILED_TO_ATTACH_TO_VIDEO | Could not attach MediaKeys to video element |
| 6004 | INVALID_SERVER_CERTIFICATE | Server certificate is invalid or missing |
| 6005 | FAILED_TO_CREATE_SESSION | Could not create MediaKeySession |
| 6006 | FAILED_TO_GENERATE_LICENSE_REQUEST | CDM could not generate license request |
| 6007 | LICENSE_REQUEST_FAILED | HTTP error during license request |
| 6008 | LICENSE_RESPONSE_REJECTED | CDM rejected the license response |
| 6010 | ENCRYPTED_CONTENT_WITHOUT_DRM_INFO | Content is encrypted but no DRM info in manifest |
| 6012 | NO_LICENSE_SERVER_GIVEN | No license server URL configured |
| 6013 | OFFLINE_SESSION_REMOVED | Offline session was removed |
| 6014 | EXPIRED | License/keys have expired |

### MediaKeySession Closed Reasons (Chrome 96+)

| Reason | Description |
|--------|-------------|
| `internal-error` | Unrecoverable CDM error |
| `closed-by-application` | Application called close() |
| `release-acknowledged` | Server acknowledged license release |
| `hardware-context-reset` | Hardware reset (e.g., sleep/wake) |
| `resource-evicted` | System reclaimed CDM resources |

### Common Widevine CDM Errors

| Error | Possible Cause | Solution |
|-------|----------------|----------|
| CDM crash | Multiple player instances | Close other sessions |
| License denied | Expired/invalid license | Check license server |
| Output restricted | HDCP not supported | Use different display |
| VMP validation required | Device verification needed | Update Chrome/OS |
| Internal error (89) | License parsing failed | Check license format |

### dash.js Protection Error Codes

| Code | Description |
|------|-------------|
| 111 | MEDIA_KEYERR_UNKNOWN |
| 112 | MEDIA_KEYERR_CLIENT |
| 113 | MEDIA_KEYERR_SERVICE |
| 114 | MEDIA_KEYERR_OUTPUT |
| 115 | MEDIA_KEYERR_HARDWARECHANGE |
| 116 | MEDIA_KEYERR_DOMAIN |

---

## 7. Chrome Extension Capabilities vs Limitations

### What Chrome Extensions CAN Do

1. **Intercept Network Requests**
   - Monitor all license server requests/responses via `webRequest` API
   - Inspect headers (including DRM-specific headers like `X-AxDRM-Message`)
   - Modify requests (add headers, change URLs) - with permissions

2. **Parse Manifests**
   - Fetch and parse MPD/M3U8 manifests
   - Extract DRM information (ContentProtection, EXT-X-KEY)
   - Parse PSSH boxes from manifest

3. **Monitor EME API Calls**
   - Inject scripts to wrap EME methods
   - Capture key system requests
   - Monitor session events and key statuses

4. **Display DRM Information**
   - Show detected DRM systems
   - Display license server URLs
   - Show key statuses and errors

5. **Access DevTools Protocol**
   - Via `chrome.debugger` API (with user permission)
   - Full network inspection including WebSocket

### What Chrome Extensions CANNOT Do

1. **Access Actual Decryption Keys**
   - Keys are protected within the CDM's secure environment
   - Cannot extract Widevine L1 keys (hardware protected)
   - L3 keys are theoretically extractable but doing so violates DRM policies

2. **Bypass DRM Protection**
   - Cannot decrypt protected content
   - Cannot disable HDCP requirements
   - Cannot upgrade security levels

3. **Modify CDM Behavior**
   - Cannot change how CDM processes licenses
   - Cannot intercept decryption operations

4. **Access Cross-Origin Data Without CORS**
   - Some license servers block cross-origin requests
   - May need to observe rather than fetch directly

### Content Script vs Main World

| Feature | Content Script | Main World (Injected) |
|---------|---------------|----------------------|
| Access DOM | Yes | Yes |
| Access Page JS Variables | No | Yes |
| Override Browser APIs (EME) | No | Yes |
| Access Chrome Extension APIs | Yes | No |
| Isolated Environment | Yes | No |

---

## 8. Implementation Strategies

### Strategy 1: Passive Monitoring

Best for: Non-intrusive DRM detection without modifying page behavior

```javascript
// content-script.js
class PassiveDRMMonitor {
  constructor() {
    this.drmInfo = {
      detected: [],
      licenseUrls: [],
      errors: []
    };

    this.observeNetwork();
    this.observeVideo();
  }

  observeNetwork() {
    // Use PerformanceObserver for network monitoring
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.checkForLicenseRequest(entry);
      }
    });
    observer.observe({ entryTypes: ['resource'] });
  }

  observeVideo() {
    // Watch for video elements
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.tagName === 'VIDEO') {
            this.attachVideoListeners(node);
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Check existing videos
    document.querySelectorAll('video').forEach(v => this.attachVideoListeners(v));
  }

  attachVideoListeners(video) {
    video.addEventListener('encrypted', (e) => {
      this.drmInfo.detected.push({
        initDataType: e.initDataType,
        timestamp: Date.now()
      });
      this.notifyExtension();
    });
  }

  checkForLicenseRequest(entry) {
    const licensePatterns = [
      /license/i, /widevine/i, /playready/i, /fairplay/i,
      /drm/i, /ckc/i, /rightsmanager/i
    ];

    if (licensePatterns.some(p => p.test(entry.name))) {
      this.drmInfo.licenseUrls.push({
        url: entry.name,
        timestamp: Date.now()
      });
      this.notifyExtension();
    }
  }

  notifyExtension() {
    chrome.runtime.sendMessage({
      type: 'DRM_INFO_UPDATE',
      data: this.drmInfo
    });
  }
}

new PassiveDRMMonitor();
```

### Strategy 2: Active EME Interception

Best for: Detailed DRM debugging and analysis

```javascript
// content-script.js - Inject into main world
const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
(document.head || document.documentElement).appendChild(script);

// Listen for messages from injected script
window.addEventListener('message', (event) => {
  if (event.source !== window) return;

  if (event.data.type?.startsWith('DRM_MONITOR_')) {
    chrome.runtime.sendMessage({
      type: event.data.type,
      data: event.data
    });
  }
});
```

### Strategy 3: Manifest Pre-Analysis

Best for: Quick DRM detection before playback

```javascript
// background.js
chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (details.url.match(/\.(mpd|m3u8)($|\?)/i)) {
      analyzeManifest(details.url, details.tabId);
    }
  },
  { urls: ['<all_urls>'] }
);

async function analyzeManifest(url, tabId) {
  try {
    const response = await fetch(url);
    const text = await response.text();

    let drmInfo;
    if (url.endsWith('.mpd') || text.includes('<MPD')) {
      drmInfo = parseDashDRM(text);
    } else {
      drmInfo = parseHlsDRM(text);
    }

    chrome.tabs.sendMessage(tabId, {
      type: 'MANIFEST_DRM_INFO',
      url,
      drmInfo
    });
  } catch (e) {
    console.error('Manifest analysis failed:', e);
  }
}
```

---

## Tools and Resources

### Online Tools

- [PSSH Box Decoder (WebAssembly)](https://emarsden.github.io/pssh-box-wasm/decode/)
- [Axinom PSSH Box Decoder](https://tools.axinom.com/decoders/PsshBox)
- [DRMSense - Browser DRM Capability Detector](https://github.com/avikekk/DRMSense)

### Chrome Extensions for Development

- [EME Logger](https://chromewebstore.google.com/detail/eme-call-and-event-logger/cniohcjecdcdhgmlofniddfoeokbpbpb) - Official Google extension for logging EME events

### Libraries

- [Shaka Player](https://github.com/shaka-project/shaka-player) - Google's adaptive streaming player with excellent DRM support
- [dash.js](https://github.com/Dash-Industry-Forum/dash.js) - Reference DASH player
- [hls.js](https://github.com/video-dev/hls.js) - HLS player with EME support

### Specifications

- [W3C EME Specification](https://w3c.github.io/encrypted-media/)
- [CENC InitData Format](https://www.w3.org/TR/eme-initdata-cenc/)
- [DASH-IF Content Protection](https://dashif.org/identifiers/content_protection/)

---

## Summary: What We Can Extract Without Decrypting

| Information | Source | Accessible |
|-------------|--------|------------|
| DRM System Type | Manifest, PSSH | Yes |
| System UUID | Manifest, PSSH | Yes |
| License Server URL | Network, Manifest | Yes |
| Key IDs (KIDs) | PSSH, Manifest | Yes |
| Key Statuses | EME API | Yes |
| Robustness Level | EME API | Yes |
| PSSH Data (encrypted) | Manifest, Init Segment | Yes |
| License Challenge | EME message event | Yes (binary) |
| License Response | EME update | Yes (binary, encrypted) |
| **Actual Decryption Keys** | CDM | **No** |
| **Decrypted Content** | CDM | **No** |

---

*This research provides a foundation for building DRM-aware video debugging tools while respecting the security boundaries of modern DRM systems.*

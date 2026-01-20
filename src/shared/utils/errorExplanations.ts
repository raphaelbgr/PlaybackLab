/**
 * Error Explanation Database
 * Plain-language explanations for common streaming errors
 * SOLID: Single Responsibility - Error translation only
 */

export interface ErrorExplanation {
  code: string;
  title: string;
  description: string;
  possibleCauses: string[];
  suggestedFixes: string[];
  severity: 'info' | 'warning' | 'error' | 'critical';
  category: 'network' | 'drm' | 'manifest' | 'playback' | 'codec' | 'unknown';
}

// Network Errors
const networkErrors: Record<string, ErrorExplanation> = {
  'NETWORK_ERROR': {
    code: 'NETWORK_ERROR',
    title: 'Network Connection Failed',
    description: 'The player could not establish a connection to the streaming server.',
    possibleCauses: [
      'Internet connection is unstable or disconnected',
      'The streaming server is down or unreachable',
      'Firewall or proxy is blocking the connection',
      'DNS resolution failed',
    ],
    suggestedFixes: [
      'Check your internet connection',
      'Try refreshing the page',
      'Check if other websites are working',
      'Try disabling VPN or proxy',
    ],
    severity: 'error',
    category: 'network',
  },
  '403': {
    code: '403',
    title: 'Access Denied (403 Forbidden)',
    description: 'The server refused to provide the requested content. This usually means authentication or authorization failed.',
    possibleCauses: [
      'Token has expired or is invalid',
      'Geographic restrictions (geo-blocking)',
      'Subscription or access rights issue',
      'CDN token authentication failed',
      'Hotlink protection triggered',
    ],
    suggestedFixes: [
      'Refresh the page to get a new token',
      'Check if you\'re logged in',
      'Verify your subscription is active',
      'Try using a VPN if geo-blocked',
      'Contact support if issue persists',
    ],
    severity: 'error',
    category: 'network',
  },
  '404': {
    code: '404',
    title: 'Content Not Found (404)',
    description: 'The requested stream or segment could not be found on the server.',
    possibleCauses: [
      'Stream has been removed or expired',
      'Incorrect URL or manifest path',
      'CDN configuration issue',
      'Content not yet published',
    ],
    suggestedFixes: [
      'Verify the stream URL is correct',
      'Check if the content is still available',
      'Try a different quality level',
      'Contact the content provider',
    ],
    severity: 'error',
    category: 'network',
  },
  '500': {
    code: '500',
    title: 'Server Error (500)',
    description: 'The streaming server encountered an internal error while processing the request.',
    possibleCauses: [
      'Server overload or maintenance',
      'Backend processing error',
      'Database connection issue',
      'Configuration problem on server',
    ],
    suggestedFixes: [
      'Wait a few minutes and try again',
      'The issue is server-side, not your fault',
      'Check the service status page',
      'Contact support if issue persists',
    ],
    severity: 'critical',
    category: 'network',
  },
  '503': {
    code: '503',
    title: 'Service Unavailable (503)',
    description: 'The streaming service is temporarily unavailable, likely due to high load or maintenance.',
    possibleCauses: [
      'Server is overloaded with requests',
      'Scheduled or emergency maintenance',
      'DDoS attack mitigation',
      'CDN capacity exceeded',
    ],
    suggestedFixes: [
      'Wait and try again in a few minutes',
      'Check if it\'s a popular live event (high traffic)',
      'Try again during off-peak hours',
      'Check service status announcements',
    ],
    severity: 'warning',
    category: 'network',
  },
};

// DRM Errors
const drmErrors: Record<string, ErrorExplanation> = {
  'DRM_NOT_SUPPORTED': {
    code: 'DRM_NOT_SUPPORTED',
    title: 'DRM Not Supported',
    description: 'Your browser does not support the DRM system required by this content.',
    possibleCauses: [
      'Browser doesn\'t support required DRM (Widevine/PlayReady/FairPlay)',
      'DRM components not installed or outdated',
      'Using an unsupported browser or OS',
      'Browser running in a restricted mode',
    ],
    suggestedFixes: [
      'Try a different browser (Chrome for Widevine, Safari for FairPlay)',
      'Update your browser to the latest version',
      'Enable DRM in browser settings',
      'Disable any extensions that might block DRM',
    ],
    severity: 'error',
    category: 'drm',
  },
  'LICENSE_REQUEST_FAILED': {
    code: 'LICENSE_REQUEST_FAILED',
    title: 'License Request Failed',
    description: 'The player could not obtain a decryption license from the DRM server.',
    possibleCauses: [
      'License server is down or unreachable',
      'Authentication token expired',
      'Device not authorized for playback',
      'Too many concurrent streams',
    ],
    suggestedFixes: [
      'Refresh the page and try again',
      'Check if you\'re logged in',
      'Close other tabs playing protected content',
      'Try on a different device',
    ],
    severity: 'error',
    category: 'drm',
  },
  'KEY_EXPIRED': {
    code: 'KEY_EXPIRED',
    title: 'License Key Expired',
    description: 'The decryption key for this content has expired and needs to be renewed.',
    possibleCauses: [
      'Session has been open too long',
      'License has time-limited validity',
      'Server clock sync issue',
    ],
    suggestedFixes: [
      'Refresh the page to get a new license',
      'Check your system clock is correct',
      'Re-authenticate if prompted',
    ],
    severity: 'warning',
    category: 'drm',
  },
  'HDCP_ERROR': {
    code: 'HDCP_ERROR',
    title: 'HDCP Protection Error',
    description: 'High-bandwidth Digital Content Protection (HDCP) requirements not met.',
    possibleCauses: [
      'Display doesn\'t support required HDCP version',
      'Using screen recording software',
      'HDMI cable or connection issue',
      'Multiple monitors with mixed HDCP support',
    ],
    suggestedFixes: [
      'Try disconnecting secondary monitors',
      'Use a different HDMI cable',
      'Close screen recording software',
      'Try playing on a different device',
    ],
    severity: 'error',
    category: 'drm',
  },
};

// Manifest Errors
const manifestErrors: Record<string, ErrorExplanation> = {
  'MANIFEST_PARSE_ERROR': {
    code: 'MANIFEST_PARSE_ERROR',
    title: 'Manifest Parse Error',
    description: 'The player could not understand the stream manifest (playlist) format.',
    possibleCauses: [
      'Malformed or corrupted manifest file',
      'Server returned HTML error page instead of manifest',
      'Incompatible manifest version',
      'Character encoding issue',
    ],
    suggestedFixes: [
      'Check if the manifest URL returns valid content',
      'Verify server CORS headers are correct',
      'Try a different stream if available',
      'Report the issue to the content provider',
    ],
    severity: 'error',
    category: 'manifest',
  },
  'NO_PLAYABLE_STREAMS': {
    code: 'NO_PLAYABLE_STREAMS',
    title: 'No Playable Streams Found',
    description: 'The manifest was parsed but contains no streams that this browser can play.',
    possibleCauses: [
      'All variants use unsupported codecs',
      'Stream requires capabilities browser lacks',
      'Manifest is empty or malformed',
      'Geographic or device restrictions',
    ],
    suggestedFixes: [
      'Try a different browser',
      'Check browser codec support',
      'Contact content provider about compatibility',
    ],
    severity: 'error',
    category: 'manifest',
  },
  'MANIFEST_LOAD_TIMEOUT': {
    code: 'MANIFEST_LOAD_TIMEOUT',
    title: 'Manifest Load Timeout',
    description: 'The manifest took too long to load, causing a timeout.',
    possibleCauses: [
      'Slow network connection',
      'Server responding slowly',
      'Large manifest file',
      'Network congestion',
    ],
    suggestedFixes: [
      'Check your internet connection speed',
      'Try again - might be temporary',
      'Use a wired connection instead of WiFi',
    ],
    severity: 'warning',
    category: 'manifest',
  },
};

// Playback Errors
const playbackErrors: Record<string, ErrorExplanation> = {
  'BUFFER_STALLED': {
    code: 'BUFFER_STALLED',
    title: 'Buffering Stalled',
    description: 'Video playback stopped because the buffer ran empty and new data isn\'t arriving.',
    possibleCauses: [
      'Network bandwidth dropped below required bitrate',
      'Server stopped sending data',
      'ABR algorithm stuck on too high quality',
      'Network packet loss',
    ],
    suggestedFixes: [
      'Wait for buffering to complete',
      'Try lowering video quality manually',
      'Check your internet connection',
      'Move closer to your WiFi router',
    ],
    severity: 'warning',
    category: 'playback',
  },
  'MEDIA_DECODE_ERROR': {
    code: 'MEDIA_DECODE_ERROR',
    title: 'Media Decode Error',
    description: 'The browser could not decode the video or audio data.',
    possibleCauses: [
      'Corrupted segment data',
      'Codec not supported by browser',
      'Hardware decoder issue',
      'Memory pressure on device',
    ],
    suggestedFixes: [
      'Try refreshing the page',
      'Close other tabs and applications',
      'Disable hardware acceleration in browser',
      'Try a different browser',
    ],
    severity: 'error',
    category: 'playback',
  },
  'QUOTA_EXCEEDED': {
    code: 'QUOTA_EXCEEDED',
    title: 'Buffer Quota Exceeded',
    description: 'The browser\'s media buffer has reached its size limit.',
    possibleCauses: [
      'Video has been paused for too long while buffering continued',
      'Very high bitrate stream filling buffer quickly',
      'Memory pressure on device',
      'Multiple videos buffering simultaneously',
    ],
    suggestedFixes: [
      'Refresh the page',
      'Close other tabs with video',
      'Don\'t leave video paused for long periods',
    ],
    severity: 'warning',
    category: 'playback',
  },
};

// Codec Errors
const codecErrors: Record<string, ErrorExplanation> = {
  'CODEC_NOT_SUPPORTED': {
    code: 'CODEC_NOT_SUPPORTED',
    title: 'Codec Not Supported',
    description: 'Your browser doesn\'t support the video or audio codec used by this stream.',
    possibleCauses: [
      'Stream uses HEVC/H.265 (limited browser support)',
      'Stream uses AV1 (newer codec)',
      'Audio codec not supported (e.g., AC-3, E-AC-3)',
      'Browser is outdated',
    ],
    suggestedFixes: [
      'Try Chrome or Edge for best codec support',
      'Update your browser',
      'Check if lower quality uses a different codec',
      'Install codec extensions if available',
    ],
    severity: 'error',
    category: 'codec',
  },
};

// Combine all error databases
const allErrors: Record<string, ErrorExplanation> = {
  ...networkErrors,
  ...drmErrors,
  ...manifestErrors,
  ...playbackErrors,
  ...codecErrors,
};

/**
 * Get explanation for an error code
 */
export function getErrorExplanation(code: string): ErrorExplanation | null {
  // Check exact match first
  if (allErrors[code]) {
    return allErrors[code];
  }

  // Check if it's an HTTP status code
  const httpCode = code.replace(/[^0-9]/g, '');
  if (allErrors[httpCode]) {
    return allErrors[httpCode];
  }

  // Check for partial matches
  const upperCode = code.toUpperCase();
  for (const [key, explanation] of Object.entries(allErrors)) {
    if (upperCode.includes(key) || key.includes(upperCode)) {
      return explanation;
    }
  }

  return null;
}

/**
 * Get all errors by category
 */
export function getErrorsByCategory(category: ErrorExplanation['category']): ErrorExplanation[] {
  return Object.values(allErrors).filter((e) => e.category === category);
}

/**
 * Get all error codes
 */
export function getAllErrorCodes(): string[] {
  return Object.keys(allErrors);
}

/**
 * Search errors by keyword
 */
export function searchErrors(query: string): ErrorExplanation[] {
  const lowerQuery = query.toLowerCase();
  return Object.values(allErrors).filter(
    (e) =>
      e.code.toLowerCase().includes(lowerQuery) ||
      e.title.toLowerCase().includes(lowerQuery) ||
      e.description.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Copy as cURL Utility
 * Generate cURL commands from network requests
 */

export interface RequestInfo {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  cookies?: string;
}

/**
 * Generate a cURL command from request info
 */
export function generateCurlCommand(request: RequestInfo): string {
  const parts: string[] = ['curl'];

  // Method (if not GET)
  if (request.method && request.method !== 'GET') {
    parts.push(`-X ${request.method}`);
  }

  // URL
  parts.push(`'${escapeShellArg(request.url)}'`);

  // Headers
  if (request.headers) {
    Object.entries(request.headers).forEach(([key, value]) => {
      // Skip pseudo-headers and some browser-specific headers
      if (key.startsWith(':') || key.toLowerCase() === 'host') {
        return;
      }
      parts.push(`-H '${escapeShellArg(key)}: ${escapeShellArg(value)}'`);
    });
  }

  // Cookies
  if (request.cookies) {
    parts.push(`-b '${escapeShellArg(request.cookies)}'`);
  }

  // Body
  if (request.body) {
    parts.push(`-d '${escapeShellArg(request.body)}'`);
  }

  // Useful flags
  parts.push('--compressed'); // Accept compressed responses
  parts.push('-L'); // Follow redirects

  return parts.join(' \\\n  ');
}

/**
 * Generate a fetch() call from request info
 */
export function generateFetchCode(request: RequestInfo): string {
  const options: Record<string, unknown> = {
    method: request.method || 'GET',
  };

  if (request.headers && Object.keys(request.headers).length > 0) {
    // Filter out pseudo-headers
    const filteredHeaders: Record<string, string> = {};
    Object.entries(request.headers).forEach(([key, value]) => {
      if (!key.startsWith(':') && key.toLowerCase() !== 'host') {
        filteredHeaders[key] = value;
      }
    });
    if (Object.keys(filteredHeaders).length > 0) {
      options.headers = filteredHeaders;
    }
  }

  if (request.body) {
    options.body = request.body;
  }

  const optionsStr = JSON.stringify(options, null, 2)
    .split('\n')
    .map((line, i) => (i === 0 ? line : '  ' + line))
    .join('\n');

  return `fetch('${request.url}', ${optionsStr})
  .then(response => response.text())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));`;
}

/**
 * Generate wget command from request info
 */
export function generateWgetCommand(request: RequestInfo): string {
  const parts: string[] = ['wget'];

  // Output to stdout
  parts.push('-O -');

  // Method
  if (request.method && request.method !== 'GET') {
    parts.push(`--method=${request.method}`);
  }

  // Headers
  if (request.headers) {
    Object.entries(request.headers).forEach(([key, value]) => {
      if (!key.startsWith(':') && key.toLowerCase() !== 'host') {
        parts.push(`--header='${escapeShellArg(key)}: ${escapeShellArg(value)}'`);
      }
    });
  }

  // Body
  if (request.body) {
    parts.push(`--body-data='${escapeShellArg(request.body)}'`);
  }

  // URL
  parts.push(`'${escapeShellArg(request.url)}'`);

  return parts.join(' \\\n  ');
}

/**
 * Generate ffprobe command for stream analysis
 */
export function generateFfprobeCommand(url: string, headers?: Record<string, string>): string {
  const parts: string[] = ['ffprobe'];

  // Verbose level
  parts.push('-v quiet');

  // Output format
  parts.push('-print_format json');

  // Show all information
  parts.push('-show_format');
  parts.push('-show_streams');

  // Headers
  if (headers) {
    const headerStr = Object.entries(headers)
      .filter(([key]) => !key.startsWith(':'))
      .map(([key, value]) => `${key}: ${value}`)
      .join('\\r\\n');
    if (headerStr) {
      parts.push(`-headers '${escapeShellArg(headerStr)}'`);
    }
  }

  // URL
  parts.push(`'${escapeShellArg(url)}'`);

  return parts.join(' \\\n  ');
}

/**
 * Generate ffplay command for playback
 */
export function generateFfplayCommand(url: string, headers?: Record<string, string>): string {
  const parts: string[] = ['ffplay'];

  // Headers
  if (headers) {
    const headerStr = Object.entries(headers)
      .filter(([key]) => !key.startsWith(':'))
      .map(([key, value]) => `${key}: ${value}`)
      .join('\\r\\n');
    if (headerStr) {
      parts.push(`-headers '${escapeShellArg(headerStr)}'`);
    }
  }

  // Auto-exit on completion
  parts.push('-autoexit');

  // URL
  parts.push(`'${escapeShellArg(url)}'`);

  return parts.join(' ');
}

/**
 * Escape shell argument
 */
function escapeShellArg(arg: string): string {
  return arg.replace(/'/g, "'\\''");
}

/**
 * Copy text to clipboard
 * Handles permissions policy restrictions and provides multiple fallbacks
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Method 1: Modern Clipboard API (preferred)
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      // Clipboard API blocked by permissions policy - try fallbacks
      console.debug('[Clipboard] Clipboard API blocked, trying fallback:', error);
    }
  }

  // Method 2: execCommand fallback (deprecated but widely supported)
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;

    // Prevent scrolling and visibility issues
    textArea.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 2em;
      height: 2em;
      padding: 0;
      border: none;
      outline: none;
      box-shadow: none;
      background: transparent;
      opacity: 0;
      z-index: -1;
    `;

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    // Try to select all text (for older browsers)
    textArea.setSelectionRange(0, text.length);

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);

    if (successful) {
      return true;
    }
  } catch (error) {
    console.debug('[Clipboard] execCommand fallback failed:', error);
  }

  // Method 3: Input element fallback (some browsers prefer input over textarea)
  try {
    const input = document.createElement('input');
    input.value = text;
    input.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      opacity: 0;
      z-index: -1;
    `;

    document.body.appendChild(input);
    input.focus();
    input.select();

    const successful = document.execCommand('copy');
    document.body.removeChild(input);

    if (successful) {
      return true;
    }
  } catch (error) {
    console.debug('[Clipboard] Input fallback failed:', error);
  }

  // All methods failed
  console.warn('[Clipboard] All copy methods failed. Text to copy:', text.slice(0, 100) + '...');
  return false;
}

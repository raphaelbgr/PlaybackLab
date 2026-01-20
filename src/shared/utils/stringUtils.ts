/**
 * String Utilities
 * Centralized string manipulation functions with null safety
 */

/**
 * Safely convert a string to uppercase with fallback
 * @param value - The value to convert (can be undefined/null)
 * @param fallback - Fallback value if input is falsy (default: 'unknown')
 * @returns Uppercase string
 */
export function safeUpperCase(value: string | undefined | null, fallback: string = 'unknown'): string {
  return (value || fallback).toUpperCase();
}

/**
 * Safely convert a string to lowercase with fallback
 * @param value - The value to convert (can be undefined/null)
 * @param fallback - Fallback value if input is falsy (default: 'unknown')
 * @returns Lowercase string
 */
export function safeLowerCase(value: string | undefined | null, fallback: string = 'unknown'): string {
  return (value || fallback).toLowerCase();
}

/**
 * Get a display-safe type string (uppercase)
 * Common pattern used throughout the app for stream types, DRM types, etc.
 * @param type - The type value (can be undefined/null)
 * @returns Uppercase type string
 */
export function displayType(type: string | undefined | null): string {
  return safeUpperCase(type, 'UNKNOWN');
}

/**
 * Get a CSS-safe class name from a type
 * @param type - The type value (can be undefined/null)
 * @returns Lowercase class-safe string
 */
export function typeToClassName(type: string | undefined | null): string {
  return safeLowerCase(type, 'unknown');
}

/**
 * Format bitrate for display
 * @param bps - Bitrate in bits per second
 * @returns Formatted string (e.g., "5.2 Mbps", "320 Kbps")
 */
export function formatBitrate(bps: number | undefined | null): string {
  if (!bps) return 'N/A';
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`;
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(0)} Kbps`;
  return `${bps} bps`;
}

/**
 * Format bitrate in short form
 * @param bps - Bitrate in bits per second
 * @returns Short formatted string (e.g., "5.2M", "320K")
 */
export function formatBitrateShort(bps: number | undefined | null): string {
  if (!bps) return 'N/A';
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)}M`;
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(0)}K`;
  return `${bps}`;
}

/**
 * Format duration from seconds
 * @param seconds - Duration in seconds
 * @returns Formatted string (e.g., "1:23:45" or "23:45")
 */
export function formatDuration(seconds: number | undefined | null): string {
  if (!seconds || !isFinite(seconds)) return 'N/A';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Extract filename from URL
 * @param url - The URL to extract filename from
 * @returns The filename or 'manifest' as fallback
 */
export function getFilenameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const segments = urlObj.pathname.split('/').filter(Boolean);
    return segments[segments.length - 1] || 'manifest';
  } catch {
    return 'manifest';
  }
}

/**
 * Get truncated display URL
 * @param url - The full URL
 * @param maxPathLength - Maximum path length before truncation (default: 40)
 * @returns Truncated URL for display
 */
export function getDisplayUrl(url: string, maxPathLength: number = 40): string {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    const truncatedPath = path.length > maxPathLength
      ? '...' + path.slice(-(maxPathLength - 3))
      : path;
    return urlObj.host + truncatedPath;
  } catch {
    return url.slice(0, maxPathLength + 20);
  }
}

/**
 * Get a grouping key for a stream URL (hostname + filename)
 * Used to group similar streams (e.g., same video with different quality URLs)
 * @param url - The stream URL
 * @returns A grouping key string
 */
export function getStreamGroupKey(url: string): string {
  try {
    const urlObj = new URL(url);
    const filename = getFilenameFromUrl(url);
    return `${urlObj.hostname}/${filename}`;
  } catch {
    return url;
  }
}

/**
 * Extract a clean title from page title
 * Removes common suffixes like " - YouTube", " | Netflix", etc.
 * @param pageTitle - The raw page title
 * @returns Cleaned title
 */
export function cleanPageTitle(pageTitle: string | undefined): string {
  if (!pageTitle) return '';

  // Remove common platform suffixes
  const suffixes = [
    / - YouTube$/i,
    / \| Netflix$/i,
    / - Watch on Twitch$/i,
    / on Vimeo$/i,
    / - Prime Video$/i,
    / \| Disney\+$/i,
    / - HBO Max$/i,
    / \| Hulu$/i,
    / - Peacock$/i,
    / - Paramount\+$/i,
  ];

  let cleaned = pageTitle;
  for (const suffix of suffixes) {
    cleaned = cleaned.replace(suffix, '');
  }

  return cleaned.trim();
}

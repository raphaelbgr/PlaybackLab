/**
 * Content Script
 * SOLID: Single Responsibility - Page-level video detection
 *
 * This script runs in the page context to detect video elements
 * and their associated players (hls.js, dash.js, Shaka, etc.)
 */

// WXT content script configuration
export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    console.log('[PlaybackLab] Content script loaded');

    // Detect video elements
    const detectVideoElements = (): void => {
      const videos = document.querySelectorAll('video');
      videos.forEach((video, index) => {
        // Check for player instances attached to video
        const videoElement = video as HTMLVideoElement & {
          hls?: unknown;
          player?: unknown;
          shaka?: unknown;
        };
        const hlsInstance = videoElement.hls;
        const dashInstance = videoElement.player;
        const shakaInstance = videoElement.shaka;

        if (hlsInstance || dashInstance || shakaInstance) {
          chrome.runtime.sendMessage({
            type: 'VIDEO_ELEMENT_DETECTED',
            payload: {
              index,
              hasHls: !!hlsInstance,
              hasDash: !!dashInstance,
              hasShaka: !!shakaInstance,
              src: video.src || video.currentSrc,
            },
          }).catch(() => {
            // Extension context may not be available
          });
        }
      });
    };

    // Initial detection
    detectVideoElements();

    // Watch for dynamically added videos
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          detectVideoElements();
          break;
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Cleanup on unload
    window.addEventListener('unload', () => {
      observer.disconnect();
    });
  },
});

// WXT type declaration
declare function defineContentScript(config: {
  matches: string[];
  runAt?: 'document_start' | 'document_end' | 'document_idle';
  main: () => void;
}): { matches: string[]; runAt?: string; main: () => void };

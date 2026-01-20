/**
 * Background Service Worker
 * SOLID: Single Responsibility - Orchestrates stream detection
 */

import { streamDetector } from '../../core/services/StreamDetector';
import type { StreamInfo } from '../../core/interfaces/IStreamDetector';

export default defineBackground(() => {
  // Store detected streams per tab
  const tabStreams = new Map<number, StreamInfo[]>();

  // Listen for web requests to detect streams
  chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
      const result = streamDetector.processRequest(details);

      if (result.detected && result.stream) {
        const stream = result.stream;
        console.log('[PlaybackLab] Stream detected:', stream.type, stream.url);

        // Store in tab map
        const streams = tabStreams.get(stream.tabId) || [];
        streams.push(stream);
        tabStreams.set(stream.tabId, streams);

        // Notify DevTools panel if open
        chrome.runtime.sendMessage({
          type: 'STREAM_DETECTED',
          payload: stream,
        }).catch(() => {
          // DevTools panel not open, ignore
        });
      }
    },
    { urls: ['<all_urls>'] },
    []
  );

  // Clean up when tab closes
  chrome.tabs.onRemoved.addListener((tabId) => {
    tabStreams.delete(tabId);
    streamDetector.clearForTab(tabId);
  });

  // Clean up when tab navigates
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading') {
      tabStreams.delete(tabId);
      streamDetector.clearForTab(tabId);
    }
  });

  // Handle messages from DevTools panel
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    switch (message.type) {
      case 'GET_STREAMS': {
        const tabId = message.tabId as number;
        const streams = tabStreams.get(tabId) || [];
        sendResponse({ streams });
        return false;
      }

      case 'FETCH_MANIFEST': {
        const { url, headers } = message.payload as { url: string; headers?: Record<string, string> };
        fetchManifest(url, headers)
          .then((content) => sendResponse({ success: true, content }))
          .catch((error: Error) => sendResponse({ success: false, error: error.message }));
        return true; // Keep channel open for async response
      }

      case 'CLEAR_TAB': {
        const tabId = message.tabId as number;
        tabStreams.delete(tabId);
        streamDetector.clearForTab(tabId);
        sendResponse({ success: true });
        return false;
      }

      default:
        return false;
    }
  });

  // Fetch manifest content
  async function fetchManifest(
    url: string,
    customHeaders?: Record<string, string>
  ): Promise<string> {
    const headers: HeadersInit = {
      Accept: '*/*',
      ...customHeaders,
    };

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`Failed to fetch manifest: ${response.status} ${response.statusText}`);
    }

    return response.text();
  }

  // Log extension startup
  console.log('[PlaybackLab] Background service worker started');
});

// WXT type declaration
declare function defineBackground(fn: () => void): { main: () => void };

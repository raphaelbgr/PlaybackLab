/**
 * Safe Chrome API Wrappers
 * Handles common Chrome extension API errors gracefully
 *
 * Common errors handled:
 * - "No tab with id: X" - Tab was closed
 * - "Could not establish connection" - Extension context invalidated
 * - "The message port closed" - Receiving end doesn't exist
 */

/**
 * Check if the Chrome runtime has any errors
 * Call this after any chrome.runtime API call to clear the error
 */
export function checkRuntimeError(): chrome.runtime.LastError | undefined {
  const error = chrome.runtime.lastError;
  if (error) {
    // Log but don't throw - this clears the error
    console.debug('[ChromeAPI] Runtime error (handled):', error.message);
  }
  return error;
}

/**
 * Safely get a tab by ID
 * Returns null if the tab doesn't exist or was closed
 */
export async function safeGetTab(tabId: number): Promise<chrome.tabs.Tab | null> {
  try {
    const tab = await chrome.tabs.get(tabId);
    checkRuntimeError();
    return tab;
  } catch (error) {
    // Tab doesn't exist or was closed
    console.debug(`[ChromeAPI] Tab ${tabId} not found (may have been closed)`);
    return null;
  }
}

/**
 * Safely send a message to a tab
 * Returns null if the tab doesn't exist or the content script isn't loaded
 */
export async function safeSendTabMessage<T = unknown>(
  tabId: number,
  message: unknown
): Promise<T | null> {
  try {
    // First check if tab exists
    const tab = await safeGetTab(tabId);
    if (!tab) {
      return null;
    }

    const response = await chrome.tabs.sendMessage(tabId, message);
    checkRuntimeError();
    return response as T;
  } catch (error) {
    // Content script not loaded, tab closed, or other error
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes('Receiving end does not exist') ||
        errorMsg.includes('Could not establish connection') ||
        errorMsg.includes('No tab with id')) {
      console.debug(`[ChromeAPI] Cannot send message to tab ${tabId}:`, errorMsg);
    } else {
      console.warn(`[ChromeAPI] Error sending message to tab ${tabId}:`, errorMsg);
    }
    return null;
  }
}

/**
 * Safely send a message to the background/service worker
 * Returns null if the extension context is invalid
 */
export async function safeSendRuntimeMessage<T = unknown>(
  message: unknown
): Promise<T | null> {
  try {
    const response = await chrome.runtime.sendMessage(message);
    checkRuntimeError();
    return response as T;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes('Extension context invalidated') ||
        errorMsg.includes('message port closed')) {
      console.debug('[ChromeAPI] Extension context invalid, message not sent');
    } else {
      console.warn('[ChromeAPI] Error sending runtime message:', errorMsg);
    }
    return null;
  }
}

/**
 * Safely execute a script in a tab
 * Returns null if the tab doesn't exist or script injection fails
 */
export async function safeExecuteScript<T = unknown>(
  tabId: number,
  func: () => T
): Promise<T | null> {
  try {
    const tab = await safeGetTab(tabId);
    if (!tab) {
      return null;
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func,
    });

    checkRuntimeError();
    return results?.[0]?.result as T ?? null;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.debug(`[ChromeAPI] Cannot execute script in tab ${tabId}:`, errorMsg);
    return null;
  }
}

/**
 * Wrapper for callback-style Chrome APIs
 * Converts to Promise and handles runtime errors
 */
export function wrapChromeCallback<T>(
  apiCall: (callback: (result: T) => void) => void
): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      apiCall((result) => {
        const error = checkRuntimeError();
        if (error) {
          resolve(null);
        } else {
          resolve(result);
        }
      });
    } catch (error) {
      console.debug('[ChromeAPI] API call failed:', error);
      resolve(null);
    }
  });
}

/**
 * Check if we're in a valid extension context
 */
export function isExtensionContextValid(): boolean {
  try {
    // This will throw if context is invalid
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

/**
 * Debounced tab query to avoid spamming the API
 */
let tabQueryCache: { tabs: chrome.tabs.Tab[]; timestamp: number } | null = null;
const TAB_CACHE_TTL = 1000; // 1 second

export async function safeQueryTabs(
  queryInfo: chrome.tabs.QueryInfo
): Promise<chrome.tabs.Tab[]> {
  try {
    // Simple cache for repeated queries
    const now = Date.now();
    if (tabQueryCache && (now - tabQueryCache.timestamp) < TAB_CACHE_TTL) {
      // Filter cached results
      return filterTabs(tabQueryCache.tabs, queryInfo);
    }

    const tabs = await chrome.tabs.query(queryInfo);
    checkRuntimeError();

    // Cache all tabs query
    if (Object.keys(queryInfo).length === 0) {
      tabQueryCache = { tabs, timestamp: now };
    }

    return tabs;
  } catch (error) {
    console.debug('[ChromeAPI] Tab query failed:', error);
    return [];
  }
}

function filterTabs(tabs: chrome.tabs.Tab[], query: chrome.tabs.QueryInfo): chrome.tabs.Tab[] {
  return tabs.filter(tab => {
    if (query.active !== undefined && tab.active !== query.active) return false;
    if (query.currentWindow !== undefined && tab.windowId !== chrome.windows.WINDOW_ID_CURRENT) return false;
    if (query.url && tab.url && !tab.url.includes(query.url)) return false;
    return true;
  });
}

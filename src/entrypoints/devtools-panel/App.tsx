/**
 * Main DevTools Panel App
 * SOLID: Single Responsibility - UI orchestration only
 */

import { useEffect, useState, useCallback } from 'react';
import { useStore, useStreamsList, useSelectedStream, useAdsCount } from '../../store';
import { StreamsPanel } from './components/StreamsPanel';
import { TabBar } from './components/TabBar';
import { NetworkInspector } from './components/NetworkInspector';
import { ExportPanel } from './components/ExportPanel';
import { CommandPalette, type Command } from './components/CommandPalette';
import { SettingsPanel } from './components/SettingsPanel';
import { ToastProvider, useToast } from './components/Toast';
import { useKeyboardShortcuts } from '../../shared/hooks/useKeyboardShortcuts';
import { useLicense } from '../../shared/hooks/useLicense';
import { PaywallOverlay } from './components/PaywallOverlay';
import { generateCurlCommand, copyToClipboard } from '../../shared/utils/copyAsCurl';
import type { StreamInfo } from '../../core/interfaces/IStreamDetector';
import type { ParsedManifest } from '../../core/interfaces/IManifestParser';
import type { DetectedAd, VastParseResult } from '../../core/interfaces/IAdDetector';

type TabId = 'streams' | 'network' | 'export';

// Main app wrapped with ToastProvider
export function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

function AppContent() {
  const { addStream, clearAll, activeTab, setActiveTab, updateAllPlaybackStates, updateManifest, setStreamError, selectStreamByUrl, selectStream, incrementSegmentCount, addAd, updateAdParsedContent, setAdError, clearAds } = useStore();
  const streams = useStreamsList();
  const selectedStream = useSelectedStream();
  const adsCount = useAdsCount();
  const [currentTab, setCurrentTab] = useState<TabId>(activeTab as TabId);
  const { showToast } = useToast();
  const { license, isLoading: licenseLoading, hasAccess } = useLicense();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [videoOverlaysEnabled, setVideoOverlaysEnabled] = useState(false);

  // Listen for stream detection, manifest loaded, playback state, and page selection messages (scoped to current tab)
  useEffect(() => {
    const inspectedTabId = chrome.devtools.inspectedWindow.tabId;

    interface ManifestLoadedPayload {
      streamId: string;
      streamUrl: string;
      tabId: number;
      manifest: ParsedManifest;
    }

    interface SelectStreamPayload {
      url: string;
      streamId: string | null;
      videoIndex: number;
    }

    interface AdParsedPayload extends VastParseResult {
      adId: string;
      tabId: number;
      rawXml: string;
    }

    interface AdErrorPayload {
      adId: string;
      tabId: number;
      error: string;
    }

    const handleMessage = (message: { type: string; payload?: StreamInfo | { tabId: number; streams: StreamInfo[] } | ManifestLoadedPayload | SelectStreamPayload | DetectedAd | AdParsedPayload | AdErrorPayload | { parentStreamId: string; segmentUrl: string } }) => {
      if (message.type === 'STREAM_DETECTED' && message.payload) {
        const stream = message.payload as StreamInfo;
        // Only add streams from the inspected tab
        if (stream.tabId === inspectedTabId) {
          // Check if this is a new stream (not already in the store)
          const state = useStore.getState();
          const isNewStream = !Array.from(state.streams.values()).some(s => s.info.url === stream.url);

          addStream(stream);

          // Show toast for new streams
          if (isNewStream) {
            const streamType = stream.type?.toUpperCase() || 'STREAM';
            showToast('success', `New ${streamType} stream detected`);
          }
        }
      } else if (message.type === 'SEGMENT_DETECTED' && message.payload) {
        const { parentStreamId, segmentUrl } = message.payload as { parentStreamId: string; segmentUrl: string };
        incrementSegmentCount(parentStreamId, segmentUrl);
      } else if (message.type === 'MANIFEST_LOADED' && message.payload) {
        const { streamId, tabId, manifest } = message.payload as ManifestLoadedPayload;
        // Only update manifests from the inspected tab
        if (tabId === inspectedTabId) {
          updateManifest(streamId, manifest);
        }
      } else if (message.type === 'MANIFEST_ERROR' && message.payload) {
        const { streamId, tabId, error } = message.payload as { streamId: string; tabId: number; error: string };
        if (tabId === inspectedTabId) {
          setStreamError(streamId, error);
        }
      } else if (message.type === 'PLAYBACK_STATE_UPDATED' && message.payload) {
        const { tabId, streams: updatedStreams } = message.payload as { tabId: number; streams: StreamInfo[] };
        // Only update streams from the inspected tab
        if (tabId === inspectedTabId) {
          updateAllPlaybackStates(updatedStreams);
        }
      } else if (message.type === 'SELECT_STREAM_IN_PANEL' && message.payload) {
        // User clicked on a video overlay - select the stream
        const { url, streamId } = message.payload as SelectStreamPayload;
        let selected = false;
        const state = useStore.getState();
        const streamsList = Array.from(state.streams.values());

        // Helper: check if a stream has video variants (master playlist)
        const hasVideoVariants = (s: typeof streamsList[0]) =>
          (s.manifest?.videoVariants?.length ?? 0) > 0;

        // Try by stream ID first (most reliable)
        if (streamId && state.streams.has(streamId)) {
          selectStream(streamId);
          selected = true;
        }

        // Try exact URL match only (not fuzzy matching)
        if (!selected && url && !url.startsWith('blob:')) {
          const exactMatch = streamsList.find(s => s.info.url === url);
          if (exactMatch) {
            selectStream(exactMatch.info.id);
            selected = true;
          }
        }

        // If we have a URL that didn't match, check why
        if (!selected && url && !url.startsWith('blob:')) {
          const isNativeMedia = /\.(mp4|webm|ogg|mov|avi|mkv)(\?|$)/i.test(url);
          if (isNativeMedia) {
            showToast('info', 'This is a native MP4/WebM video, not an adaptive stream.');
            return;
          }

          // URL-based match: try matching by pathname (handles query param differences)
          const urlMatch = streamsList.find(s => {
            try {
              return new URL(s.info.url).pathname === new URL(url).pathname
                && new URL(s.info.url).host === new URL(url).host;
            } catch { return false; }
          });
          if (urlMatch) {
            selectStream(urlMatch.info.id);
            selected = true;
          }
        }

        // If still not selected, provide helpful guidance
        if (!selected) {
          if (streamsList.length === 0) {
            showToast('info', 'No streams detected yet. Try loading the video first.');
          } else if (streamsList.length === 1) {
            selectStream(streamsList[0].info.id);
            selected = true;
          } else {
            // Check if video is not loaded — no URL means no player attached
            if (!url || url.startsWith('blob:')) {
              showToast('info', 'Could not match this video. Try loading it first, or select a stream from the list.');
            } else {
              showToast('info', 'Could not match this video to a detected stream. Select one from the list.');
            }
            setCurrentTab('streams');
          }
        }

        // Switch to streams tab if we selected something
        if (selected) {
          setCurrentTab('streams');
        }
      } else if (message.type === 'AD_DETECTED' && message.payload) {
        const ad = message.payload as DetectedAd;
        // Only add ads from the inspected tab
        if (ad.tabId === inspectedTabId) {
          addAd(ad);
          // Show toast for new ads (subtle notification)
          const sourceLabel = ad.source === 'ima' ? 'IMA' : ad.source === 'freewheel' ? 'FreeWheel' : 'Ad';
          showToast('info', `${sourceLabel} ${ad.format.toUpperCase()} detected`);
        }
      } else if (message.type === 'AD_PARSED' && message.payload) {
        const { adId, tabId, ...parsed } = message.payload as AdParsedPayload;
        // Only update ads from the inspected tab
        if (tabId === inspectedTabId) {
          updateAdParsedContent(adId, parsed);
        }
      } else if (message.type === 'AD_ERROR' && message.payload) {
        const { adId, tabId, error } = message.payload as AdErrorPayload;
        // Only update ads from the inspected tab
        if (tabId === inspectedTabId) {
          setAdError(adId, error);
        }
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    // Request existing streams for this tab only (includes cached manifests/errors)
    chrome.runtime.sendMessage({ type: 'GET_STREAMS', tabId: inspectedTabId }, (response) => {
      if (response?.streams) {
        // Filter to ensure only streams from this tab (redundant but safe)
        response.streams
          .filter((stream: StreamInfo) => stream.tabId === inspectedTabId)
          .forEach((stream: StreamInfo) => addStream(stream));

        // Apply cached manifests from background (prevents OverviewTab from double-fetching)
        if (response.manifests) {
          for (const [id, manifest] of Object.entries(response.manifests)) {
            updateManifest(id, manifest as ParsedManifest);
          }
        }
        // Apply cached errors from background
        if (response.errors) {
          for (const [id, error] of Object.entries(response.errors)) {
            setStreamError(id, error as string);
          }
        }
      }
    });

    // Request existing ads for this tab
    chrome.runtime.sendMessage({ type: 'GET_ADS', tabId: inspectedTabId }, (response) => {
      if (response?.ads) {
        response.ads
          .filter((ad: DetectedAd) => ad.tabId === inspectedTabId)
          .forEach((ad: DetectedAd) => addAd(ad));
      }
    });

    // Check if overlays are already enabled on page (e.g., from previous panel session)
    chrome.runtime.sendMessage({ type: 'GET_VIDEO_OVERLAY_STATUS', tabId: inspectedTabId }, (response) => {
      if (response?.enabled) {
        setVideoOverlaysEnabled(true);
      }
    });

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [addStream, updateManifest, updateAllPlaybackStates, selectStream, selectStreamByUrl, showToast, addAd, updateAdParsedContent, setAdError]);

  const handleClearAll = () => {
    const tabId = chrome.devtools.inspectedWindow.tabId;
    chrome.runtime.sendMessage({ type: 'CLEAR_TAB', tabId });
    clearAll();
    clearAds();
  };

  // Toggle video overlays on page
  const handleToggleVideoOverlays = useCallback(() => {
    const tabId = chrome.devtools.inspectedWindow.tabId;
    const newState = !videoOverlaysEnabled;

    if (newState) {
      chrome.runtime.sendMessage({ type: 'ENABLE_VIDEO_OVERLAYS', tabId }, (response) => {
        // Update state regardless - if failed, user can try again
        setVideoOverlaysEnabled(response?.success !== false);
      });
    } else {
      // When disabling, update local state immediately and send message
      setVideoOverlaysEnabled(false);
      chrome.runtime.sendMessage({ type: 'DISABLE_VIDEO_OVERLAYS', tabId });
    }
  }, [videoOverlaysEnabled]);

  // Copy selected stream URL as cURL
  const handleCopyAsCurl = useCallback(() => {
    if (selectedStream) {
      const curl = generateCurlCommand({
        url: selectedStream.info.url,
        method: 'GET',
        headers: selectedStream.info.requestHeaders,
      });
      copyToClipboard(curl);
    }
  }, [selectedStream]);

  // Command palette commands
  const commands: Command[] = [
    // Navigation
    { id: 'nav-streams', label: 'Go to Streams', category: 'navigation', icon: '📡', action: () => setCurrentTab('streams') },
    { id: 'nav-network', label: 'Go to Network', category: 'navigation', icon: '🌐', action: () => setCurrentTab('network') },
    { id: 'nav-export', label: 'Go to Export', category: 'navigation', icon: '📤', action: () => setCurrentTab('export') },
    // Actions
    { id: 'action-clear', label: 'Clear All Streams', category: 'action', icon: '🗑️', shortcut: 'Ctrl+Shift+X', action: handleClearAll },
    { id: 'action-copy-curl', label: 'Copy as cURL', category: 'action', icon: '📋', shortcut: 'Ctrl+Shift+C', action: handleCopyAsCurl },
    { id: 'action-toggle-overlays', label: videoOverlaysEnabled ? 'Hide Video Overlays' : 'Show Video Overlays', category: 'action', icon: '🎬', shortcut: 'Ctrl+Shift+O', action: handleToggleVideoOverlays },
    // Settings
    { id: 'settings-open', label: 'Open Settings', category: 'settings', icon: '⚙️', shortcut: 'Ctrl+,', action: () => setSettingsOpen(true) },
    // Help
    { id: 'help-shortcuts', label: 'Keyboard Shortcuts', category: 'help', icon: '⌨️', action: () => setSettingsOpen(true) },
  ];

  // Keyboard shortcuts
  useKeyboardShortcuts([
    { key: 'k', ctrl: true, description: 'Open Command Palette', action: () => setCommandPaletteOpen(true) },
    { key: ',', ctrl: true, description: 'Open Settings', action: () => setSettingsOpen(true) },
    { key: '1', ctrl: true, description: 'Go to Streams', action: () => setCurrentTab('streams') },
    { key: '2', ctrl: true, description: 'Go to Network', action: () => setCurrentTab('network') },
    { key: '3', ctrl: true, description: 'Go to Export', action: () => setCurrentTab('export') },
    { key: 'c', ctrl: true, shift: true, description: 'Copy as cURL', action: handleCopyAsCurl },
    { key: 'x', ctrl: true, shift: true, description: 'Clear All', action: handleClearAll },
    { key: 'o', ctrl: true, shift: true, description: 'Toggle Video Overlays', action: handleToggleVideoOverlays },
    { key: 'Escape', description: 'Close dialogs', action: () => { setCommandPaletteOpen(false); setSettingsOpen(false); } },
  ]);

  // Handle tab change
  const handleTabChange = (tab: string) => {
    setCurrentTab(tab as TabId);
    // Update store for standard tabs
    if (['streams', 'network'].includes(tab)) {
      setActiveTab(tab as 'streams' | 'network');
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <h1 className="title">PlaybackLab</h1>
          <span className="stream-count">
            {streams.length} stream{streams.length !== 1 ? 's' : ''}
            {adsCount > 0 && <> &middot; {adsCount} ad{adsCount !== 1 ? 's' : ''}</>}
          </span>
          {license?.status === 'trial_active' && (
            <span className={`trial-badge${license.trialDaysRemaining <= 2 ? ' expiring' : ''}`}>
              {license.trialDaysRemaining}d trial
            </span>
          )}
          {license?.paid && (
            <span className="trial-badge pro">PRO</span>
          )}
        </div>
        <div className="header-right">
          <button
            className={`btn btn-overlay-toggle ${videoOverlaysEnabled ? 'active' : ''}`}
            onClick={handleToggleVideoOverlays}
            title={videoOverlaysEnabled ? 'Hide video overlays on page' : 'Show video overlays on page'}
          >
            {videoOverlaysEnabled ? '🎬 Overlays ON' : '🎬 Overlays'}
          </button>
          <button
            className="btn btn-icon"
            onClick={() => setCommandPaletteOpen(true)}
            title="Command Palette (Ctrl+K)"
          >
            ⌘
          </button>
          <button
            className="btn btn-icon"
            onClick={() => setSettingsOpen(true)}
            title="Settings (Ctrl+,)"
          >
            ⚙️
          </button>
          <button className="btn btn-secondary" onClick={handleClearAll}>
            Clear All
          </button>
        </div>
      </header>

      <TabBar
        activeTab={currentTab}
        onTabChange={handleTabChange}
        tabs={[
          { id: 'streams', label: 'Streams' },
          { id: 'network', label: 'Network' },
          { id: 'export', label: 'Export' },
        ]}
      />

      <main className="main">
        {currentTab === 'streams' && <StreamsPanel />}
        {currentTab === 'network' && <NetworkInspector stream={selectedStream ?? null} />}
        {currentTab === 'export' && <ExportPanel />}
      </main>

      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        commands={commands}
      />

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      {/* Paywall Overlay - renders on top when access is denied */}
      {!licenseLoading && !hasAccess && <PaywallOverlay />}
    </div>
  );
}

/**
 * Main DevTools Panel App
 * SOLID: Single Responsibility - UI orchestration only
 */

import { useEffect, useState, useCallback } from 'react';
import { useStore, useStreamsList, useSelectedStream } from '../../store';
import { StreamsPanel } from './components/StreamsPanel';
import { TabBar } from './components/TabBar';
import { NetworkInspector } from './components/NetworkInspector';
import { ExportPanel } from './components/ExportPanel';
import { CommandPalette, type Command } from './components/CommandPalette';
import { SettingsPanel } from './components/SettingsPanel';
import { ToastProvider, useToast } from './components/Toast';
import { useKeyboardShortcuts } from '../../shared/hooks/useKeyboardShortcuts';
import { generateCurlCommand, copyToClipboard } from '../../shared/utils/copyAsCurl';
import type { StreamInfo } from '../../core/interfaces/IStreamDetector';
import type { ParsedManifest } from '../../core/interfaces/IManifestParser';

type TabId = 'streams' | 'network' | 'export';

// Overlay preference persistence
const OVERLAY_PREF_KEY = 'pbl_video_overlays_enabled';

function getOverlayPreference(): boolean {
  try {
    const stored = localStorage.getItem(OVERLAY_PREF_KEY);
    if (stored !== null) {
      return stored === 'true';
    }
  } catch {
    // Ignore localStorage errors
  }
  return true; // Default to ON
}

function setOverlayPreference(enabled: boolean): void {
  try {
    localStorage.setItem(OVERLAY_PREF_KEY, enabled ? 'true' : 'false');
  } catch {
    // Ignore localStorage errors
  }
}

// Main app wrapped with ToastProvider
export function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

function AppContent() {
  const { addStream, clearAll, activeTab, setActiveTab, updateAllPlaybackStates, updateManifest, selectStreamByUrl, selectStream } = useStore();
  const streams = useStreamsList();
  const selectedStream = useSelectedStream();
  const [currentTab, setCurrentTab] = useState<TabId>(activeTab as TabId);
  const { showToast } = useToast();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [videoOverlaysEnabled, setVideoOverlaysEnabled] = useState(getOverlayPreference);

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

    const handleMessage = (message: { type: string; payload?: StreamInfo | { tabId: number; streams: StreamInfo[] } | ManifestLoadedPayload | SelectStreamPayload }) => {
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
      } else if (message.type === 'MANIFEST_LOADED' && message.payload) {
        const { streamId, tabId, manifest } = message.payload as ManifestLoadedPayload;
        // Only update manifests from the inspected tab
        if (tabId === inspectedTabId) {
          updateManifest(streamId, manifest);
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

        // Try by stream ID first (most reliable)
        if (streamId) {
          const state = useStore.getState();
          if (state.streams.has(streamId)) {
            selectStream(streamId);
            selected = true;
          }
        }

        // Try by URL match
        if (!selected && url && !url.startsWith('blob:')) {
          selected = selectStreamByUrl(url);
        }

        // If still not selected, try to select the best candidate
        if (!selected) {
          const state = useStore.getState();
          const streamsList = Array.from(state.streams.values());

          if (streamsList.length === 0) {
            // No streams detected at all
            showToast('warning', 'No streams detected. Enable auto-detection and refresh the page.');
          } else if (streamsList.length === 1) {
            // Only one stream - select it (high confidence)
            selectStream(streamsList[0].info.id);
            selected = true;
          } else {
            // Multiple streams - select the active/playing one if exists, otherwise first
            const activeStream = streamsList.find(s => s.info.isActive || s.info.playbackState === 'playing');
            if (activeStream) {
              selectStream(activeStream.info.id);
              selected = true;
              showToast('info', 'Multiple streams detected - selected the active one. Verify selection.');
            } else {
              // No active stream, select first and inform user
              selectStream(streamsList[0].info.id);
              selected = true;
              showToast('info', 'Multiple streams detected - please verify the correct one is selected.');
            }
          }
        }

        // Switch to streams tab if we selected something
        if (selected) {
          setCurrentTab('streams');
        }
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    // Request existing streams for this tab only
    chrome.runtime.sendMessage({ type: 'GET_STREAMS', tabId: inspectedTabId }, (response) => {
      if (response?.streams) {
        // Filter to ensure only streams from this tab (redundant but safe)
        response.streams
          .filter((stream: StreamInfo) => stream.tabId === inspectedTabId)
          .forEach((stream: StreamInfo) => addStream(stream));
      }
    });

    // Check initial overlay status and auto-enable if preference is ON
    const savedPreference = getOverlayPreference();
    chrome.runtime.sendMessage({ type: 'GET_VIDEO_OVERLAY_STATUS', tabId: inspectedTabId }, (response) => {
      if (response?.enabled) {
        // Overlays already enabled on page
        setVideoOverlaysEnabled(true);
      } else if (savedPreference) {
        // Preference says ON but not currently enabled - enable them
        chrome.runtime.sendMessage({ type: 'ENABLE_VIDEO_OVERLAYS', tabId: inspectedTabId }, (enableResponse) => {
          if (enableResponse?.success) {
            setVideoOverlaysEnabled(true);
          }
        });
      }
    });

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [addStream, updateManifest, updateAllPlaybackStates, selectStream, selectStreamByUrl, showToast]);

  const handleClearAll = () => {
    const tabId = chrome.devtools.inspectedWindow.tabId;
    chrome.runtime.sendMessage({ type: 'CLEAR_TAB', tabId });
    clearAll();
  };

  // Toggle video overlays on page
  const handleToggleVideoOverlays = useCallback(() => {
    const tabId = chrome.devtools.inspectedWindow.tabId;
    const newState = !videoOverlaysEnabled;

    if (newState) {
      chrome.runtime.sendMessage({ type: 'ENABLE_VIDEO_OVERLAYS', tabId }, (response) => {
        if (response?.success) {
          setVideoOverlaysEnabled(true);
          setOverlayPreference(true);
        }
      });
    } else {
      chrome.runtime.sendMessage({ type: 'DISABLE_VIDEO_OVERLAYS', tabId }, (response) => {
        if (response?.success) {
          setVideoOverlaysEnabled(false);
          setOverlayPreference(false);
        }
      });
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
            {streams.length} stream{streams.length !== 1 ? 's' : ''} detected
          </span>
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
    </div>
  );
}

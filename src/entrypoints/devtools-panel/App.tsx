/**
 * Main DevTools Panel App
 * SOLID: Single Responsibility - UI orchestration only
 */

import { useEffect, useState, useCallback } from 'react';
import { useStore, useStreamsList, useSelectedStream } from '../../store';
import { StreamsPanel } from './components/StreamsPanel';
import { ManifestViewer } from './components/ManifestViewer';
import { TabBar } from './components/TabBar';
import { MetricsView } from './components/MetricsView';
import { NetworkInspector } from './components/NetworkInspector';
import { DrmInspector } from './components/DrmInspector';
import { ExportPanel } from './components/ExportPanel';
import { ErrorDisplay } from './components/ErrorDisplay';
import { CommandPalette, type Command } from './components/CommandPalette';
import { SettingsPanel } from './components/SettingsPanel';
import { HealthScoreCard } from './components/HealthScoreCard';
import { ToastProvider } from './components/Toast';
import { useKeyboardShortcuts } from '../../shared/hooks/useKeyboardShortcuts';
import { useSettings } from '../../shared/hooks/useSettings';
import { generateCurlCommand, copyToClipboard } from '../../shared/utils/copyAsCurl';
import type { StreamInfo } from '../../core/interfaces/IStreamDetector';

type TabId = 'streams' | 'manifest' | 'metrics' | 'drm' | 'network' | 'export' | 'errors' | 'health';

// Main app wrapped with ToastProvider
export function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

function AppContent() {
  const { addStream, clearAll, activeTab, setActiveTab, updateAllPlaybackStates } = useStore();
  const streams = useStreamsList();
  const selectedStream = useSelectedStream();
  const [currentTab, setCurrentTab] = useState<TabId>(activeTab as TabId);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { settings } = useSettings();

  // Listen for stream detection and playback state messages (scoped to current tab)
  useEffect(() => {
    const inspectedTabId = chrome.devtools.inspectedWindow.tabId;

    const handleMessage = (message: { type: string; payload?: StreamInfo | { tabId: number; streams: StreamInfo[] } }) => {
      if (message.type === 'STREAM_DETECTED' && message.payload) {
        const stream = message.payload as StreamInfo;
        // Only add streams from the inspected tab
        if (stream.tabId === inspectedTabId) {
          addStream(stream);
        }
      } else if (message.type === 'PLAYBACK_STATE_UPDATED' && message.payload) {
        const { tabId, streams: updatedStreams } = message.payload as { tabId: number; streams: StreamInfo[] };
        // Only update streams from the inspected tab
        if (tabId === inspectedTabId) {
          updateAllPlaybackStates(updatedStreams);
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

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [addStream, updateAllPlaybackStates]);

  const handleClearAll = () => {
    const tabId = chrome.devtools.inspectedWindow.tabId;
    chrome.runtime.sendMessage({ type: 'CLEAR_TAB', tabId });
    clearAll();
  };

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
    { id: 'nav-manifest', label: 'Go to Manifest', category: 'navigation', icon: '📋', action: () => setCurrentTab('manifest') },
    { id: 'nav-metrics', label: 'Go to Metrics', category: 'navigation', icon: '📊', action: () => setCurrentTab('metrics') },
    { id: 'nav-drm', label: 'Go to DRM', category: 'navigation', icon: '🔐', action: () => setCurrentTab('drm') },
    { id: 'nav-network', label: 'Go to Network', category: 'navigation', icon: '🌐', action: () => setCurrentTab('network') },
    { id: 'nav-health', label: 'Go to Health Score', category: 'navigation', icon: '💚', action: () => setCurrentTab('health') },
    { id: 'nav-errors', label: 'Go to Errors', category: 'navigation', icon: '⚠️', action: () => setCurrentTab('errors') },
    { id: 'nav-export', label: 'Go to Export', category: 'navigation', icon: '📤', action: () => setCurrentTab('export') },
    // Actions
    { id: 'action-clear', label: 'Clear All Streams', category: 'action', icon: '🗑️', shortcut: 'Ctrl+Shift+X', action: handleClearAll },
    { id: 'action-copy-curl', label: 'Copy as cURL', category: 'action', icon: '📋', shortcut: 'Ctrl+Shift+C', action: handleCopyAsCurl },
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
    { key: '2', ctrl: true, description: 'Go to Manifest', action: () => setCurrentTab('manifest') },
    { key: '3', ctrl: true, description: 'Go to Metrics', action: () => setCurrentTab('metrics') },
    { key: '4', ctrl: true, description: 'Go to Network', action: () => setCurrentTab('network') },
    { key: '5', ctrl: true, description: 'Go to Health', action: () => setCurrentTab('health') },
    { key: 'c', ctrl: true, shift: true, description: 'Copy as cURL', action: handleCopyAsCurl },
    { key: 'x', ctrl: true, shift: true, description: 'Clear All', action: handleClearAll },
    { key: 'Escape', description: 'Close dialogs', action: () => { setCommandPaletteOpen(false); setSettingsOpen(false); } },
  ]);

  // Handle tab change
  const handleTabChange = (tab: string) => {
    setCurrentTab(tab as TabId);
    // Update store for standard tabs
    if (['streams', 'manifest', 'metrics', 'drm', 'network'].includes(tab)) {
      setActiveTab(tab as 'streams' | 'manifest' | 'metrics' | 'drm' | 'network');
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
          { id: 'manifest', label: 'Manifest' },
          { id: 'metrics', label: 'Metrics' },
          { id: 'health', label: 'Health' },
          { id: 'drm', label: 'DRM' },
          { id: 'network', label: 'Network' },
          { id: 'errors', label: 'Errors' },
          { id: 'export', label: 'Export' },
        ]}
      />

      <main className="main">
        {currentTab === 'streams' && <StreamsPanel />}
        {currentTab === 'manifest' && <ManifestViewer stream={selectedStream ?? null} />}
        {currentTab === 'metrics' && <MetricsView stream={selectedStream ?? null} />}
        {currentTab === 'drm' && <DrmInspector stream={selectedStream ?? null} />}
        {currentTab === 'network' && <NetworkInspector stream={selectedStream ?? null} />}
        {currentTab === 'health' && <HealthScoreCard stream={selectedStream ?? null} />}
        {currentTab === 'errors' && (
          <ErrorDisplay error={selectedStream?.error} showSearch={true} />
        )}
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

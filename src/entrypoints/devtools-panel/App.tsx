/**
 * Main DevTools Panel App
 * SOLID: Single Responsibility - UI orchestration only
 */

import { useEffect } from 'react';
import { useStore, useStreamsList, useSelectedStream } from '../../store';
import { StreamList } from './components/StreamList';
import { ManifestViewer } from './components/ManifestViewer';
import { TabBar } from './components/TabBar';
import type { StreamInfo } from '../../core/interfaces/IStreamDetector';

export function App() {
  const { addStream, clearAll, activeTab, setActiveTab } = useStore();
  const streams = useStreamsList();
  const selectedStream = useSelectedStream();

  // Listen for stream detection messages
  useEffect(() => {
    const handleMessage = (message: { type: string; payload?: StreamInfo }) => {
      if (message.type === 'STREAM_DETECTED' && message.payload) {
        addStream(message.payload);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    // Request existing streams for this tab
    const tabId = chrome.devtools.inspectedWindow.tabId;
    chrome.runtime.sendMessage({ type: 'GET_STREAMS', tabId }, (response) => {
      if (response?.streams) {
        response.streams.forEach((stream: StreamInfo) => addStream(stream));
      }
    });

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [addStream]);

  const handleClearAll = () => {
    const tabId = chrome.devtools.inspectedWindow.tabId;
    chrome.runtime.sendMessage({ type: 'CLEAR_TAB', tabId });
    clearAll();
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
          <button className="btn btn-secondary" onClick={handleClearAll}>
            Clear All
          </button>
        </div>
      </header>

      <TabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabs={[
          { id: 'streams', label: 'Streams' },
          { id: 'manifest', label: 'Manifest' },
          { id: 'metrics', label: 'Metrics' },
          { id: 'drm', label: 'DRM' },
          { id: 'network', label: 'Network' },
        ]}
      />

      <main className="main">
        {activeTab === 'streams' && <StreamList />}
        {activeTab === 'manifest' && <ManifestViewer stream={selectedStream ?? null} />}
        {activeTab === 'metrics' && (
          <div className="placeholder">Metrics visualization coming in v1.1</div>
        )}
        {activeTab === 'drm' && (
          <div className="placeholder">DRM inspection coming in v1.1</div>
        )}
        {activeTab === 'network' && (
          <div className="placeholder">Network inspector coming in v1.1</div>
        )}
      </main>
    </div>
  );
}

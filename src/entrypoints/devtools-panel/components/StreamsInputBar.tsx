/**
 * StreamsInputBar Component
 * Combined URL input, scan button, and auto-detect toggle
 */

import { useState, useEffect } from 'react';
import { useStore } from '../../../store';
import { useToast } from './Toast';
import { hlsParser } from '../../../core/services/HlsManifestParser';
import { dashParser } from '../../../core/services/DashManifestParser';
import type { StreamInfo } from '../../../core/interfaces/IStreamDetector';
import { safeUpperCase } from '../../../shared/utils/stringUtils';

export function StreamsInputBar() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [autoDetectEnabled, setAutoDetectEnabled] = useState(true); // Default to enabled
  const [filterAds, setFilterAds] = useState(true);
  const [hasInitialized, setHasInitialized] = useState(false);
  const { addStream, selectStream, updateManifest, setStreamLoading, setStreamError, setActiveTab } = useStore();
  const { showToast } = useToast();

  // Initialize auto-detection on mount
  useEffect(() => {
    const tabId = chrome.devtools.inspectedWindow.tabId;

    // Enable auto-detection by default on the background
    chrome.runtime.sendMessage(
      { type: 'ENABLE_AUTO_DETECTION', tabId },
      () => {
        setAutoDetectEnabled(true);
        setHasInitialized(true);
      }
    );

    // Get filter ads setting
    chrome.runtime.sendMessage(
      { type: 'GET_FILTER_ADS_STATUS', tabId },
      (response) => {
        if (response?.filterAds !== undefined) {
          setFilterAds(response.filterAds);
        }
      }
    );
  }, []);

  // Auto-scan when initialized
  useEffect(() => {
    if (hasInitialized && autoDetectEnabled) {
      // Small delay to let auto-detection settle
      const timer = setTimeout(() => {
        triggerAutoScan();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [hasInitialized]);

  // Auto-scan function (simplified version of handleScan)
  const triggerAutoScan = async () => {
    const tabId = chrome.devtools.inspectedWindow.tabId;
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: 'SCAN_FOR_STREAMS', filterAds });
      const scannedStreams = response?.streams || [];

      if (scannedStreams.length > 0) {
        for (const scanned of scannedStreams) {
          const streamId = `auto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const stream: StreamInfo = {
            id: streamId,
            url: scanned.url,
            type: scanned.type,
            detectedAt: Date.now(),
            tabId,
            frameId: 0,
            initiator: `auto:${scanned.source}`,
            isActive: true,
            isMaster: true,
          };

          addStream(stream);

          // Auto-select the first one
          if (scannedStreams.indexOf(scanned) === 0) {
            selectStream(streamId);
          }

          // Try to fetch and parse manifest
          setStreamLoading(streamId, true);
          try {
            const manifestResponse = await chrome.runtime.sendMessage({
              type: 'FETCH_MANIFEST',
              payload: { url: scanned.url },
            });

            if (manifestResponse.success) {
              const content = manifestResponse.content;
              let parsed;
              if (scanned.type === 'hls' || content.includes('#EXTM3U')) {
                parsed = await hlsParser.parse(content, scanned.url);
              } else if (scanned.type === 'dash' || content.includes('<MPD')) {
                parsed = await dashParser.parse(content, scanned.url);
              }
              if (parsed) {
                updateManifest(streamId, parsed);
              }
            }
          } catch {
            // Manifest fetch failed, but stream is still listed
          }
        }
      }
    } catch {
      // Auto-scan failed silently
    }
  };

  // Toggle auto-detection
  const toggleAutoDetection = () => {
    const tabId = chrome.devtools.inspectedWindow.tabId;
    const newState = !autoDetectEnabled;

    chrome.runtime.sendMessage(
      { type: newState ? 'ENABLE_AUTO_DETECTION' : 'DISABLE_AUTO_DETECTION', tabId },
      () => {
        setAutoDetectEnabled(newState);
        if (newState) {
          showToast('info', 'Auto-detection enabled. Refresh the page to detect streams.');
        } else {
          showToast('info', 'Auto-detection disabled');
        }
      }
    );
  };

  // Toggle filter ads
  const toggleFilterAds = () => {
    const tabId = chrome.devtools.inspectedWindow.tabId;
    const newState = !filterAds;

    chrome.runtime.sendMessage(
      { type: 'SET_FILTER_ADS', tabId, filterAds: newState },
      () => {
        setFilterAds(newState);
      }
    );
  };

  // Scan page for streams
  const handleScan = async () => {
    setIsScanning(true);
    const tabId = chrome.devtools.inspectedWindow.tabId;

    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: 'SCAN_FOR_STREAMS', filterAds });
      const scannedStreams = response?.streams || [];

      if (scannedStreams.length === 0) {
        showToast('warning', 'No streams found on this page');
        setIsScanning(false);
        return;
      }

      showToast('success', `Found ${scannedStreams.length} stream${scannedStreams.length !== 1 ? 's' : ''}`);

      // Add each found stream
      for (const scanned of scannedStreams) {
        const streamId = `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const stream: StreamInfo = {
          id: streamId,
          url: scanned.url,
          type: scanned.type,
          detectedAt: Date.now(),
          tabId,
          frameId: 0,
          initiator: `scan:${scanned.source}`,
          isActive: true,
          isMaster: true,
        };

        addStream(stream);

        // Auto-select the first one
        if (scannedStreams.indexOf(scanned) === 0) {
          selectStream(streamId);
        }

        // Try to fetch and parse manifest
        setStreamLoading(streamId, true);
        try {
          const manifestResponse = await chrome.runtime.sendMessage({
            type: 'FETCH_MANIFEST',
            payload: { url: scanned.url },
          });

          if (manifestResponse.success) {
            const content = manifestResponse.content;
            let parsed;
            if (scanned.type === 'hls' || content.includes('#EXTM3U')) {
              parsed = await hlsParser.parse(content, scanned.url);
            } else if (scanned.type === 'dash' || content.includes('<MPD')) {
              parsed = await dashParser.parse(content, scanned.url);
            }
            if (parsed) {
              updateManifest(streamId, parsed);
            }
          }
        } catch {
          // Manifest fetch failed, but stream is still listed
        }
      }
    } catch (error) {
      showToast('error', 'Failed to scan page. Try refreshing.');
    } finally {
      setIsScanning(false);
    }
  };

  const detectStreamType = (url: string): 'hls' | 'dash' | 'mse' | 'unknown' => {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('.m3u8')) return 'hls';
    if (lowerUrl.includes('.mpd')) return 'dash';
    // YouTube/MSE detection
    if (lowerUrl.includes('googlevideo.com')) return 'mse';
    if (lowerUrl.includes('vimeocdn.com') || lowerUrl.includes('akamaized.net')) return 'mse';
    return 'unknown';
  };

  const handleLoad = async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      showToast('warning', 'Please enter a stream URL');
      return;
    }

    // Validate URL
    try {
      new URL(trimmedUrl);
    } catch {
      showToast('error', 'Invalid URL format');
      return;
    }

    setIsLoading(true);

    const streamType = detectStreamType(trimmedUrl);
    const streamId = `manual-${Date.now()}`;

    // Create stream info
    const stream: StreamInfo = {
      id: streamId,
      url: trimmedUrl,
      type: streamType,
      detectedAt: Date.now(),
      tabId: chrome.devtools.inspectedWindow.tabId,
      frameId: 0,
      initiator: 'manual',
      isActive: true,
      isMaster: true,
    };

    // Add to store immediately
    addStream(stream);
    selectStream(streamId);
    setStreamLoading(streamId, true);

    try {
      // Fetch manifest content
      const response = await chrome.runtime.sendMessage({
        type: 'FETCH_MANIFEST',
        payload: { url: trimmedUrl },
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch manifest');
      }

      const content = response.content;

      // Parse based on type
      let parsed;
      if (streamType === 'hls' || content.includes('#EXTM3U')) {
        parsed = await hlsParser.parse(content, trimmedUrl);
      } else if (streamType === 'dash' || content.includes('<MPD')) {
        parsed = await dashParser.parse(content, trimmedUrl);
      } else {
        throw new Error('Unable to detect stream type from content');
      }

      // Update store with parsed manifest
      updateManifest(streamId, parsed);
      showToast('success', `Loaded ${safeUpperCase(parsed.type)} manifest`);

      // Switch to streams tab
      setActiveTab('streams');
      setUrl('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load manifest';
      setStreamError(streamId, message);
      showToast('error', message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleLoad();
    }
  };

  return (
    <div className="stream-input-bar">
      {/* Row 1: URL Input */}
      <div className="input-row">
        <input
          type="text"
          className="url-field"
          placeholder="Enter HLS or DASH stream URL..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading || isScanning}
        />
      </div>

      {/* Row 2: Action Buttons */}
      <div className="input-row input-actions">
        <button
          className="btn btn-primary"
          onClick={handleLoad}
          disabled={isLoading || isScanning || !url.trim()}
        >
          {isLoading ? 'Loading...' : 'Load'}
        </button>

        <button
          className="btn btn-scan"
          onClick={handleScan}
          disabled={isLoading || isScanning}
          title="Scan this page for stream URLs"
        >
          {isScanning ? (
            <>
              <span className="scan-spinner"></span>
              Scanning...
            </>
          ) : (
            <>
              <span className="scan-icon">🔍</span>
              Scan Page
            </>
          )}
        </button>
      </div>

      {/* Row 3: Toggle Options */}
      <div className="input-row input-toggles">
        <label
          className={`toggle-option ${autoDetectEnabled ? 'active' : ''}`}
          title="Automatically detect streams from network requests (requires page refresh)"
        >
          <input
            type="checkbox"
            checked={autoDetectEnabled}
            onChange={toggleAutoDetection}
          />
          <span className="toggle-check"></span>
          <span className="toggle-label">Auto-detect</span>
        </label>

        <label
          className={`toggle-option ${filterAds ? 'active' : ''}`}
          title="Filter out ad-related streams (Google Ads, IMA SDK, etc.)"
        >
          <input
            type="checkbox"
            checked={filterAds}
            onChange={toggleFilterAds}
          />
          <span className="toggle-check"></span>
          <span className="toggle-label">Filter Ads</span>
        </label>
      </div>
    </div>
  );
}

/**
 * StreamPicker Component
 * Visual picker to select video elements on the page
 */

import { useState } from 'react';
import { useStore } from '../../../store';
import { useToast } from './Toast';
import type { StreamInfo } from '../../../core/interfaces/IStreamDetector';

interface Props {
  onStreamPicked?: (stream: StreamInfo) => void;
}

export function StreamPicker({ onStreamPicked }: Props) {
  const [isPicking, setIsPicking] = useState(false);
  const [videoCount, setVideoCount] = useState<number | null>(null);
  const { addStream, selectStream } = useStore();
  const { showToast } = useToast();

  const startPicking = async () => {
    setIsPicking(true);
    const tabId = chrome.devtools.inspectedWindow.tabId;

    try {
      // First, check how many videos are on the page
      const countResponse = await chrome.tabs.sendMessage(tabId, { type: 'COUNT_VIDEOS' });
      const count = countResponse?.count || 0;
      setVideoCount(count);

      if (count === 0) {
        showToast('warning', 'No video elements found on this page');
        setIsPicking(false);
        return;
      }

      showToast('info', `Found ${count} video${count !== 1 ? 's' : ''}. Click on one to select it.`);

      // Inject the picker overlay
      await chrome.tabs.sendMessage(tabId, { type: 'START_PICKER' });

      // Listen for picker results
      const handlePickerResult = (message: any) => {
        if (message.type === 'PICKER_RESULT') {
          chrome.runtime.onMessage.removeListener(handlePickerResult);
          handleStreamPicked(message.payload);
        } else if (message.type === 'PICKER_CANCELLED') {
          chrome.runtime.onMessage.removeListener(handlePickerResult);
          setIsPicking(false);
          setVideoCount(null);
        }
      };

      chrome.runtime.onMessage.addListener(handlePickerResult);

    } catch (error) {
      console.error('Picker error:', error);
      showToast('error', 'Failed to start picker. Make sure the page is loaded.');
      setIsPicking(false);
      setVideoCount(null);
    }
  };

  const cancelPicking = async () => {
    const tabId = chrome.devtools.inspectedWindow.tabId;
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'CANCEL_PICKER' });
    } catch {
      // Ignore errors
    }
    setIsPicking(false);
    setVideoCount(null);
  };

  const handleStreamPicked = (payload: {
    url: string;
    type: 'hls' | 'dash' | 'unknown';
    sources: string[];
    videoIndex: number;
    resolution: string;
    duration: number;
  }) => {
    setIsPicking(false);
    setVideoCount(null);

    if (!payload.url && payload.sources.length === 0) {
      showToast('warning', 'Could not extract stream URL from this video');
      return;
    }

    // Use the best available URL
    const streamUrl = payload.url || payload.sources[0];

    if (!streamUrl) {
      showToast('warning', 'No stream URL found for this video');
      return;
    }

    // Detect stream type from URL
    let streamType: 'hls' | 'dash' | 'unknown' = payload.type;
    if (streamType === 'unknown') {
      const lowerUrl = streamUrl.toLowerCase();
      if (lowerUrl.includes('.m3u8')) streamType = 'hls';
      else if (lowerUrl.includes('.mpd')) streamType = 'dash';
    }

    // Create stream info
    const stream: StreamInfo = {
      id: `picked-${Date.now()}`,
      url: streamUrl,
      type: streamType,
      detectedAt: Date.now(),
      tabId: chrome.devtools.inspectedWindow.tabId,
      frameId: 0,
      initiator: 'picker',
      isActive: true,
      isMaster: true,
    };

    addStream(stream);
    selectStream(stream.id);

    const resInfo = payload.resolution !== '0x0' ? ` (${payload.resolution})` : '';
    showToast('success', `Stream picked${resInfo}`);

    onStreamPicked?.(stream);
  };

  return (
    <div className="stream-picker">
      {!isPicking ? (
        <button className="btn btn-picker" onClick={startPicking}>
          <span className="picker-icon">🎯</span>
          <span className="picker-text">Pick from Page</span>
        </button>
      ) : (
        <div className="picker-active">
          <div className="picker-status">
            <span className="picker-pulse"></span>
            <span>Click on a video ({videoCount} found)</span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={cancelPicking}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

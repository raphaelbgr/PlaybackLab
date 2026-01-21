/**
 * UrlInput Component - Postman-style URL entry with params editing
 * SOLID: Single Responsibility - URL input, fetching, and parsing
 */

import { useState, useCallback } from 'react';
import { useStore } from '../../../store';
import { hlsParser } from '../../../core/services/HlsManifestParser';
import { dashParser } from '../../../core/services/DashManifestParser';
import { useToast } from './Toast';
import type { StreamInfo } from '../../../core/interfaces/IStreamDetector';

interface UrlParam {
  key: string;
  value: string;
  enabled: boolean;
}

interface Props {
  onStreamLoaded?: () => void;
}

export function UrlInput({ onStreamLoaded }: Props) {
  const { addStream, updateManifest, setStreamLoading, setStreamError, selectStream, setActiveTab } = useStore();
  const { showToast } = useToast();
  const [url, setUrl] = useState('');
  const [params, setParams] = useState<UrlParam[]>([]);
  const [headers, setHeaders] = useState<UrlParam[]>([
    { key: 'User-Agent', value: 'PlaybackLab/1.0', enabled: true },
  ]);
  const [activeTab, setActiveTabLocal] = useState<'params' | 'headers'>('params');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parse params from URL
  const parseParamsFromUrl = useCallback((urlStr: string) => {
    try {
      const urlObj = new URL(urlStr);
      const newParams: UrlParam[] = [];
      urlObj.searchParams.forEach((value, key) => {
        newParams.push({ key, value, enabled: true });
      });
      setParams(newParams);
      setError(null);
    } catch {
      // Invalid URL, keep existing params
    }
  }, []);

  // Build URL from params
  const buildUrlFromParams = useCallback(() => {
    try {
      const urlObj = new URL(url.split('?')[0]);
      params.forEach((param) => {
        if (param.enabled && param.key) {
          urlObj.searchParams.set(param.key, param.value);
        }
      });
      return urlObj.href;
    } catch {
      return url;
    }
  }, [url, params]);

  // Handle URL change
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setUrl(newUrl);
    parseParamsFromUrl(newUrl);
  };

  // Handle param change
  const handleParamChange = (index: number, field: keyof UrlParam, value: string | boolean) => {
    const newParams = [...params];
    newParams[index] = { ...newParams[index], [field]: value };
    setParams(newParams);

    // Update URL
    try {
      const baseUrl = url.split('?')[0];
      const urlObj = new URL(baseUrl);
      newParams.forEach((param) => {
        if (param.enabled && param.key) {
          urlObj.searchParams.set(param.key, param.value);
        }
      });
      setUrl(urlObj.href);
    } catch {
      // Invalid URL
    }
  };

  // Add new param
  const addParam = () => {
    setParams([...params, { key: '', value: '', enabled: true }]);
  };

  // Remove param
  const removeParam = (index: number) => {
    const newParams = params.filter((_, i) => i !== index);
    setParams(newParams);
  };

  // Detect stream type
  const detectStreamType = (urlStr: string): 'hls' | 'dash' | 'unknown' => {
    const lower = urlStr.toLowerCase();
    if (lower.includes('.m3u8')) return 'hls';
    if (lower.includes('.mpd')) return 'dash';
    return 'unknown';
  };

  // Handle load stream - ACTUALLY FETCHES AND PARSES THE MANIFEST
  const handleLoadStream = async () => {
    const finalUrl = buildUrlFromParams();

    try {
      new URL(finalUrl);
    } catch {
      setError('Invalid URL format');
      showToast('error', 'Invalid URL format');
      return;
    }

    const streamType = detectStreamType(finalUrl);
    if (streamType === 'unknown') {
      setError('URL must be an HLS (.m3u8) or DASH (.mpd) stream');
      showToast('error', 'URL must end with .m3u8 (HLS) or .mpd (DASH)');
      return;
    }

    setIsLoading(true);
    setError(null);

    // Create stream ID
    const streamId = `manual-${Date.now()}`;

    try {
      // Get custom headers
      const customHeaders: Record<string, string> = {};
      headers.forEach((h) => {
        if (h.enabled && h.key) {
          customHeaders[h.key] = h.value;
        }
      });

      // Create stream info and add to store
      const stream: StreamInfo = {
        id: streamId,
        url: finalUrl,
        type: streamType,
        detectedAt: Date.now(),
        tabId: chrome.devtools.inspectedWindow.tabId,
        frameId: 0,
        initiator: 'manual',
        requestHeaders: customHeaders,
      };

      addStream(stream);
      setStreamLoading(streamId, true);
      selectStream(streamId);

      showToast('info', 'Fetching manifest...');

      // ACTUALLY FETCH THE MANIFEST
      const response = await fetch(finalUrl, {
        headers: customHeaders,
        mode: 'cors',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const content = await response.text();

      if (!content || content.trim().length === 0) {
        throw new Error('Empty manifest received');
      }

      // Parse the manifest based on type
      let parsedManifest;
      if (streamType === 'hls') {
        if (!content.includes('#EXTM3U')) {
          throw new Error('Invalid HLS manifest - missing #EXTM3U header');
        }
        parsedManifest = await hlsParser.parse(content, finalUrl);
      } else {
        if (!content.includes('<MPD')) {
          throw new Error('Invalid DASH manifest - missing MPD element');
        }
        parsedManifest = await dashParser.parse(content, finalUrl);
      }

      // Update store with parsed manifest
      updateManifest(streamId, parsedManifest);

      // Success feedback
      const variantCount = parsedManifest.videoVariants?.length || 0;
      const audioCount = parsedManifest.audioVariants?.length || 0;
      showToast('success', `Loaded: ${variantCount} video, ${audioCount} audio tracks`);

      // Switch to Streams tab to show results
      setActiveTab('streams');

      // Clear input
      setUrl('');
      setParams([]);
      setError(null);

      // Callback
      onStreamLoaded?.();

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load stream';
      setStreamError(streamId, errorMsg);
      setError(errorMsg);
      showToast('error', errorMsg);
      console.error('Stream load error:', err);
    } finally {
      setIsLoading(false);
      setStreamLoading(streamId, false);
    }
  };

  // Quick load example streams
  const exampleStreams = [
    { name: 'Bitmovin HLS', url: 'https://cdn.bitmovin.com/content/assets/art-of-motion-dash-hls-progressive/m3u8s/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8' },
    { name: 'Apple HLS', url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8' },
    { name: 'DASH (Bitmovin)', url: 'https://cdn.bitmovin.com/content/assets/art-of-motion-dash-hls-progressive/mpds/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.mpd' },
  ];

  return (
    <div className="url-input">
      <div className="url-bar">
        <input
          type="url"
          className="url-field"
          placeholder="Enter stream URL (e.g., https://example.com/stream.m3u8)"
          value={url}
          onChange={handleUrlChange}
          onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleLoadStream()}
        />
        <button
          className="btn btn-primary"
          onClick={handleLoadStream}
          disabled={isLoading || !url}
        >
          {isLoading ? 'Loading...' : 'Load'}
        </button>
      </div>

      {/* Quick examples */}
      <div className="url-examples">
        <span className="examples-label">Try:</span>
        {exampleStreams.map((example) => (
          <button
            key={example.name}
            className="example-btn"
            onClick={() => {
              setUrl(example.url);
              parseParamsFromUrl(example.url);
            }}
          >
            {example.name}
          </button>
        ))}
      </div>

      {error && <div className="url-error">{error}</div>}

      <div className="url-tabs">
        <button
          className={`url-tab ${activeTab === 'params' ? 'active' : ''}`}
          onClick={() => setActiveTabLocal('params')}
        >
          Params ({params.length})
        </button>
        <button
          className={`url-tab ${activeTab === 'headers' ? 'active' : ''}`}
          onClick={() => setActiveTabLocal('headers')}
        >
          Headers ({headers.filter((h) => h.enabled).length})
        </button>
      </div>

      {activeTab === 'params' && (
        <div className="params-section">
          {params.length === 0 ? (
            <div className="params-empty">No query parameters</div>
          ) : (
            <table className="params-table">
              <tbody>
                {params.map((param, index) => (
                  <tr key={index}>
                    <td className="param-checkbox">
                      <input
                        type="checkbox"
                        checked={param.enabled}
                        onChange={(e) => handleParamChange(index, 'enabled', e.target.checked)}
                      />
                    </td>
                    <td className="param-key">
                      <input
                        type="text"
                        value={param.key}
                        onChange={(e) => handleParamChange(index, 'key', e.target.value)}
                        placeholder="Key"
                      />
                    </td>
                    <td className="param-value">
                      <input
                        type="text"
                        value={param.value}
                        onChange={(e) => handleParamChange(index, 'value', e.target.value)}
                        placeholder="Value"
                      />
                    </td>
                    <td className="param-actions">
                      <button className="btn-icon" onClick={() => removeParam(index)}>
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <button className="btn btn-secondary btn-sm" onClick={addParam}>
            + Add Parameter
          </button>
        </div>
      )}

      {activeTab === 'headers' && (
        <div className="params-section">
          <table className="params-table">
            <tbody>
              {headers.map((header, index) => (
                <tr key={index}>
                  <td className="param-checkbox">
                    <input
                      type="checkbox"
                      checked={header.enabled}
                      onChange={(e) => {
                        const newHeaders = [...headers];
                        newHeaders[index] = { ...newHeaders[index], enabled: e.target.checked };
                        setHeaders(newHeaders);
                      }}
                    />
                  </td>
                  <td className="param-key">
                    <input
                      type="text"
                      value={header.key}
                      onChange={(e) => {
                        const newHeaders = [...headers];
                        newHeaders[index] = { ...newHeaders[index], key: e.target.value };
                        setHeaders(newHeaders);
                      }}
                      placeholder="Header name"
                    />
                  </td>
                  <td className="param-value">
                    <input
                      type="text"
                      value={header.value}
                      onChange={(e) => {
                        const newHeaders = [...headers];
                        newHeaders[index] = { ...newHeaders[index], value: e.target.value };
                        setHeaders(newHeaders);
                      }}
                      placeholder="Value"
                    />
                  </td>
                  <td className="param-actions">
                    <button
                      className="btn-icon"
                      onClick={() => setHeaders(headers.filter((_, i) => i !== index))}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setHeaders([...headers, { key: '', value: '', enabled: true }])}
          >
            + Add Header
          </button>
        </div>
      )}
    </div>
  );
}

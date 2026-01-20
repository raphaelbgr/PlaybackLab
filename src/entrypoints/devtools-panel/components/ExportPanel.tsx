/**
 * ExportPanel Component - Export debug session data
 * SOLID: Single Responsibility - Export functionality only
 */

import { useState } from 'react';
import { useStore, useStreamsList, useSelectedStream } from '../../../store';
import { safeUpperCase, typeToClassName } from '../../../shared/utils/stringUtils';

interface ExportOptions {
  includeManifest: boolean;
  includeMetrics: boolean;
  includeNetwork: boolean;
  includeDrm: boolean;
  format: 'json' | 'har' | 'csv';
}

export function ExportPanel() {
  const streams = useStreamsList();
  const selectedStream = useSelectedStream();
  const [options, setOptions] = useState<ExportOptions>({
    includeManifest: true,
    includeMetrics: true,
    includeNetwork: true,
    includeDrm: true,
    format: 'json',
  });
  const [isExporting, setIsExporting] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Generate export data
  const generateExportData = () => {
    const exportData: Record<string, unknown> = {
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      tool: 'PlaybackLab',
    };

    // Add selected stream or all streams
    if (selectedStream) {
      exportData.stream = {
        url: selectedStream.info.url,
        type: selectedStream.info.type,
        detectedAt: new Date(selectedStream.info.detectedAt).toISOString(),
      };

      if (options.includeManifest && selectedStream.manifest) {
        exportData.manifest = {
          type: selectedStream.manifest.type,
          duration: selectedStream.manifest.duration,
          videoVariants: selectedStream.manifest.videoVariants.map((v) => ({
            resolution: v.width && v.height ? `${v.width}x${v.height}` : null,
            bandwidth: v.bandwidth,
            codecs: v.codecs,
          })),
          audioVariants: selectedStream.manifest.audioVariants.map((a) => ({
            language: a.language,
            name: a.name,
            codecs: a.codecs,
          })),
          drm: selectedStream.manifest.drm,
          segmentCount: selectedStream.manifest.segments.length,
        };
      }

      if (options.includeMetrics && selectedStream.metrics.length > 0) {
        exportData.metrics = {
          samples: selectedStream.metrics.length,
          data: selectedStream.metrics.slice(-100), // Last 100 samples
        };
      }
    } else {
      exportData.streams = streams.map((s) => ({
        url: s.info.url,
        type: s.info.type,
        detectedAt: new Date(s.info.detectedAt).toISOString(),
        hasManifest: !!s.manifest,
        metricsCount: s.metrics.length,
      }));
    }

    return exportData;
  };

  // Generate HAR format
  const generateHarData = () => {
    const har = {
      log: {
        version: '1.2',
        creator: {
          name: 'PlaybackLab',
          version: '1.0.0',
        },
        entries: [] as unknown[],
      },
    };

    // Add manifest requests
    streams.forEach((stream) => {
      har.log.entries.push({
        startedDateTime: new Date(stream.info.detectedAt).toISOString(),
        time: 0,
        request: {
          method: 'GET',
          url: stream.info.url,
          httpVersion: 'HTTP/1.1',
          cookies: [],
          headers: [],
          queryString: [],
          headersSize: -1,
          bodySize: 0,
        },
        response: {
          status: 200,
          statusText: 'OK',
          httpVersion: 'HTTP/1.1',
          cookies: [],
          headers: [],
          content: {
            size: stream.manifest?.raw?.length || 0,
            mimeType: stream.info.type === 'hls' ? 'application/vnd.apple.mpegurl' : 'application/dash+xml',
            text: stream.manifest?.raw || '',
          },
          redirectURL: '',
          headersSize: -1,
          bodySize: stream.manifest?.raw?.length || 0,
        },
        cache: {},
        timings: {
          send: 0,
          wait: 0,
          receive: 0,
        },
      });
    });

    return har;
  };

  // Generate CSV format
  const generateCsvData = () => {
    const rows: string[] = [];

    // Header
    rows.push('Type,URL,Detected At,Has Manifest,Video Variants,Audio Tracks');

    // Data rows
    streams.forEach((stream) => {
      const row = [
        safeUpperCase(stream.info.type),
        `"${stream.info.url}"`,
        new Date(stream.info.detectedAt).toISOString(),
        stream.manifest ? 'Yes' : 'No',
        stream.manifest?.videoVariants.length || 0,
        stream.manifest?.audioVariants.length || 0,
      ];
      rows.push(row.join(','));
    });

    return rows.join('\n');
  };

  // Handle export
  const handleExport = () => {
    setIsExporting(true);

    let data: string;
    let filename: string;
    let mimeType: string;

    switch (options.format) {
      case 'har':
        data = JSON.stringify(generateHarData(), null, 2);
        filename = `playbacklab-export-${Date.now()}.har`;
        mimeType = 'application/json';
        break;
      case 'csv':
        data = generateCsvData();
        filename = `playbacklab-export-${Date.now()}.csv`;
        mimeType = 'text/csv';
        break;
      default:
        data = JSON.stringify(generateExportData(), null, 2);
        filename = `playbacklab-export-${Date.now()}.json`;
        mimeType = 'application/json';
    }

    // Create and download file
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setIsExporting(false);
  };

  // Handle copy to clipboard
  const handleCopy = async () => {
    const data = JSON.stringify(generateExportData(), null, 2);
    await navigator.clipboard.writeText(data);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // Generate shareable URL
  const handleShare = () => {
    const data = generateExportData();
    const compressed = btoa(JSON.stringify(data));
    const shareUrl = `${window.location.origin}?debug=${compressed.slice(0, 100)}...`;

    // Copy to clipboard
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    alert('Debug data copied to clipboard!\n\nShare this with your team for debugging.');
  };

  return (
    <div className="export-panel">
      <div className="export-header">
        <h2>Export Debug Session</h2>
      </div>

      {/* Export Target */}
      <div className="export-section">
        <h3>Export Target</h3>
        <div className="export-target">
          {selectedStream ? (
            <div className="target-info">
              <span className={`stream-type ${typeToClassName(selectedStream.info.type)}`}>
                {safeUpperCase(selectedStream.info.type)}
              </span>
              <span className="target-url">
                {new URL(selectedStream.info.url).pathname.split('/').slice(-2).join('/')}
              </span>
            </div>
          ) : (
            <div className="target-info">
              <span className="target-all">All Streams ({streams.length})</span>
            </div>
          )}
        </div>
      </div>

      {/* Export Options */}
      <div className="export-section">
        <h3>Include Data</h3>
        <div className="export-options">
          <label className="export-option">
            <input
              type="checkbox"
              checked={options.includeManifest}
              onChange={(e) => setOptions({ ...options, includeManifest: e.target.checked })}
            />
            <span>Manifest Details</span>
            <span className="option-desc">Video/audio variants, segments, DRM info</span>
          </label>
          <label className="export-option">
            <input
              type="checkbox"
              checked={options.includeMetrics}
              onChange={(e) => setOptions({ ...options, includeMetrics: e.target.checked })}
            />
            <span>Playback Metrics</span>
            <span className="option-desc">Buffer levels, bitrate, dropped frames</span>
          </label>
          <label className="export-option">
            <input
              type="checkbox"
              checked={options.includeNetwork}
              onChange={(e) => setOptions({ ...options, includeNetwork: e.target.checked })}
            />
            <span>Network Requests</span>
            <span className="option-desc">Segment requests, timing, errors</span>
          </label>
          <label className="export-option">
            <input
              type="checkbox"
              checked={options.includeDrm}
              onChange={(e) => setOptions({ ...options, includeDrm: e.target.checked })}
            />
            <span>DRM Information</span>
            <span className="option-desc">Sessions, license requests, key IDs</span>
          </label>
        </div>
      </div>

      {/* Export Format */}
      <div className="export-section">
        <h3>Format</h3>
        <div className="format-options">
          <label className={`format-option ${options.format === 'json' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="format"
              value="json"
              checked={options.format === 'json'}
              onChange={() => setOptions({ ...options, format: 'json' })}
            />
            <div className="format-info">
              <span className="format-name">JSON</span>
              <span className="format-desc">Full debug data, easy to parse</span>
            </div>
          </label>
          <label className={`format-option ${options.format === 'har' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="format"
              value="har"
              checked={options.format === 'har'}
              onChange={() => setOptions({ ...options, format: 'har' })}
            />
            <div className="format-info">
              <span className="format-name">HAR</span>
              <span className="format-desc">HTTP Archive format, import in DevTools</span>
            </div>
          </label>
          <label className={`format-option ${options.format === 'csv' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="format"
              value="csv"
              checked={options.format === 'csv'}
              onChange={() => setOptions({ ...options, format: 'csv' })}
            />
            <div className="format-info">
              <span className="format-name">CSV</span>
              <span className="format-desc">Spreadsheet format, basic stream list</span>
            </div>
          </label>
        </div>
      </div>

      {/* Export Actions */}
      <div className="export-actions">
        <button
          className="btn btn-primary btn-lg"
          onClick={handleExport}
          disabled={isExporting || streams.length === 0}
        >
          {isExporting ? 'Exporting...' : 'Download Export'}
        </button>
        <button
          className="btn btn-secondary"
          onClick={handleCopy}
          disabled={streams.length === 0}
        >
          {copySuccess ? 'Copied!' : 'Copy to Clipboard'}
        </button>
        <button
          className="btn btn-secondary"
          onClick={handleShare}
          disabled={streams.length === 0}
        >
          Share Debug Data
        </button>
      </div>

      {/* Preview */}
      <div className="export-preview">
        <h3>Preview</h3>
        <pre className="preview-content">
          {JSON.stringify(generateExportData(), null, 2).slice(0, 500)}
          {JSON.stringify(generateExportData()).length > 500 ? '\n...' : ''}
        </pre>
      </div>
    </div>
  );
}

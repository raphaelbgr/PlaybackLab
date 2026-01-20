/**
 * ManifestViewer Component
 * SOLID: Single Responsibility - Display and parse manifests
 */

import { useEffect, useState } from 'react';
import { useStore, type DetectedStream } from '../../../store';
import { hlsParser } from '../../../core/services/HlsManifestParser';
import { dashParser } from '../../../core/services/DashManifestParser';
import type { ParsedManifest } from '../../../core/interfaces/IManifestParser';

interface Props {
  stream: DetectedStream | null;
}

export function ManifestViewer({ stream }: Props) {
  const { updateManifest, setStreamLoading, setStreamError } = useStore();
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    if (!stream || stream.manifest || stream.isLoading) return;

    const fetchAndParse = async () => {
      setStreamLoading(stream.info.id, true);

      try {
        const response = await chrome.runtime.sendMessage({
          type: 'FETCH_MANIFEST',
          payload: { url: stream.info.url },
        });

        if (!response.success) {
          throw new Error(response.error);
        }

        const content = response.content;
        const parser = stream.info.type === 'hls' ? hlsParser : dashParser;

        if (!parser.supports(content, stream.info.url)) {
          throw new Error('Unsupported manifest format');
        }

        const manifest = await parser.parse(content, stream.info.url);
        updateManifest(stream.info.id, manifest);
      } catch (error) {
        setStreamError(
          stream.info.id,
          error instanceof Error ? error.message : 'Failed to fetch manifest'
        );
      }
    };

    fetchAndParse();
  }, [stream?.info.id]);

  if (!stream) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📋</div>
        <h3 className="empty-state-title">No Stream Selected</h3>
        <p className="empty-state-text">
          Select a stream from the Streams tab to view its manifest.
        </p>
      </div>
    );
  }

  if (stream.isLoading) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">⏳</div>
        <h3 className="empty-state-title">Loading Manifest...</h3>
      </div>
    );
  }

  if (stream.error) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">❌</div>
        <h3 className="empty-state-title">Error Loading Manifest</h3>
        <p className="empty-state-text">{stream.error}</p>
      </div>
    );
  }

  if (!stream.manifest) {
    return null;
  }

  const manifest = stream.manifest;

  return (
    <div className="manifest-viewer">
      <div className="manifest-header">
        <h2>Manifest Details</h2>
        <button
          className="btn btn-secondary"
          onClick={() => setShowRaw(!showRaw)}
        >
          {showRaw ? 'Show Parsed' : 'Show Raw'}
        </button>
      </div>

      {showRaw ? (
        <RawManifest content={manifest.raw} />
      ) : (
        <ParsedManifestView manifest={manifest} />
      )}
    </div>
  );
}

function ParsedManifestView({ manifest }: { manifest: ParsedManifest }) {
  return (
    <>
      {/* Summary Cards */}
      <div className="manifest-info">
        <div className="info-card">
          <div className="info-card-title">Type</div>
          <div className="info-card-value">{manifest.type.toUpperCase()}</div>
        </div>
        <div className="info-card">
          <div className="info-card-title">Duration</div>
          <div className="info-card-value">
            {manifest.duration ? formatDuration(manifest.duration) : 'Live'}
          </div>
        </div>
        <div className="info-card">
          <div className="info-card-title">Video Variants</div>
          <div className="info-card-value">{manifest.videoVariants.length}</div>
        </div>
        <div className="info-card">
          <div className="info-card-title">Audio Tracks</div>
          <div className="info-card-value">{manifest.audioVariants.length}</div>
        </div>
        <div className="info-card">
          <div className="info-card-title">DRM</div>
          <div className="info-card-value">
            {manifest.drm.length > 0
              ? manifest.drm.map((d) => d.type).join(', ')
              : 'None'}
          </div>
        </div>
        <div className="info-card">
          <div className="info-card-title">Segments</div>
          <div className="info-card-value">{manifest.segments.length}</div>
        </div>
      </div>

      {/* Video Variants */}
      {manifest.videoVariants.length > 0 && (
        <>
          <h3>Video Variants</h3>
          <div className="variant-list">
            {manifest.videoVariants
              .sort((a, b) => b.bandwidth - a.bandwidth)
              .map((variant, i) => (
                <div key={i} className="variant-item">
                  <span className="variant-resolution">
                    {variant.width && variant.height
                      ? `${variant.width}x${variant.height}`
                      : 'Unknown'}
                  </span>
                  <span className="variant-bandwidth">
                    {formatBitrate(variant.bandwidth)}
                  </span>
                  <span className="variant-codecs">
                    {variant.codecs || 'N/A'}
                  </span>
                </div>
              ))}
          </div>
        </>
      )}

      {/* Audio Variants */}
      {manifest.audioVariants.length > 0 && (
        <>
          <h3>Audio Tracks</h3>
          <div className="variant-list">
            {manifest.audioVariants.map((audio, i) => (
              <div key={i} className="variant-item">
                <span className="variant-resolution">
                  {audio.language || 'Unknown'}
                </span>
                <span className="variant-bandwidth">
                  {audio.name || 'Default'}
                </span>
                <span className="variant-codecs">{audio.codecs || 'N/A'}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function RawManifest({ content }: { content: string }) {
  return (
    <div className="raw-manifest">
      <pre>{content}</pre>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatBitrate(bps: number): string {
  if (bps >= 1_000_000) {
    return `${(bps / 1_000_000).toFixed(1)} Mbps`;
  }
  return `${(bps / 1_000).toFixed(0)} Kbps`;
}

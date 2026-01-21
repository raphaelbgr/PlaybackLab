/**
 * StreamList Component
 * Modern card-based stream list focused on URLs as the primary entity
 */

import { useStore, useStreamsList } from '../../../store';
import { formatDistanceToNow } from 'date-fns';
import { generateCurlCommand, copyToClipboard } from '../../../shared/utils/copyAsCurl';
import { useToast } from './Toast';
import { safeUpperCase, typeToClassName, getFilenameFromUrl, getDisplayUrl } from '../../../shared/utils/stringUtils';

export function StreamList() {
  const streams = useStreamsList();
  const { selectedStreamId, selectStream, setActiveTab, removeStream } = useStore();
  const { showToast } = useToast();

  // Empty state
  if (streams.length === 0) {
    return (
      <div className="stream-list-empty">
        <div className="empty-icon">📡</div>
        <h3>No Streams Detected</h3>
        <p>Enter a stream URL above or enable auto-detection to find streams on this page.</p>
      </div>
    );
  }

  const handleCopyUrl = (url: string) => {
    copyToClipboard(url);
    showToast('success', 'URL copied to clipboard');
  };

  const handleCopyCurl = (url: string, headers?: Record<string, string>) => {
    const curl = generateCurlCommand({ url, method: 'GET', headers });
    copyToClipboard(curl);
    showToast('success', 'cURL command copied');
  };

  const handleInspect = (streamId: string) => {
    selectStream(streamId);
    setActiveTab('streams');
  };

  const handleRemove = (streamId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeStream(streamId);
    showToast('info', 'Stream removed');
  };

  // Separate active and other streams
  const activeStreams = streams.filter(s => s.info.isActive);
  const otherStreams = streams.filter(s => !s.info.isActive);

  return (
    <div className="stream-cards">
      {activeStreams.length > 0 && (
        <div className="stream-section">
          <div className="section-label">
            <span className="pulse-dot"></span>
            Now Playing
          </div>
          {activeStreams.map((stream) => (
            <StreamCard
              key={stream.info.id}
              stream={stream}
              isSelected={selectedStreamId === stream.info.id}
              onSelect={() => selectStream(stream.info.id)}
              onCopyUrl={() => handleCopyUrl(stream.info.url)}
              onCopyCurl={() => handleCopyCurl(stream.info.url, stream.info.requestHeaders)}
              onInspect={() => handleInspect(stream.info.id)}
              onRemove={(e) => handleRemove(stream.info.id, e)}
            />
          ))}
        </div>
      )}

      {otherStreams.length > 0 && (
        <div className="stream-section">
          {activeStreams.length > 0 && (
            <div className="section-label">Detected</div>
          )}
          {otherStreams.map((stream) => (
            <StreamCard
              key={stream.info.id}
              stream={stream}
              isSelected={selectedStreamId === stream.info.id}
              onSelect={() => selectStream(stream.info.id)}
              onCopyUrl={() => handleCopyUrl(stream.info.url)}
              onCopyCurl={() => handleCopyCurl(stream.info.url, stream.info.requestHeaders)}
              onInspect={() => handleInspect(stream.info.id)}
              onRemove={(e) => handleRemove(stream.info.id, e)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface StreamCardProps {
  stream: ReturnType<typeof useStreamsList>[0];
  isSelected: boolean;
  onSelect: () => void;
  onCopyUrl: () => void;
  onCopyCurl: () => void;
  onInspect: () => void;
  onRemove: (e: React.MouseEvent) => void;
}

function StreamCard({ stream, isSelected, onSelect, onCopyUrl, onCopyCurl, onInspect, onRemove }: StreamCardProps) {
  const { info, manifest, isLoading, error } = stream;

  // Get variant count text
  const getVariantText = (): string | null => {
    if (!manifest) return null;
    const count = manifest.videoVariants?.length || 0;
    if (count === 0) return null;
    return `${count} variant${count !== 1 ? 's' : ''}`;
  };

  // Get resolution text
  const getResolutionText = (): string | null => {
    if (!manifest?.videoVariants?.length) return null;
    const maxVariant = manifest.videoVariants.reduce((max, v) =>
      (v.height || 0) > (max.height || 0) ? v : max
    , manifest.videoVariants[0]);
    if (maxVariant.height) {
      return `${maxVariant.height}p`;
    }
    return null;
  };

  const filename = getFilenameFromUrl(info.url);
  const displayUrl = getDisplayUrl(info.url);
  const variantText = getVariantText();
  const resolutionText = getResolutionText();

  return (
    <div
      className={`stream-card ${isSelected ? 'selected' : ''} ${info.isActive ? 'active' : ''}`}
      onClick={onSelect}
    >
      <div className="stream-card-header">
        <span className={`type-badge ${typeToClassName(info.type)}`}>
          {safeUpperCase(info.type)}
        </span>

        {info.isActive && (
          <span className="status-badge playing">
            <span className="status-dot"></span>
            PLAYING
          </span>
        )}

        {isLoading && (
          <span className="status-badge loading">LOADING...</span>
        )}

        {error && (
          <span className="status-badge error">ERROR</span>
        )}

        <span className="stream-filename">{filename}</span>

        <button
          className="remove-btn"
          onClick={onRemove}
          title="Remove stream"
        >
          ×
        </button>
      </div>

      <div className="stream-card-url" title={info.url}>
        {displayUrl}
      </div>

      <div className="stream-card-footer">
        <div className="stream-meta">
          {resolutionText && <span className="meta-item">{resolutionText}</span>}
          {variantText && <span className="meta-item">{variantText}</span>}
          <span className="meta-item time">
            {formatDistanceToNow(info.detectedAt, { addSuffix: true })}
          </span>
        </div>

        <div className="stream-actions">
          <button
            className="action-btn"
            onClick={(e) => { e.stopPropagation(); onCopyUrl(); }}
            title="Copy URL"
          >
            📋
          </button>
          <button
            className="action-btn"
            onClick={(e) => { e.stopPropagation(); onCopyCurl(); }}
            title="Copy as cURL"
          >
            ⚡
          </button>
          <button
            className="action-btn primary"
            onClick={(e) => { e.stopPropagation(); onInspect(); }}
            title="Inspect manifest"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * StreamsPanel Component
 * Split panel layout: Stream list on left, details on right
 */

import { useState, useMemo } from 'react';
import { useStore, useStreamsList, useSelectedStream, type DetectedStream } from '../../../store';
import { StreamsInputBar } from './StreamsInputBar';
import { StreamDetails } from './StreamDetails';
import { formatDistanceToNow } from 'date-fns';
import { generateCurlCommand, copyToClipboard } from '../../../shared/utils/copyAsCurl';
import { useToast } from './Toast';
import { safeUpperCase, typeToClassName, formatBitrateShort, getFilenameFromUrl, getDisplayUrl, getStreamGroupKey, cleanPageTitle } from '../../../shared/utils/stringUtils';
import type { PlaybackState } from '../../../core/interfaces/IStreamDetector';

// Playback Status Indicator Component
function PlaybackStatusIndicator({ state, isActive }: { state?: PlaybackState; isActive?: boolean }) {
  // Determine the effective state
  const effectiveState = state || (isActive ? 'playing' : 'idle');

  const statusConfig: Record<PlaybackState, { icon: string; label: string; className: string }> = {
    playing: { icon: '▶', label: 'Playing', className: 'playing' },
    paused: { icon: '⏸', label: 'Paused', className: 'paused' },
    buffering: { icon: '◐', label: 'Buffering', className: 'buffering' },
    stalled: { icon: '⚠', label: 'Stalled', className: 'stalled' },
    ended: { icon: '⏹', label: 'Ended', className: 'ended' },
    idle: { icon: '○', label: 'Idle', className: 'idle' },
  };

  const config = statusConfig[effectiveState];

  return (
    <span className={`playback-status ${config.className}`} title={config.label}>
      <span className="playback-icon">{config.icon}</span>
    </span>
  );
}

// Audio Indicator Component
function AudioIndicator({ hasAudio, isMuted, isPlaying }: { hasAudio?: boolean; isMuted?: boolean; isPlaying?: boolean }) {
  if (!hasAudio) {
    return null;
  }

  // Determine audio state
  const audioPlaying = hasAudio && !isMuted && isPlaying;

  return (
    <span className={`audio-indicator ${audioPlaying ? 'playing' : ''} ${isMuted ? 'muted' : ''}`} title={isMuted ? 'Muted' : (audioPlaying ? 'Audio playing' : 'Audio available')}>
      {isMuted ? (
        <span className="audio-icon muted">🔇</span>
      ) : (
        <span className="audio-icon">
          <span className="audio-bars">
            <span className="bar"></span>
            <span className="bar"></span>
            <span className="bar"></span>
          </span>
        </span>
      )}
    </span>
  );
}

// Stream group type
interface StreamGroup {
  key: string;
  filename: string;
  hostname: string;
  pageTitle?: string;
  streams: DetectedStream[];
  hasActive: boolean;
  hasPlaying: boolean;
  hasAudio: boolean;
  primaryPlaybackState?: PlaybackState;
}

export function StreamsPanel() {
  const streams = useStreamsList();
  const selectedStream = useSelectedStream();
  const { selectedStreamId, selectStream, removeStream } = useStore();
  const { showToast } = useToast();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // Group streams by hostname + filename
  const streamGroups = useMemo(() => {
    const groups = new Map<string, StreamGroup>();

    // Priority order for playback states (higher = more important)
    const statePriority: Record<PlaybackState, number> = {
      playing: 5,
      buffering: 4,
      stalled: 3,
      paused: 2,
      ended: 1,
      idle: 0,
    };

    for (const stream of streams) {
      const key = getStreamGroupKey(stream.info.url);
      const existing = groups.get(key);

      if (existing) {
        existing.streams.push(stream);
        if (stream.info.isActive) existing.hasActive = true;
        if (stream.info.playbackState === 'playing') existing.hasPlaying = true;
        if (stream.info.hasAudio) existing.hasAudio = true;
        // Update primary playback state if this one is more important
        const currentPriority = existing.primaryPlaybackState ? statePriority[existing.primaryPlaybackState] : -1;
        const newPriority = stream.info.playbackState ? statePriority[stream.info.playbackState] : -1;
        if (newPriority > currentPriority) {
          existing.primaryPlaybackState = stream.info.playbackState;
        }
        // Use the most recent page title
        if (stream.info.pageTitle && !existing.pageTitle) {
          existing.pageTitle = stream.info.pageTitle;
        }
      } else {
        try {
          const urlObj = new URL(stream.info.url);
          groups.set(key, {
            key,
            filename: getFilenameFromUrl(stream.info.url),
            hostname: urlObj.hostname,
            pageTitle: stream.info.pageTitle,
            streams: [stream],
            hasActive: !!stream.info.isActive,
            hasPlaying: stream.info.playbackState === 'playing',
            hasAudio: !!stream.info.hasAudio,
            primaryPlaybackState: stream.info.playbackState,
          });
        } catch {
          // Invalid URL, create ungrouped entry
          groups.set(key, {
            key,
            filename: 'unknown',
            hostname: 'unknown',
            pageTitle: stream.info.pageTitle,
            streams: [stream],
            hasActive: !!stream.info.isActive,
            hasPlaying: stream.info.playbackState === 'playing',
            hasAudio: !!stream.info.hasAudio,
            primaryPlaybackState: stream.info.playbackState,
          });
        }
      }
    }

    // Sort groups: playing first, then active, then by most recent detection
    return Array.from(groups.values()).sort((a, b) => {
      if (a.hasPlaying && !b.hasPlaying) return -1;
      if (!a.hasPlaying && b.hasPlaying) return 1;
      if (a.hasActive && !b.hasActive) return -1;
      if (!a.hasActive && b.hasActive) return 1;
      const aTime = Math.max(...a.streams.map(s => s.info.detectedAt));
      const bTime = Math.max(...b.streams.map(s => s.info.detectedAt));
      return bTime - aTime;
    });
  }, [streams]);

  const toggleGroupExpand = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleExpand = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCopyUrl = (url: string) => {
    copyToClipboard(url);
    showToast('success', 'URL copied to clipboard');
  };

  const handleCopyCurl = (url: string, headers?: Record<string, string>) => {
    const curl = generateCurlCommand({ url, method: 'GET', headers });
    copyToClipboard(curl);
    showToast('success', 'cURL command copied');
  };

  const handleRemove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeStream(id);
    showToast('info', 'Stream removed');
  };

  const hasSelection = !!selectedStream;

  return (
    <div className={`streams-panel ${hasSelection ? 'has-selection' : ''}`}>
      {/* Left Side - Stream List */}
      <div className="streams-list-panel">
        <StreamsInputBar />

        {streams.length === 0 ? (
          <div className="stream-list-empty">
            <div className="empty-icon">📡</div>
            <h3>No Streams Detected</h3>
            <p>Enter a stream URL above or click "Scan Page" to find streams.</p>
          </div>
        ) : (
          <div className="stream-cards">
            {streamGroups.map((group) => (
              <StreamGroupCard
                key={group.key}
                group={group}
                isExpanded={expandedGroups.has(group.key)}
                selectedStreamId={selectedStreamId}
                expandedCards={expandedCards}
                onToggleGroup={() => toggleGroupExpand(group.key)}
                onSelectStream={selectStream}
                onToggleCard={toggleExpand}
                onCopyUrl={handleCopyUrl}
                onCopyCurl={handleCopyCurl}
                onRemove={handleRemove}
              />
            ))}
          </div>
        )}
      </div>

      {/* Right Side - Details Panel (only shown when stream selected) */}
      {hasSelection && (
        <div className="streams-details-panel">
          <button
            className="close-panel-btn"
            onClick={() => selectStream(null)}
            title="Close details panel"
          >
            »
          </button>
          <StreamDetails stream={selectedStream} />
        </div>
      )}
    </div>
  );
}

// Stream Group Card Component
interface StreamGroupCardProps {
  group: StreamGroup;
  isExpanded: boolean;
  selectedStreamId: string | null;
  expandedCards: Set<string>;
  onToggleGroup: () => void;
  onSelectStream: (id: string) => void;
  onToggleCard: (id: string) => void;
  onCopyUrl: (url: string) => void;
  onCopyCurl: (url: string, headers?: Record<string, string>) => void;
  onRemove: (id: string, e: React.MouseEvent) => void;
}

function StreamGroupCard({
  group,
  isExpanded,
  selectedStreamId,
  expandedCards,
  onToggleGroup,
  onSelectStream,
  onToggleCard,
  onCopyUrl,
  onCopyCurl,
  onRemove,
}: StreamGroupCardProps) {
  const firstStream = group.streams[0];
  const hasMultiple = group.streams.length > 1;
  const cleanedTitle = cleanPageTitle(group.pageTitle);
  const isAnySelected = group.streams.some(s => s.info.id === selectedStreamId);

  // If only one stream, render it directly without group wrapper
  if (!hasMultiple) {
    return (
      <ExpandableStreamCard
        stream={firstStream}
        isSelected={selectedStreamId === firstStream.info.id}
        isExpanded={expandedCards.has(firstStream.info.id)}
        onSelect={() => onSelectStream(firstStream.info.id)}
        onToggleExpand={() => onToggleCard(firstStream.info.id)}
        onCopyUrl={() => onCopyUrl(firstStream.info.url)}
        onCopyCurl={() => onCopyCurl(firstStream.info.url, firstStream.info.requestHeaders)}
        onRemove={(e) => onRemove(firstStream.info.id, e)}
        showTitle={true}
        title={cleanedTitle}
      />
    );
  }

  // Multiple streams - show as collapsible group
  const isGroupPlaying = group.hasPlaying;
  const isGroupBuffering = group.primaryPlaybackState === 'buffering' || group.primaryPlaybackState === 'stalled';

  return (
    <div className={`stream-group ${isExpanded ? 'expanded' : ''} ${isAnySelected ? 'has-selected' : ''} ${group.hasActive ? 'active' : ''} ${isGroupPlaying ? 'is-playing' : ''} ${isGroupBuffering ? 'is-buffering' : ''}`}>
      {/* Group Header */}
      <div className="stream-group-header" onClick={onToggleGroup}>
        <button className="expand-btn">
          {isExpanded ? '▼' : '▶'}
        </button>
        <span className={`type-badge ${typeToClassName(firstStream.info.type)}`}>
          {safeUpperCase(firstStream.info.type)}
        </span>

        {/* Playback Status Indicator */}
        <PlaybackStatusIndicator state={group.primaryPlaybackState} isActive={group.hasActive} />

        {/* Audio Indicator for group */}
        <AudioIndicator
          hasAudio={group.hasAudio}
          isMuted={false}
          isPlaying={isGroupPlaying}
        />

        <div className="group-info">
          {cleanedTitle && (
            <span className="group-title">{cleanedTitle}</span>
          )}
          <span className="group-filename">{group.filename}</span>
        </div>
        <span className="group-count">{group.streams.length}</span>
      </div>

      {/* Group URL Preview */}
      <div className="stream-group-url">
        {group.hostname}
      </div>

      {/* Expanded: Show all streams in group */}
      {isExpanded && (
        <div className="stream-group-items">
          {group.streams.map((stream, index) => {
            const itemIsPlaying = stream.info.playbackState === 'playing';
            return (
              <div
                key={stream.info.id}
                className={`stream-group-item ${selectedStreamId === stream.info.id ? 'selected' : ''} ${itemIsPlaying ? 'is-playing' : ''}`}
                onClick={() => onSelectStream(stream.info.id)}
              >
                <span className="item-index">#{index + 1}</span>
                <PlaybackStatusIndicator state={stream.info.playbackState} isActive={stream.info.isActive} />
                <AudioIndicator
                  hasAudio={stream.info.hasAudio}
                  isMuted={stream.info.audioMuted}
                  isPlaying={itemIsPlaying}
                />
                <span className="item-url" title={stream.info.url}>
                  {getDisplayUrl(stream.info.url, 35)}
                </span>
                <span className="item-time">
                  {formatDistanceToNow(stream.info.detectedAt, { addSuffix: true })}
                </span>
                <button
                  className="remove-btn mini"
                  onClick={(e) => onRemove(stream.info.id, e)}
                  title="Remove"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface ExpandableStreamCardProps {
  stream: ReturnType<typeof useStreamsList>[0];
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
  onCopyUrl: () => void;
  onCopyCurl: () => void;
  onRemove: (e: React.MouseEvent) => void;
  showTitle?: boolean;
  title?: string;
}

function ExpandableStreamCard({
  stream,
  isSelected,
  isExpanded,
  onSelect,
  onToggleExpand,
  onCopyUrl,
  onCopyCurl,
  onRemove,
  showTitle = false,
  title,
}: ExpandableStreamCardProps) {
  const { info, manifest, isLoading, error } = stream;

  const filename = getFilenameFromUrl(info.url);
  const displayUrl = getDisplayUrl(info.url, 30);
  // Use passed title or try to get from page title
  const displayTitle = title || cleanPageTitle(info.pageTitle);

  // Determine if stream is actively playing
  const isPlaying = info.playbackState === 'playing';
  const isBuffering = info.playbackState === 'buffering' || info.playbackState === 'stalled';

  return (
    <div
      className={`stream-card ${isSelected ? 'selected' : ''} ${info.isActive ? 'active' : ''} ${isExpanded ? 'expanded' : ''} ${isPlaying ? 'is-playing' : ''} ${isBuffering ? 'is-buffering' : ''}`}
      onClick={onSelect}
    >
      {/* Card Header */}
      <div className="stream-card-header">
        <button
          className="expand-btn"
          onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
          title={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? '▼' : '▶'}
        </button>

        <span className={`type-badge ${typeToClassName(info.type)}`}>
          {safeUpperCase(info.type)}
        </span>

        {/* Playback Status Indicator */}
        <PlaybackStatusIndicator state={info.playbackState} isActive={info.isActive} />

        {/* Audio Indicator */}
        <AudioIndicator
          hasAudio={info.hasAudio}
          isMuted={info.audioMuted}
          isPlaying={isPlaying}
        />

        {isLoading && <span className="status-badge loading">...</span>}
        {error && <span className="status-badge error">!</span>}

        <span className="stream-filename">{filename}</span>

        <button
          className="remove-btn"
          onClick={onRemove}
          title="Remove stream"
        >
          ×
        </button>
      </div>

      {/* Video Title (if available) */}
      {displayTitle && (
        <div className="stream-card-title" title={displayTitle}>
          {displayTitle}
        </div>
      )}

      {/* URL */}
      <div className="stream-card-url" title={info.url}>
        {displayUrl}
      </div>

      {/* Quick Stats (always visible) */}
      <div className="stream-quick-stats">
        {manifest?.videoVariants?.length ? (
          <>
            <span className="quick-stat">
              {Math.max(...manifest.videoVariants.map(v => v.height || 0))}p
            </span>
            <span className="quick-stat">
              {manifest.videoVariants.length} variants
            </span>
          </>
        ) : null}
        {manifest?.drm?.length ? (
          <span className="quick-stat drm">
            🔐 {manifest.drm[0].type}
          </span>
        ) : null}
        <span className="quick-stat time">
          {formatDistanceToNow(info.detectedAt, { addSuffix: true })}
        </span>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="stream-card-expanded">
          {/* Variants Preview */}
          {manifest?.videoVariants && manifest.videoVariants.length > 0 && (
            <div className="expanded-section">
              <div className="expanded-section-title">Video Variants</div>
              <div className="variants-preview">
                {manifest.videoVariants
                  .sort((a, b) => (b.height || 0) - (a.height || 0))
                  .slice(0, 4)
                  .map((v, i) => (
                    <div key={i} className="variant-chip">
                      {v.height}p · {formatBitrateShort(v.bandwidth)}
                    </div>
                  ))}
                {manifest.videoVariants.length > 4 && (
                  <div className="variant-chip more">
                    +{manifest.videoVariants.length - 4} more
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Audio Preview */}
          {manifest?.audioVariants && manifest.audioVariants.length > 0 && (
            <div className="expanded-section">
              <div className="expanded-section-title">Audio Tracks</div>
              <div className="audio-preview">
                {manifest.audioVariants.slice(0, 3).map((a, i) => (
                  <span key={i} className="audio-chip">
                    {a.language || 'und'} {a.name ? `(${a.name})` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* DRM Preview */}
          {manifest?.drm && manifest.drm.length > 0 && (
            <div className="expanded-section">
              <div className="expanded-section-title">DRM Protection</div>
              <div className="drm-preview">
                {manifest.drm.map((d, i) => (
                  <span key={i} className={`drm-chip ${typeToClassName(d.type)}`}>
                    {safeUpperCase(d.type)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="expanded-actions">
            <button onClick={(e) => { e.stopPropagation(); onCopyUrl(); }}>
              📋 Copy URL
            </button>
            <button onClick={(e) => { e.stopPropagation(); onCopyCurl(); }}>
              ⚡ Copy cURL
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// formatBitrate is now imported from shared/utils/stringUtils

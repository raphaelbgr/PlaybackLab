/**
 * StreamsPanel Component
 * Split panel layout: Stream list on left, details on right
 */

import { useState, useMemo, useEffect } from 'react';
import { useStore, useStreamsList, useSelectedStream, type DetectedStream } from '../../../store';
import { StreamsInputBar } from './StreamsInputBar';
import { StreamDetails } from './StreamDetails';
import { formatDistanceToNow } from 'date-fns';
import { generateCurlCommand, copyToClipboard } from '../../../shared/utils/copyAsCurl';
import { useToast } from './Toast';
import { safeUpperCase, typeToClassName, formatBitrateShort, getFilenameFromUrl, getDisplayUrl, getStreamGroupKey, cleanPageTitle } from '../../../shared/utils/stringUtils';
import type { PlaybackState, StreamContentType, StreamRole } from '../../../core/interfaces/IStreamDetector';

// Time window (ms) to consider a stream as "new"
const NEW_STREAM_WINDOW_MS = 15000; // 15 seconds

// Helper function to check if a stream is recently detected
function isStreamNew(detectedAt: number): boolean {
  return Date.now() - detectedAt < NEW_STREAM_WINDOW_MS;
}

// Helper function to get tooltip for stream type
function getStreamTypeTooltip(type: string | undefined): string {
  const tooltips: Record<string, string> = {
    hls: 'HLS (HTTP Live Streaming) - Apple\'s adaptive bitrate streaming protocol, widely used for video delivery',
    dash: 'DASH (Dynamic Adaptive Streaming over HTTP) - International standard for adaptive streaming',
    mse: 'MSE (Media Source Extensions) - Browser API used by players to handle streaming',
    video: 'Direct video file or unknown stream type',
  };
  return tooltips[(type || '').toLowerCase()] || `${type || 'Unknown'} stream`;
}

// Playback Status Indicator Component
function PlaybackStatusIndicator({ state, isActive, showLabel = false }: { state?: PlaybackState; isActive?: boolean; showLabel?: boolean }) {
  // Determine the effective state
  const effectiveState = state || (isActive ? 'playing' : 'idle');

  const statusConfig: Record<PlaybackState, { icon: string; label: string; className: string; tooltip: string }> = {
    playing: { icon: '▶', label: 'PLAYING', className: 'playing', tooltip: 'Video is currently playing' },
    paused: { icon: '⏸', label: 'PAUSED', className: 'paused', tooltip: 'Video is paused' },
    buffering: { icon: '◐', label: 'BUFFERING', className: 'buffering', tooltip: 'Video is buffering - waiting for data' },
    stalled: { icon: '⚠', label: 'STALLED', className: 'stalled', tooltip: 'Playback stalled - network issue or slow connection' },
    ended: { icon: '⏹', label: 'ENDED', className: 'ended', tooltip: 'Video playback has ended' },
    idle: { icon: '○', label: '', className: 'idle', tooltip: 'Stream detected but not actively playing' },
  };

  const config = statusConfig[effectiveState];

  // Show label badge for active states
  if (showLabel && effectiveState !== 'idle') {
    return (
      <span className={`playback-status-badge ${config.className}`} title={config.tooltip}>
        <span className="playback-icon">{config.icon}</span>
        <span className="playback-label">{config.label}</span>
      </span>
    );
  }

  return (
    <span className={`playback-status ${config.className}`} title={config.tooltip}>
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

// Content Type Indicator Component
function ContentTypeIndicator({ contentType }: { contentType?: StreamContentType }) {
  if (!contentType || contentType === 'unknown') {
    return null;
  }

  const config: Record<StreamContentType, { icon: string; label: string; className: string; tooltip: string }> = {
    video: { icon: '🎬', label: 'VIDEO', className: 'content-video', tooltip: 'Video content - contains video tracks' },
    audio: { icon: '🎵', label: 'AUDIO', className: 'content-audio', tooltip: 'Audio-only content - no video tracks' },
    subtitle: { icon: '📝', label: 'SUBS', className: 'content-subtitle', tooltip: 'Subtitle/caption track' },
    mixed: { icon: '📦', label: 'MIXED', className: 'content-mixed', tooltip: 'Mixed content - contains multiple media types' },
    unknown: { icon: '❓', label: '', className: '', tooltip: 'Content type not determined' },
  };

  const { icon, label, className, tooltip } = config[contentType];

  return (
    <span className={`content-type-badge ${className}`} title={tooltip}>
      <span className="content-icon">{icon}</span>
      <span className="content-label">{label}</span>
    </span>
  );
}

// Role Indicator Component (for hierarchy visualization)
function RoleIndicator({ role }: { role?: StreamRole }) {
  if (!role || role === 'standalone') {
    return null;
  }

  const config: Record<StreamRole, { icon: string; label: string; className: string; indent: number; tooltip: string }> = {
    master: { icon: '👑', label: 'MASTER', className: 'role-master', indent: 0, tooltip: 'Master manifest - index file that lists all available quality levels and tracks' },
    variant: { icon: '├─', label: 'variant', className: 'role-variant', indent: 1, tooltip: 'Variant playlist - specific quality/bitrate version of the video' },
    'audio-track': { icon: '├─', label: 'audio', className: 'role-audio', indent: 1, tooltip: 'Audio track - separate audio stream (e.g., different language)' },
    'subtitle-track': { icon: '├─', label: 'subs', className: 'role-subtitle', indent: 1, tooltip: 'Subtitle track - captions or subtitles' },
    standalone: { icon: '', label: '', className: '', indent: 0, tooltip: 'Standalone stream' },
  };

  const { icon, label, className, tooltip } = config[role];

  return (
    <span className={`role-badge ${className}`} title={tooltip}>
      <span className="role-icon">{icon}</span>
      <span className="role-label">{label}</span>
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
  primaryContentType?: StreamContentType;
}

export function StreamsPanel() {
  const streams = useStreamsList();
  const selectedStream = useSelectedStream();
  const { selectedStreamId, selectStream, removeStream } = useStore();
  const { showToast } = useToast();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // Auto-expand group when a stream is selected (e.g., from overlay click)
  useEffect(() => {
    if (selectedStreamId && streams.length > 0) {
      const selectedStreamData = streams.find(s => s.info.id === selectedStreamId);
      if (selectedStreamData) {
        const groupKey = getStreamGroupKey(selectedStreamData.info.url);
        setExpandedGroups(prev => {
          if (prev.has(groupKey)) return prev;
          const next = new Set(prev);
          next.add(groupKey);
          return next;
        });
      }
    }
  }, [selectedStreamId, streams]);

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
        // Use the first defined content type
        if (stream.info.contentType && !existing.primaryContentType) {
          existing.primaryContentType = stream.info.contentType;
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
            primaryContentType: stream.info.contentType,
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
            primaryContentType: stream.info.contentType,
          });
        }
      }
    }

    // Sort streams within each group: playing first, then by most recent detection
    for (const group of groups.values()) {
      group.streams.sort((a, b) => {
        // Playing streams first
        const aPlaying = a.info.playbackState === 'playing' ? 1 : 0;
        const bPlaying = b.info.playbackState === 'playing' ? 1 : 0;
        if (aPlaying !== bPlaying) return bPlaying - aPlaying;
        // Then by detection time (most recent first)
        return b.info.detectedAt - a.info.detectedAt;
      });
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
        isNew={isStreamNew(firstStream.info.detectedAt)}
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
        <span className={`type-badge ${typeToClassName(firstStream.info.type)}`} title={getStreamTypeTooltip(firstStream.info.type)}>
          {safeUpperCase(firstStream.info.type)}
        </span>

        {/* Content Type Badge */}
        <ContentTypeIndicator contentType={group.primaryContentType} />

        {/* Playback Status Badge with Label for active streams */}
        <PlaybackStatusIndicator
          state={group.primaryPlaybackState}
          isActive={group.hasActive}
          showLabel={isGroupPlaying || isGroupBuffering}
        />

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
            const role = stream.info.role;
            const isChild = role === 'variant' || role === 'audio-track' || role === 'subtitle-track';
            return (
              <div
                key={stream.info.id}
                className={`stream-group-item ${selectedStreamId === stream.info.id ? 'selected' : ''} ${itemIsPlaying ? 'is-playing' : ''} ${isChild ? 'child-stream' : ''}`}
                onClick={() => onSelectStream(stream.info.id)}
              >
                <RoleIndicator role={stream.info.role} />
                {isStreamNew(stream.info.detectedAt) && (
                  <span className="new-badge mini" title="Recently detected">NEW</span>
                )}
                <ContentTypeIndicator contentType={stream.info.contentType} />
                <PlaybackStatusIndicator state={stream.info.playbackState} isActive={stream.info.isActive} />
                <AudioIndicator
                  hasAudio={stream.info.hasAudio}
                  isMuted={stream.info.audioMuted}
                  isPlaying={itemIsPlaying}
                />
                <span className="item-url" title={stream.info.url}>
                  {getDisplayUrl(stream.info.url, 30)}
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
  isNew: boolean;
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
  isNew,
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

        <span className={`type-badge ${typeToClassName(info.type)}`} title={getStreamTypeTooltip(info.type)}>
          {safeUpperCase(info.type)}
        </span>

        {/* NEW Badge for recently detected streams */}
        {isNew && (
          <span className="new-badge" title="Recently detected stream">
            NEW
          </span>
        )}

        {/* Content Type Badge */}
        <ContentTypeIndicator contentType={info.contentType} />

        {/* Playback Status Badge with Label for active streams */}
        <PlaybackStatusIndicator
          state={info.playbackState}
          isActive={info.isActive}
          showLabel={isPlaying || isBuffering}
        />

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

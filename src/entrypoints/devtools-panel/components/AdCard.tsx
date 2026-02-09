/**
 * AdCard Component - Displays individual ad details
 * SOLID: Single Responsibility - Only displays a single ad's information
 */

import { useState } from 'react';
import type { DetectedAd, AdMediaFile, TrackingEvent } from '../../../core/interfaces/IAdDetector';
import { MiniPlayer } from './MiniPlayer';
import { copyToClipboard } from '../../../shared/utils/copyAsCurl';
import { useToast } from './Toast';

interface Props {
  ad: DetectedAd;
  isExpanded: boolean;
  isSelected: boolean;
  onToggle: () => void;
}

export function AdCard({ ad, isExpanded, isSelected, onToggle }: Props) {
  const { showToast } = useToast();
  const [activeSection, setActiveSection] = useState<'media' | 'tracking' | 'raw'>('media');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Get all media files from all pods/ads/creatives
  const getAllMediaFiles = (): Array<AdMediaFile & { adTitle?: string; duration?: number }> => {
    const files: Array<AdMediaFile & { adTitle?: string; duration?: number }> = [];
    for (const pod of ad.pods) {
      for (const parsedAd of pod.ads) {
        for (const creative of parsedAd.creatives) {
          for (const mf of creative.mediaFiles) {
            files.push({
              ...mf,
              adTitle: parsedAd.adTitle,
              duration: creative.duration,
            });
          }
        }
      }
    }
    return files;
  };

  // Get all tracking events from all pods/ads/creatives
  const getAllTrackingEvents = (): TrackingEvent[] => {
    const events: TrackingEvent[] = [];
    for (const pod of ad.pods) {
      for (const parsedAd of pod.ads) {
        // Add impression URLs as tracking events
        for (const url of parsedAd.impressionUrls) {
          events.push({ type: 'impression', url });
        }
        for (const creative of parsedAd.creatives) {
          events.push(...creative.trackingEvents);
        }
      }
    }
    return events;
  };

  // Get first ad info for display
  const getFirstAdInfo = (): { adSystem?: string; adTitle?: string; duration?: number; skipDelay?: number } | null => {
    for (const pod of ad.pods) {
      for (const parsedAd of pod.ads) {
        for (const creative of parsedAd.creatives) {
          return {
            adSystem: parsedAd.adSystem,
            adTitle: parsedAd.adTitle,
            duration: creative.duration,
            skipDelay: creative.skipDelay,
          };
        }
      }
    }
    return null;
  };

  // Get primary position from pods
  const getPrimaryPosition = (): string => {
    for (const pod of ad.pods) {
      if (pod.position !== 'unknown') {
        return pod.position;
      }
    }
    return 'unknown';
  };

  // Check if ad is skippable
  const isSkippable = (): boolean => {
    for (const pod of ad.pods) {
      for (const parsedAd of pod.ads) {
        for (const creative of parsedAd.creatives) {
          if (creative.skipDelay !== undefined && creative.skipDelay >= 0) {
            return true;
          }
        }
      }
    }
    return false;
  };

  const mediaFiles = getAllMediaFiles();
  const trackingEvents = getAllTrackingEvents();
  const firstAdInfo = getFirstAdInfo();
  const position = getPrimaryPosition();
  const skippable = isSkippable();

  // Group tracking events by type
  const groupedEvents = trackingEvents.reduce((acc, event) => {
    const type = event.type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(event);
    return acc;
  }, {} as Record<string, TrackingEvent[]>);

  // Format duration
  const formatDuration = (seconds?: number): string => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  // Format file size
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Get source badge label
  const getSourceLabel = (): string => {
    switch (ad.source) {
      case 'ima': return 'IMA';
      case 'freewheel': return 'FreeWheel';
      case 'spotx': return 'SpotX';
      case 'springserve': return 'SpringServe';
      default: return 'Ad';
    }
  };

  // Copy URL to clipboard
  const handleCopyUrl = (url: string) => {
    copyToClipboard(url);
    showToast('success', 'URL copied to clipboard');
  };

  return (
    <div className={`ad-card ${isExpanded ? 'expanded' : ''} ${isSelected ? 'selected' : ''}`}>
      {/* Header */}
      <div className="ad-card-header" onClick={onToggle}>
        <button className="expand-btn">
          {isExpanded ? '▼' : '▶'}
        </button>

        {/* Badges */}
        <div className="ad-card-badges">
          <span className={`ad-badge ${ad.format}`}>
            {ad.format.toUpperCase()}
          </span>
          {ad.vastVersion && (
            <span className="ad-badge version" title={`VAST version ${ad.vastVersion}`}>
              v{ad.vastVersion}
            </span>
          )}
          {ad.vmapVersion && (
            <span className="ad-badge version" title={`VMAP version ${ad.vmapVersion}`}>
              v{ad.vmapVersion}
            </span>
          )}
          <span className={`ad-badge source ${ad.source}`}>
            {getSourceLabel()}
          </span>
          {position !== 'unknown' && (
            <span className={`ad-badge position ${position}`}>
              {position.replace('-', ' ').toUpperCase()}
            </span>
          )}
          {skippable && (
            <span className="ad-badge skippable" title="Ad can be skipped">
              SKIP
            </span>
          )}
        </div>

        {/* Loading/Error indicators */}
        {ad.isLoading && (
          <span className="ad-status loading">Loading...</span>
        )}
        {ad.error && (
          <span className="ad-status error" title={ad.error}>Error</span>
        )}
      </div>

      {/* Summary */}
      <div className="ad-card-summary">
        {firstAdInfo?.adSystem && (
          <span className="ad-system">{firstAdInfo.adSystem}</span>
        )}
        {firstAdInfo?.adTitle && (
          <span className="ad-title">{firstAdInfo.adTitle}</span>
        )}
        {firstAdInfo?.duration && (
          <span className="ad-duration">{formatDuration(firstAdInfo.duration)}</span>
        )}
        {skippable && firstAdInfo?.skipDelay !== undefined && (
          <span className="ad-skip-offset">Skip after {firstAdInfo.skipDelay}s</span>
        )}
      </div>

      {/* URL (truncated) */}
      <div className="ad-card-url" title={ad.url}>
        {new URL(ad.url).hostname}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="ad-card-content">
          {/* Section Tabs */}
          <div className="ad-section-tabs">
            <button
              className={`ad-section-tab ${activeSection === 'media' ? 'active' : ''}`}
              onClick={() => setActiveSection('media')}
            >
              Media ({mediaFiles.length})
            </button>
            <button
              className={`ad-section-tab ${activeSection === 'tracking' ? 'active' : ''}`}
              onClick={() => setActiveSection('tracking')}
            >
              Tracking ({trackingEvents.length})
            </button>
            <button
              className={`ad-section-tab ${activeSection === 'raw' ? 'active' : ''}`}
              onClick={() => setActiveSection('raw')}
            >
              Raw XML
            </button>
          </div>

          {/* Media Files Section */}
          {activeSection === 'media' && (
            <div className="ad-media-section">
              {mediaFiles.length === 0 ? (
                <div className="ad-empty-section">No media files found</div>
              ) : (
                <>
                  {/* Preview Player */}
                  {previewUrl && (
                    <div className="ad-preview-player">
                      <div className="ad-preview-header">
                        <span>Ad Preview</span>
                        <button
                          className="btn-close"
                          onClick={() => setPreviewUrl(null)}
                        >
                          &times;
                        </button>
                      </div>
                      <MiniPlayer
                        url={previewUrl}
                        type="video"
                      />
                    </div>
                  )}

                  {/* Media Files List */}
                  <div className="ad-media-list">
                    {mediaFiles.map((mf, index) => (
                      <div key={index} className="media-file-row">
                        <div className="media-file-info">
                          <span className="media-file-type">
                            {mf.mimeType?.split('/')[1]?.toUpperCase() || 'VIDEO'}
                          </span>
                          {mf.width && mf.height && (
                            <span className="media-file-resolution">
                              {mf.width}x{mf.height}
                            </span>
                          )}
                          {mf.bitrate && (
                            <span className="media-file-bitrate">
                              {Math.round(mf.bitrate / 1000)} kbps
                            </span>
                          )}
                          {mf.fileSize && (
                            <span className="media-file-size">
                              {formatFileSize(mf.fileSize)}
                            </span>
                          )}
                          <span className="media-file-delivery">
                            {mf.delivery}
                          </span>
                        </div>
                        <div className="media-file-actions">
                          {mf.delivery === 'progressive' && (
                            <button
                              className="btn btn-sm btn-preview"
                              onClick={() => setPreviewUrl(mf.url)}
                              title="Preview this media file"
                            >
                              ▶
                            </button>
                          )}
                          <button
                            className="btn btn-sm"
                            onClick={() => handleCopyUrl(mf.url)}
                            title="Copy URL"
                          >
                            📋
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tracking Events Section */}
          {activeSection === 'tracking' && (
            <div className="ad-tracking-section">
              {trackingEvents.length === 0 ? (
                <div className="ad-empty-section">No tracking events found</div>
              ) : (
                <div className="tracking-events-list">
                  {Object.entries(groupedEvents).map(([type, events]) => (
                    <div key={type} className="tracking-group">
                      <div className="tracking-group-header">
                        <span className={`tracking-type ${type}`}>
                          {type}
                        </span>
                        <span className="tracking-count">
                          ({events.length})
                        </span>
                      </div>
                      <div className="tracking-urls">
                        {events.slice(0, 3).map((event, idx) => (
                          <div key={idx} className="tracking-url">
                            <span className="url-text" title={event.url}>
                              {new URL(event.url).hostname}
                            </span>
                            <button
                              className="btn btn-sm"
                              onClick={() => handleCopyUrl(event.url)}
                            >
                              📋
                            </button>
                          </div>
                        ))}
                        {events.length > 3 && (
                          <div className="tracking-more">
                            +{events.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Raw XML Section */}
          {activeSection === 'raw' && (
            <div className="ad-raw-section">
              {ad.rawXml ? (
                <>
                  <div className="raw-xml-actions">
                    <button
                      className="btn btn-sm"
                      onClick={() => {
                        copyToClipboard(ad.rawXml || '');
                        showToast('success', 'XML copied to clipboard');
                      }}
                    >
                      Copy XML
                    </button>
                  </div>
                  <pre className="raw-xml-content">
                    {ad.rawXml.slice(0, 10000)}
                    {ad.rawXml.length > 10000 && '\n\n... (truncated)'}
                  </pre>
                </>
              ) : (
                <div className="ad-empty-section">
                  {ad.isLoading ? 'Loading...' : 'No XML content available'}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

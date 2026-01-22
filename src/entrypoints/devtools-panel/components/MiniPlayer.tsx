/**
 * MiniPlayer Component
 * Compact video preview player for streams using hls.js and dashjs
 * Uses dynamic imports to avoid bundling issues
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type Hls from 'hls.js';
import type dashjs from 'dashjs';

interface MiniPlayerProps {
  url: string;
  type: 'hls' | 'dash' | 'video' | 'mse' | undefined;
  hasDrm?: boolean;
  requestHeaders?: Record<string, string>;
  onError?: (error: string) => void;
}

type PlayerState = 'loading' | 'ready' | 'playing' | 'paused' | 'error' | 'drm-blocked';

// Persistence for collapsed state
const PREVIEW_STATE_KEY = 'pbl_preview_collapsed';
const MAX_STORED_PREVIEWS = 100;

function hashUrl(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) - hash) + url.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function getStoredCollapsedState(url: string): boolean | null {
  try {
    const stored = localStorage.getItem(PREVIEW_STATE_KEY);
    if (stored) {
      const states = JSON.parse(stored) as Record<string, { collapsed: boolean; ts: number }>;
      const key = hashUrl(url);
      return states[key]?.collapsed ?? null;
    }
  } catch {
    // Ignore localStorage errors
  }
  return null;
}

function storeCollapsedState(url: string, collapsed: boolean): void {
  try {
    const stored = localStorage.getItem(PREVIEW_STATE_KEY);
    let states: Record<string, { collapsed: boolean; ts: number }> = {};

    if (stored) {
      states = JSON.parse(stored);
    }

    // Add/update current entry
    states[hashUrl(url)] = { collapsed, ts: Date.now() };

    // Cleanup: keep only most recent entries if over limit
    const entries = Object.entries(states);
    if (entries.length > MAX_STORED_PREVIEWS) {
      entries.sort((a, b) => b[1].ts - a[1].ts);
      states = Object.fromEntries(entries.slice(0, MAX_STORED_PREVIEWS));
    }

    localStorage.setItem(PREVIEW_STATE_KEY, JSON.stringify(states));
  } catch {
    // Ignore localStorage errors
  }
}

export function MiniPlayer({ url, type, hasDrm, requestHeaders, onError }: MiniPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const dashRef = useRef<dashjs.MediaPlayerClass | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const previousUrlRef = useRef<string | null>(null);

  const [playerState, setPlayerState] = useState<PlayerState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isMuted, setIsMuted] = useState(true); // Start muted for autoplay
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);

  // Load collapsed state from localStorage when URL changes
  useEffect(() => {
    if (url && url !== previousUrlRef.current) {
      previousUrlRef.current = url;
      const storedCollapsed = getStoredCollapsedState(url);
      if (storedCollapsed !== null) {
        setIsExpanded(!storedCollapsed);
      } else {
        setIsExpanded(true); // Default to expanded for new streams
      }
    }
  }, [url]);

  // Cleanup players
  const cleanup = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (dashRef.current) {
      dashRef.current.destroy();
      dashRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute('src');
      videoRef.current.load();
    }
  }, []);

  // Handle expand/collapse toggle with persistence
  const handleToggleExpand = useCallback((expanded: boolean) => {
    setIsExpanded(expanded);
    if (url) {
      storeCollapsedState(url, !expanded);
    }
    // Cleanup when collapsing to stop playback
    if (!expanded) {
      cleanup();
      setPlayerState('loading');
    }
  }, [url, cleanup]);

  // Initialize player based on stream type (using dynamic imports)
  useEffect(() => {
    // Only initialize when expanded and video element is available
    if (!url || !videoRef.current || !isExpanded) return;

    // Cleanup previous instance
    cleanup();

    // Check for DRM
    if (hasDrm) {
      setPlayerState('drm-blocked');
      setError('DRM-protected content cannot be played in DevTools');
      return;
    }

    const video = videoRef.current;
    setPlayerState('loading');
    setError(null);

    let cancelled = false;

    const handleError = (errorMsg: string) => {
      if (cancelled) return;
      setPlayerState('error');
      setError(errorMsg);
      onError?.(errorMsg);
    };

    // Async initialization with dynamic imports
    const initPlayer = async () => {
      try {
        // HLS playback
        if (type === 'hls') {
          const HlsModule = await import('hls.js');
          const Hls = HlsModule.default;

          if (cancelled) return;

          if (Hls.isSupported()) {
            const hls = new Hls({
              enableWorker: true,
              lowLatencyMode: false,
              xhrSetup: (xhr: XMLHttpRequest) => {
                // Add custom headers if provided
                if (requestHeaders) {
                  Object.entries(requestHeaders).forEach(([key, value]) => {
                    // Skip certain headers that browsers don't allow
                    if (!['host', 'referer', 'origin', 'cookie'].includes(key.toLowerCase())) {
                      try {
                        xhr.setRequestHeader(key, value);
                      } catch {
                        // Ignore header errors
                      }
                    }
                  });
                }
              },
            });

            hls.loadSource(url);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              if (cancelled) return;
              setPlayerState('ready');
              video.muted = true;
              video.play().catch(() => {
                // Autoplay blocked, that's fine
                setPlayerState('paused');
              });
            });

            hls.on(Hls.Events.ERROR, (_, data) => {
              if (cancelled) return;
              if (data.fatal) {
                switch (data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                    handleError(`Network error: ${data.details}`);
                    break;
                  case Hls.ErrorTypes.MEDIA_ERROR:
                    // Try to recover from media errors
                    hls.recoverMediaError();
                    break;
                  default:
                    handleError(`Playback error: ${data.details}`);
                }
              }
            });

            hlsRef.current = hls;
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS support (Safari)
            video.src = url;
            video.addEventListener('loadedmetadata', () => {
              if (cancelled) return;
              setPlayerState('ready');
              video.muted = true;
              video.play().catch(() => setPlayerState('paused'));
            });
            video.addEventListener('error', () => {
              handleError('Failed to load HLS stream');
            });
          } else {
            handleError('HLS not supported in this browser');
          }
        }
        // DASH playback
        else if (type === 'dash') {
          const dashjsModule = await import('dashjs');
          const dashjs = dashjsModule.default;

          if (cancelled) return;

          try {
            const player = dashjs.MediaPlayer().create();
            player.initialize(video, url, false);
            player.setMute(true);

            // Configure headers if provided
            if (requestHeaders) {
              player.extend('RequestModifier', () => ({
                modifyRequestHeader: (xhr: XMLHttpRequest) => {
                  Object.entries(requestHeaders).forEach(([key, value]) => {
                    if (!['host', 'referer', 'origin', 'cookie'].includes(key.toLowerCase())) {
                      try {
                        xhr.setRequestHeader(key, value);
                      } catch {
                        // Ignore header errors
                      }
                    }
                  });
                  return xhr;
                },
              }), true);
            }

            player.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, () => {
              if (cancelled) return;
              setPlayerState('ready');
              video.play().catch(() => setPlayerState('paused'));
            });

            player.on(dashjs.MediaPlayer.events.ERROR, (e: unknown) => {
              const errorEvent = e as { error?: { message?: string } };
              handleError(`DASH error: ${errorEvent.error?.message || 'Unknown error'}`);
            });

            dashRef.current = player;
          } catch (e) {
            handleError(`Failed to initialize DASH player: ${e}`);
          }
        }
        // Direct video playback
        else {
          video.src = url;
          video.muted = true;
          video.addEventListener('loadedmetadata', () => {
            if (cancelled) return;
            setPlayerState('ready');
            video.play().catch(() => setPlayerState('paused'));
          });
          video.addEventListener('error', () => {
            handleError('Failed to load video');
          });
        }
      } catch (e) {
        handleError(`Failed to load player: ${e}`);
      }
    };

    initPlayer();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [url, type, hasDrm, requestHeaders, cleanup, onError, isExpanded]);

  // Video event listeners - re-attach when expanded
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isExpanded) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => setDuration(video.duration || 0);
    const handlePlay = () => setPlayerState('playing');
    const handlePause = () => setPlayerState('paused');
    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => setIsBuffering(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
    };
  }, [isExpanded]);

  // Toggle play/pause
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  };

  // Toggle mute
  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  // Seek
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const newTime = parseFloat(e.target.value);
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Format time
  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Collapsed state
  if (!isExpanded) {
    return (
      <div className="mini-player collapsed" onClick={() => handleToggleExpand(true)}>
        <span className="mini-player-collapsed-icon">▶</span>
        <span className="mini-player-collapsed-text">Show Preview</span>
      </div>
    );
  }

  return (
    <div className="mini-player" ref={containerRef}>
      {/* Header */}
      <div className="mini-player-header">
        <span className="mini-player-title">Preview</span>
        <button
          className="mini-player-stop"
          onClick={() => handleToggleExpand(false)}
          title="Stop preview"
        >
          ■
        </button>
      </div>

      {/* Video container */}
      <div className="mini-player-video-container">
        {playerState === 'loading' && (
          <div className="mini-player-overlay loading">
            <div className="spinner"></div>
            <span>Loading stream...</span>
          </div>
        )}

        {playerState === 'error' && (
          <div className="mini-player-overlay error">
            <span className="error-icon">⚠️</span>
            <span className="error-text">{error || 'Playback error'}</span>
          </div>
        )}

        {playerState === 'drm-blocked' && (
          <div className="mini-player-overlay drm">
            <span className="drm-icon">🔐</span>
            <span className="drm-text">DRM Protected</span>
            <span className="drm-hint">Cannot preview in DevTools</span>
          </div>
        )}

        {isBuffering && playerState === 'playing' && (
          <div className="mini-player-overlay buffering">
            <div className="spinner small"></div>
          </div>
        )}

        <video
          ref={videoRef}
          className="mini-player-video"
          playsInline
          muted={isMuted}
        />
      </div>

      {/* Controls */}
      {(playerState === 'ready' || playerState === 'playing' || playerState === 'paused') && (
        <div className="mini-player-controls">
          <button className="control-btn play-pause" onClick={togglePlay} title={playerState === 'playing' ? 'Pause' : 'Play'}>
            {playerState === 'playing' ? '⏸' : '▶'}
          </button>

          <div className="progress-container">
            <input
              type="range"
              className="progress-slider"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              disabled={!isFinite(duration) || duration === 0}
            />
            <div className="time-display">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          <button className="control-btn mute" onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
            {isMuted ? '🔇' : '🔊'}
          </button>
        </div>
      )}
    </div>
  );
}

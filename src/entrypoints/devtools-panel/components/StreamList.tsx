/**
 * StreamList Component
 * SOLID: Single Responsibility - Display stream list only
 */

// React not needed with jsx-runtime
import { useStore, useStreamsList } from '../../../store';
import { formatDistanceToNow } from 'date-fns';

export function StreamList() {
  const streams = useStreamsList();
  const { selectedStreamId, selectStream } = useStore();

  if (streams.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📡</div>
        <h3 className="empty-state-title">No Streams Detected</h3>
        <p className="empty-state-text">
          Navigate to a page with HLS or DASH video streams. PlaybackLab will
          automatically detect and display them here.
        </p>
      </div>
    );
  }

  return (
    <div className="stream-list">
      {streams.map((stream) => (
        <div
          key={stream.info.id}
          className={`stream-item ${selectedStreamId === stream.info.id ? 'selected' : ''}`}
          onClick={() => selectStream(stream.info.id)}
        >
          <span className={`stream-type ${stream.info.type}`}>
            {stream.info.type}
          </span>
          <span className="stream-url" title={stream.info.url}>
            {getUrlDisplay(stream.info.url)}
          </span>
          <span className="stream-time">
            {formatDistanceToNow(stream.info.detectedAt, { addSuffix: true })}
          </span>
        </div>
      ))}
    </div>
  );
}

function getUrlDisplay(url: string): string {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    // Show last 2 segments of path + query params indicator
    const segments = path.split('/').filter(Boolean);
    const display = segments.slice(-2).join('/');
    return urlObj.search ? `${display}?...` : display;
  } catch {
    return url.slice(0, 50);
  }
}

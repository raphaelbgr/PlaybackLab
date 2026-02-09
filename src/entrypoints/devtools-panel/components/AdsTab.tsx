/**
 * AdsTab Component - Displays detected video ads (VAST/VMAP)
 * SOLID: Single Responsibility - Only displays ad information
 */

import { useState } from 'react';
import { useAdsList, useStore } from '../../../store';
import { AdCard } from './AdCard';
import type { DetectedStream } from '../../../store';

interface Props {
  stream: DetectedStream | null;
}

export function AdsTab({ stream: _stream }: Props) {
  const ads = useAdsList();
  const { selectedAdId, selectAd } = useStore();
  const [expandedAdId, setExpandedAdId] = useState<string | null>(null);

  // Filter ads (in future could filter by linked stream)
  const filteredAds = ads;

  const handleToggleExpand = (adId: string) => {
    setExpandedAdId(expandedAdId === adId ? null : adId);
    selectAd(expandedAdId === adId ? null : adId);
  };

  if (filteredAds.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📺</div>
        <h3 className="empty-state-title">No Ads Detected</h3>
        <p className="empty-state-text">
          Video ad requests (VAST/VMAP) will appear here when detected.
          <br />
          Navigate to a page with video ads to see them.
        </p>
        <div className="empty-state-hints">
          <p><strong>Supported ad formats:</strong></p>
          <ul>
            <li>VAST 2.0 - 4.2 (Video Ad Serving Template)</li>
            <li>VMAP 1.0.1 (Video Multiple Ad Playlist)</li>
          </ul>
          <p><strong>Detected sources:</strong></p>
          <ul>
            <li>Google IMA SDK / DoubleClick</li>
            <li>FreeWheel</li>
            <li>SpotX</li>
            <li>SpringServe</li>
          </ul>
        </div>
      </div>
    );
  }

  // Group ads by position
  const preRollAds = filteredAds.filter(ad =>
    ad.pods.some(pod => pod.position === 'pre-roll')
  );
  const midRollAds = filteredAds.filter(ad =>
    ad.pods.some(pod => pod.position === 'mid-roll')
  );
  const postRollAds = filteredAds.filter(ad =>
    ad.pods.some(pod => pod.position === 'post-roll')
  );
  return (
    <div className="ads-tab">
      <div className="ads-header">
        <h3>Detected Ads ({filteredAds.length})</h3>
        <div className="ads-summary">
          {preRollAds.length > 0 && (
            <span className="ad-badge pre-roll">{preRollAds.length} Pre-roll</span>
          )}
          {midRollAds.length > 0 && (
            <span className="ad-badge mid-roll">{midRollAds.length} Mid-roll</span>
          )}
          {postRollAds.length > 0 && (
            <span className="ad-badge post-roll">{postRollAds.length} Post-roll</span>
          )}
        </div>
      </div>

      <div className="ads-list">
        {filteredAds.map((ad) => (
          <AdCard
            key={ad.id}
            ad={ad}
            isExpanded={expandedAdId === ad.id}
            isSelected={selectedAdId === ad.id}
            onToggle={() => handleToggleExpand(ad.id)}
          />
        ))}
      </div>
    </div>
  );
}

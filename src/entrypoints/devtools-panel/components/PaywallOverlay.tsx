/**
 * PaywallOverlay Component
 * Full-screen overlay gating the DevTools panel after trial expires.
 */

import { useLicense } from '../../../shared/hooks/useLicense';
import { PRICE_DISPLAY, TRIAL_DAYS } from '../../../shared/license';

const FEATURES = [
  'Auto-detect HLS & DASH streams',
  'Full manifest parsing & variant ladder',
  'DRM & encryption inspection',
  'Video overlays on page',
  'Network request inspector',
  'Export streams as JSON & cURL',
  '40+ CDN & platform detection',
];

export function PaywallOverlay() {
  const { license, startTrial, openPayment, openLogin } = useLicense();
  if (!license) return null;

  const isExpired = license.status === 'trial_expired';
  const isNoTrial = license.status === 'no_trial';
  const isCanceled = license.status === 'canceled';

  let heading = 'Try PlaybackLab free for 7 days';
  let subtitle = 'No payment required. Just sign in with Google.';

  if (isExpired) {
    heading = 'Your free trial has ended';
    subtitle = `Subscribe to keep using PlaybackLab's full debugging toolkit.`;
  } else if (isCanceled) {
    heading = 'Subscription canceled';
    subtitle = 'Resubscribe to regain access to all features.';
  }

  return (
    <div className="paywall-overlay">
      <div className="paywall-card">
        <div className="paywall-icon">
          <img
            src={chrome.runtime.getURL('/icon-128.png')}
            alt="PlaybackLab"
            width={64}
            height={64}
            style={{ borderRadius: 12 }}
          />
        </div>

        <h2 className="paywall-title">{heading}</h2>
        <p className="paywall-subtitle">{subtitle}</p>

        <ul className="paywall-features">
          {FEATURES.map((feat) => (
            <li key={feat}>
              <span className="paywall-check">&#10003;</span>
              {feat}
            </li>
          ))}
        </ul>

        <div className="paywall-actions">
          {isNoTrial ? (
            <button className="paywall-btn-primary" onClick={startTrial}>
              Sign in with Google
            </button>
          ) : (
            <>
              <button className="paywall-btn-primary" onClick={openPayment}>
                Subscribe &mdash; {PRICE_DISPLAY}
              </button>
              <button className="paywall-btn-secondary" onClick={openLogin}>
                Already subscribed? Log in
              </button>
            </>
          )}
        </div>

        <p className="paywall-footer">
          Powered by Stripe. Cancel anytime.
        </p>
      </div>
    </div>
  );
}

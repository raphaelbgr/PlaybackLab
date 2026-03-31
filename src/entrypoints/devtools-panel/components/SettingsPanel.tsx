/**
 * Settings Panel Component
 * Configure PlaybackLab preferences
 */

import { useSettings, type AppSettings } from '../../../shared/hooks/useSettings';
import { DEFAULT_SHORTCUTS, formatShortcut } from '../../../shared/hooks/useKeyboardShortcuts';
import { useLicense } from '../../../shared/hooks/useLicense';
import { PRICE_DISPLAY } from '../../../shared/license';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPanel({ isOpen, onClose }: Props) {
  const { settings, saveSettings, resetSettings, isLoaded } = useSettings();
  const { license, openPayment, openLogin, refreshLicense } = useLicense();

  if (!isOpen) return null;

  const handleChange = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    saveSettings({ [key]: value });
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="btn-icon" onClick={onClose}>×</button>
        </div>

        {!isLoaded ? (
          <div className="settings-loading">Loading settings...</div>
        ) : (
          <div className="settings-content">
            {/* UI Preferences */}
            <section className="settings-section">
              <h3>User Interface</h3>

              <div className="setting-item">
                <div className="setting-info">
                  <label>Theme</label>
                  <span className="setting-description">Choose your preferred color scheme</span>
                </div>
                <select
                  value={settings.theme}
                  onChange={(e) => handleChange('theme', e.target.value as AppSettings['theme'])}
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                  <option value="system">System</option>
                </select>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <label>Compact Mode</label>
                  <span className="setting-description">Reduce padding and spacing</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.compactMode}
                  onChange={(e) => handleChange('compactMode', e.target.checked)}
                />
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <label>Show Timestamps</label>
                  <span className="setting-description">Display time for detected streams</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.showTimestamps}
                  onChange={(e) => handleChange('showTimestamps', e.target.checked)}
                />
              </div>
            </section>

            {/* Detection Settings */}
            <section className="settings-section">
              <h3>Stream Detection</h3>

              <div className="setting-item">
                <div className="setting-info">
                  <label>Auto-detect Streams</label>
                  <span className="setting-description">Automatically detect HLS/DASH streams</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoDetectStreams}
                  onChange={(e) => handleChange('autoDetectStreams', e.target.checked)}
                />
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <label>Filter Ad Segments</label>
                  <span className="setting-description">Hide ad-related network requests</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.filterAdSegments}
                  onChange={(e) => handleChange('filterAdSegments', e.target.checked)}
                />
              </div>
            </section>

            {/* Metrics Settings */}
            <section className="settings-section">
              <h3>Metrics Collection</h3>

              <div className="setting-item">
                <div className="setting-info">
                  <label>Collection Interval</label>
                  <span className="setting-description">How often to collect metrics (ms)</span>
                </div>
                <select
                  value={settings.metricsInterval}
                  onChange={(e) => handleChange('metricsInterval', Number(e.target.value))}
                >
                  <option value={500}>500ms (High frequency)</option>
                  <option value={1000}>1000ms (Default)</option>
                  <option value={2000}>2000ms (Low frequency)</option>
                </select>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <label>History Size</label>
                  <span className="setting-description">Number of samples to keep</span>
                </div>
                <select
                  value={settings.metricsHistorySize}
                  onChange={(e) => handleChange('metricsHistorySize', Number(e.target.value))}
                >
                  <option value={50}>50 samples</option>
                  <option value={100}>100 samples</option>
                  <option value={200}>200 samples</option>
                  <option value={500}>500 samples</option>
                </select>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <label>Auto-start Collection</label>
                  <span className="setting-description">Start collecting when stream detected</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoStartMetrics}
                  onChange={(e) => handleChange('autoStartMetrics', e.target.checked)}
                />
              </div>
            </section>

            {/* Export Settings */}
            <section className="settings-section">
              <h3>Export</h3>

              <div className="setting-item">
                <div className="setting-info">
                  <label>Default Format</label>
                  <span className="setting-description">Preferred export format</span>
                </div>
                <select
                  value={settings.defaultExportFormat}
                  onChange={(e) => handleChange('defaultExportFormat', e.target.value as AppSettings['defaultExportFormat'])}
                >
                  <option value="json">JSON</option>
                  <option value="har">HAR</option>
                  <option value="csv">CSV</option>
                </select>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <label>Include Raw Manifest</label>
                  <span className="setting-description">Include full manifest content in exports</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.includeRawManifest}
                  onChange={(e) => handleChange('includeRawManifest', e.target.checked)}
                />
              </div>
            </section>

            {/* Notifications */}
            <section className="settings-section">
              <h3>Notifications</h3>

              <div className="setting-item">
                <div className="setting-info">
                  <label>Show Notifications</label>
                  <span className="setting-description">Enable desktop notifications</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.showNotifications}
                  onChange={(e) => handleChange('showNotifications', e.target.checked)}
                />
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <label>Notify on Errors</label>
                  <span className="setting-description">Alert when playback errors occur</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.notifyOnError}
                  onChange={(e) => handleChange('notifyOnError', e.target.checked)}
                  disabled={!settings.showNotifications}
                />
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <label>Notify on Quality Drop</label>
                  <span className="setting-description">Alert when quality decreases</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.notifyOnQualityDrop}
                  onChange={(e) => handleChange('notifyOnQualityDrop', e.target.checked)}
                  disabled={!settings.showNotifications}
                />
              </div>
            </section>

            {/* Keyboard Shortcuts */}
            <section className="settings-section">
              <h3>Keyboard Shortcuts</h3>
              <div className="shortcuts-list">
                {DEFAULT_SHORTCUTS.map((shortcut) => (
                  <div key={shortcut.key + (shortcut.ctrl ? 'ctrl' : '')} className="shortcut-item">
                    <span className="shortcut-description">{shortcut.description}</span>
                    <kbd className="shortcut-key">{formatShortcut(shortcut)}</kbd>
                  </div>
                ))}
              </div>
            </section>

            {/* Account & Subscription */}
            <section className="settings-section">
              <h3>Account & Subscription</h3>
              <div className="account-section">
                {license?.paid ? (
                  <>
                    <div className="account-status">
                      <span className="trial-badge pro">PRO</span>
                      {license.email && <span className="account-email">{license.email}</span>}
                    </div>
                    <p style={{ color: '#888', fontSize: '12px', margin: '4px 0 8px 0' }}>
                      {license.subscriptionStatus === 'past_due'
                        ? 'Payment past due — please update your billing info.'
                        : 'You have full access to all features.'}
                    </p>
                    <button className="btn btn-secondary" onClick={openPayment} style={{ fontSize: '12px' }}>
                      Manage Subscription
                    </button>
                  </>
                ) : license?.status === 'trial_active' ? (
                  <>
                    <div className="account-status">
                      <span className={`trial-badge${license.trialDaysRemaining <= 2 ? ' expiring' : ''}`}>
                        {license.trialDaysRemaining}d trial remaining
                      </span>
                    </div>
                    <p style={{ color: '#888', fontSize: '12px', margin: '4px 0 8px 0' }}>
                      Subscribe now to keep access after your trial ends.
                    </p>
                    <button className="btn btn-primary" onClick={openPayment} style={{ fontSize: '12px' }}>
                      Subscribe &mdash; {PRICE_DISPLAY}
                    </button>
                  </>
                ) : (
                  <>
                    <p style={{ color: '#888', fontSize: '12px', margin: '0 0 8px 0' }}>
                      {license?.status === 'trial_expired'
                        ? 'Your trial has expired. Subscribe to regain access.'
                        : 'Subscribe to unlock all features.'}
                    </p>
                    <button className="btn btn-primary" onClick={openPayment} style={{ fontSize: '12px' }}>
                      Subscribe &mdash; {PRICE_DISPLAY}
                    </button>
                  </>
                )}
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={openLogin}
                    style={{ fontSize: '11px' }}
                  >
                    Log in
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={refreshLicense}
                    style={{ fontSize: '11px' }}
                    title="Re-check license from server"
                  >
                    Refresh
                  </button>
                </div>
              </div>
            </section>

            {/* Support */}
            <section className="settings-section">
              <h3>Support PlaybackLab</h3>
              <p style={{ color: '#888', fontSize: '12px', margin: '0 0 8px 0' }}>
                PlaybackLab is free and open source. If it helps your workflow, consider supporting development.
              </p>
              <div className="support-links" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <a
                  href="https://github.com/sponsors/raphaelbgr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                  style={{ fontSize: '12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  GitHub Sponsors
                </a>
                <a
                  href="https://ko-fi.com/raphaelbgr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                  style={{ fontSize: '12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  Ko-fi
                </a>
              </div>
            </section>

            {/* Advanced */}
            <section className="settings-section">
              <h3>Advanced</h3>

              <div className="setting-item">
                <div className="setting-info">
                  <label>Debug Mode</label>
                  <span className="setting-description">Show additional debug information</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.debugMode}
                  onChange={(e) => handleChange('debugMode', e.target.checked)}
                />
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <label>Experimental Features</label>
                  <span className="setting-description">Enable features in development</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.experimentalFeatures}
                  onChange={(e) => handleChange('experimentalFeatures', e.target.checked)}
                />
              </div>
            </section>
          </div>
        )}

        <div className="settings-footer">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span style={{ fontSize: '11px', color: '#666' }}>
              PlaybackLab v0.1.0 &middot;{' '}
              <a
                href="https://github.com/raphaelbgr/PlaybackLab"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#4fc3f7', textDecoration: 'none' }}
              >
                Open Source
              </a>
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={resetSettings}>
                Reset to Defaults
              </button>
              <button className="btn btn-primary" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

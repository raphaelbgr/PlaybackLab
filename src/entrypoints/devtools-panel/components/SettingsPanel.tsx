/**
 * Settings Panel Component
 * Configure PlaybackLab preferences
 */

import { useSettings, type AppSettings } from '../../../shared/hooks/useSettings';
import { DEFAULT_SHORTCUTS, formatShortcut } from '../../../shared/hooks/useKeyboardShortcuts';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPanel({ isOpen, onClose }: Props) {
  const { settings, saveSettings, resetSettings, isLoaded } = useSettings();

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
          <button className="btn btn-secondary" onClick={resetSettings}>
            Reset to Defaults
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Settings Hook with Chrome Storage Persistence
 * Persists user preferences across sessions
 */

import { useState, useEffect, useCallback } from 'react';

export interface AppSettings {
  // UI Preferences
  theme: 'dark' | 'light' | 'system';
  compactMode: boolean;
  showTimestamps: boolean;

  // Detection Settings
  autoDetectStreams: boolean;
  detectOnPageLoad: boolean;
  filterAdSegments: boolean;

  // Metrics Settings
  metricsInterval: number; // ms
  metricsHistorySize: number;
  autoStartMetrics: boolean;

  // Network Settings
  captureAllRequests: boolean;
  maxNetworkRequests: number;

  // Export Settings
  defaultExportFormat: 'json' | 'har' | 'csv';
  includeRawManifest: boolean;

  // Notifications
  showNotifications: boolean;
  notifyOnError: boolean;
  notifyOnQualityDrop: boolean;

  // Advanced
  debugMode: boolean;
  experimentalFeatures: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  compactMode: false,
  showTimestamps: true,
  autoDetectStreams: true,
  detectOnPageLoad: true,
  filterAdSegments: false,
  metricsInterval: 1000,
  metricsHistorySize: 100,
  autoStartMetrics: false,
  captureAllRequests: false,
  maxNetworkRequests: 100,
  defaultExportFormat: 'json',
  includeRawManifest: true,
  showNotifications: true,
  notifyOnError: true,
  notifyOnQualityDrop: false,
  debugMode: false,
  experimentalFeatures: false,
};

const STORAGE_KEY = 'playbacklab_settings';

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings from Chrome storage
  useEffect(() => {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      if (result[STORAGE_KEY]) {
        setSettings({ ...DEFAULT_SETTINGS, ...result[STORAGE_KEY] });
      }
      setIsLoaded(true);
    });
  }, []);

  // Save settings to Chrome storage
  const saveSettings = useCallback((newSettings: Partial<AppSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    chrome.storage.local.set({ [STORAGE_KEY]: updated });
  }, [settings]);

  // Reset to defaults
  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    chrome.storage.local.set({ [STORAGE_KEY]: DEFAULT_SETTINGS });
  }, []);

  // Get a specific setting
  const getSetting = useCallback(<K extends keyof AppSettings>(key: K): AppSettings[K] => {
    return settings[key];
  }, [settings]);

  // Update a specific setting
  const setSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    saveSettings({ [key]: value });
  }, [saveSettings]);

  return {
    settings,
    isLoaded,
    saveSettings,
    resetSettings,
    getSetting,
    setSetting,
  };
}

// Export individual setting hooks for convenience
export function useTheme() {
  const { getSetting, setSetting } = useSettings();
  return [getSetting('theme'), (theme: AppSettings['theme']) => setSetting('theme', theme)] as const;
}

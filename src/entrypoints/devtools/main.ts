/**
 * DevTools Entry Point
 * Creates the PlaybackLab panel in Chrome DevTools
 */

chrome.devtools.panels.create(
  'PlaybackLab',
  '/icon-32.png',
  '/devtools-panel.html',
  (panel) => {
    console.log('[PlaybackLab] DevTools panel created');

    // Panel shown callback
    panel.onShown.addListener((window) => {
      // Send message to panel that it's visible
      window.postMessage({ type: 'PANEL_SHOWN' }, '*');
    });

    // Panel hidden callback
    panel.onHidden.addListener(() => {
      // Could pause data collection when hidden
    });
  }
);

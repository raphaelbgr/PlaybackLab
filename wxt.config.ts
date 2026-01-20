import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  outDir: 'dist',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'PlaybackLab - HLS & DASH Stream Debugger',
    description: 'Test and debug HLS, DASH, and DRM video streams. Analyze manifests, monitor quality levels, and visualize playback metrics.',
    permissions: [
      'webRequest',
      'storage',
      'tabs',
      'activeTab',
    ],
    host_permissions: ['<all_urls>'],
    devtools_page: 'devtools.html',
  },
  // Dev server configuration
  dev: {
    server: {
      port: 8565,
    },
  },
  vite: () => ({
    server: {
      port: 8566,
    },
  }),
  webExt: {
    startUrls: ['https://bitmovin.com/demos/stream-test'],
  },
});

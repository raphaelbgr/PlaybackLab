import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  outDir: 'dist',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'PlaybackLab - HLS & DASH Stream Debugger',
    description: 'Inspect HLS & DASH video streams in DevTools. Analyze manifests, codecs, quality tiers, DRM, and playback metrics in real time.',
    icons: {
      '16': 'icon-16.png',
      '32': 'icon-32.png',
      '48': 'icon-48.png',
      '128': 'icon-128.png',
    },
    permissions: [
      'webRequest',
      'storage',
      'tabs',
      'activeTab',
      'scripting',
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

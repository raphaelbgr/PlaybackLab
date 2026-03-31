# Testing PlaybackLab Extension

## Quick Test Steps

1. **Load the extension in Chrome:**
   - Open `chrome://extensions`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select folder: `~/git\Stream-Lens\dist\chrome-mv3`

2. **Test on HLS.js demo page:**
   - Navigate to: https://hlsjs.video-dev.org/demo/
   - Open DevTools (F12)
   - Go to "PlaybackLab" tab in DevTools

3. **Test the scanner:**
   - Click "Scan Page" button
   - Should find: `https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8`

4. **Check console for debug logs:**
   - In browser Console tab, filter for `[PlaybackLab`
   - Should see scanner debug messages

## Expected Results

- Content script should log: `[PlaybackLab] Content script loaded`
- Scan should find the HLS stream URL
- Stream card should appear in the panel

## Test URLs

These URLs should be detected:
- HLS: `https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8`
- DASH: `https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd`

These URLs should be BLOCKED (ads):
- `https://imasdk.googleapis.com/js/sdkloader/ima3.m3u8`
- `https://ad.doubleclick.net/video.m3u8`

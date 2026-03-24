# Real-Time Video Playback Metrics: Capture and Visualization

> Research document for implementing real-time video stream metrics in a Chrome extension.
> Last updated: January 2026

---

## Table of Contents

1. [Available Metrics Overview](#1-available-metrics-overview)
2. [Accessing Video Element Properties in JavaScript](#2-accessing-video-element-properties-in-javascript)
3. [Monitoring ABR Quality Switches](#3-monitoring-abr-quality-switches)
4. [Detecting Buffering and Stall Events](#4-detecting-buffering-and-stall-events)
5. [Visualization Libraries for Extensions](#5-visualization-libraries-for-extensions)
6. [How Existing Players Expose Debug Info](#6-how-existing-players-expose-debug-info)
7. [Chrome Media Internals Access](#7-chrome-media-internals-access)
8. [Complete Implementation Examples](#8-complete-implementation-examples)

---

## 1. Available Metrics Overview

### Core Video Metrics

| Category | Metric | Source | Update Frequency |
|----------|--------|--------|------------------|
| **Playback** | Current time, duration, playback rate | HTMLVideoElement | Per frame |
| **Quality** | Resolution (width x height) | HTMLVideoElement | On change |
| **Frames** | Total, dropped, corrupted frames | VideoPlaybackQuality | Per frame |
| **Buffer** | Buffer ranges, buffer level | HTMLMediaElement.buffered | Continuous |
| **Network** | Bitrate, bandwidth estimate | Player-specific API | Per segment |
| **Latency** | Live latency, drift | Player-specific API | Per segment |
| **ABR** | Current level, available levels | Player-specific API | On switch |

### Player-Specific Metrics

**HLS.js Additional Metrics:**
- Estimated bandwidth (`hls.bandwidthEstimate`)
- Current/next level (`hls.currentLevel`, `hls.nextLevel`)
- Live latency and drift (`hls.latency`, `hls.drift`)
- In-flight fragments (`hls.inFlightFragments`)

**dash.js Additional Metrics:**
- Current buffer level per media type
- Representation switches
- HTTP request metrics
- Dropped frames count

**Shaka Player Additional Metrics:**
- Manifest timing (`manifestTimeSeconds`)
- DRM timing (`drmTimeSeconds`)
- License timing (`licenseTime`)
- Stalls detected, gaps jumped
- Switch history, state history

---

## 2. Accessing Video Element Properties in JavaScript

### HTMLVideoElement Core Properties

```javascript
const video = document.querySelector('video');

// Dimensions
const intrinsicWidth = video.videoWidth;   // Original video width
const intrinsicHeight = video.videoHeight; // Original video height
const displayWidth = video.clientWidth;    // Rendered width
const displayHeight = video.clientHeight;  // Rendered height

// Playback state
const currentTime = video.currentTime;     // Current position (seconds)
const duration = video.duration;           // Total duration (seconds)
const playbackRate = video.playbackRate;   // Speed (1.0 = normal)
const paused = video.paused;               // Is paused?
const ended = video.ended;                 // Has ended?
const readyState = video.readyState;       // 0-4 (HAVE_NOTHING to HAVE_ENOUGH_DATA)
const networkState = video.networkState;   // 0-3 (NETWORK_EMPTY to NETWORK_NO_SOURCE)

// Volume
const volume = video.volume;               // 0.0 to 1.0
const muted = video.muted;                 // Is muted?
```

### VideoPlaybackQuality API

The `getVideoPlaybackQuality()` method provides frame-level metrics:

```javascript
function getFrameMetrics(video) {
    const quality = video.getVideoPlaybackQuality();

    return {
        // Total frames created and dropped
        totalVideoFrames: quality.totalVideoFrames,

        // Frames dropped due to performance issues
        droppedVideoFrames: quality.droppedVideoFrames,

        // Frames corrupted during decode
        corruptedVideoFrames: quality.corruptedVideoFrames,

        // High-resolution timestamp when object was created
        creationTime: quality.creationTime,

        // Calculated metrics
        dropRate: (quality.droppedVideoFrames / quality.totalVideoFrames * 100).toFixed(2) + '%',
        fps: calculateFPS(quality)
    };
}

// Calculate real-time FPS
let lastFrameCount = 0;
let lastTime = performance.now();

function calculateFPS(quality) {
    const now = performance.now();
    const elapsed = (now - lastTime) / 1000;
    const framesDelta = quality.totalVideoFrames - lastFrameCount;

    lastFrameCount = quality.totalVideoFrames;
    lastTime = now;

    return (framesDelta / elapsed).toFixed(1);
}
```

### Buffer Range Analysis

```javascript
function getBufferInfo(video) {
    const buffered = video.buffered;
    const currentTime = video.currentTime;

    // Find current buffer range
    let currentBufferEnd = 0;
    let bufferRanges = [];

    for (let i = 0; i < buffered.length; i++) {
        const start = buffered.start(i);
        const end = buffered.end(i);
        bufferRanges.push({ start, end, duration: end - start });

        if (currentTime >= start && currentTime <= end) {
            currentBufferEnd = end;
        }
    }

    return {
        // How much is buffered ahead of playhead
        bufferAhead: Math.max(0, currentBufferEnd - currentTime),

        // Total buffered duration
        totalBuffered: bufferRanges.reduce((sum, r) => sum + r.duration, 0),

        // Number of separate buffer ranges (gaps indicate seeks/stalls)
        rangeCount: buffered.length,

        // Detailed ranges for visualization
        ranges: bufferRanges
    };
}
```

### Complete Metrics Collector Class

```javascript
class VideoMetricsCollector {
    constructor(videoElement) {
        this.video = videoElement;
        this.metrics = [];
        this.maxSamples = 300; // 5 minutes at 1Hz
        this.lastQuality = null;
        this.lastTime = performance.now();
        this.lastFrames = 0;
    }

    collect() {
        const now = performance.now();
        const quality = this.video.getVideoPlaybackQuality();
        const buffered = this.video.buffered;

        // Calculate instantaneous FPS
        const elapsed = (now - this.lastTime) / 1000;
        const framesDelta = quality.totalVideoFrames - this.lastFrames;
        const fps = elapsed > 0 ? framesDelta / elapsed : 0;

        this.lastTime = now;
        this.lastFrames = quality.totalVideoFrames;

        // Find buffer ahead
        let bufferAhead = 0;
        for (let i = 0; i < buffered.length; i++) {
            if (this.video.currentTime >= buffered.start(i) &&
                this.video.currentTime <= buffered.end(i)) {
                bufferAhead = buffered.end(i) - this.video.currentTime;
                break;
            }
        }

        const sample = {
            timestamp: now,
            currentTime: this.video.currentTime,
            duration: this.video.duration,
            resolution: {
                width: this.video.videoWidth,
                height: this.video.videoHeight
            },
            frames: {
                total: quality.totalVideoFrames,
                dropped: quality.droppedVideoFrames,
                corrupted: quality.corruptedVideoFrames,
                fps: fps.toFixed(1)
            },
            buffer: {
                ahead: bufferAhead,
                ranges: buffered.length
            },
            state: {
                paused: this.video.paused,
                readyState: this.video.readyState,
                networkState: this.video.networkState
            }
        };

        this.metrics.push(sample);

        // Keep rolling window
        if (this.metrics.length > this.maxSamples) {
            this.metrics.shift();
        }

        return sample;
    }

    getHistory() {
        return this.metrics;
    }

    clear() {
        this.metrics = [];
    }
}
```

---

## 3. Monitoring ABR Quality Switches

### HLS.js Quality Monitoring

```javascript
// Initialize HLS.js with event monitoring
const hls = new Hls({
    debug: false,
    enableWorker: true
});

hls.attachMedia(video);
hls.loadSource(streamUrl);

// Track quality switches
let qualityHistory = [];

hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
    const level = hls.levels[data.level];
    qualityHistory.push({
        timestamp: performance.now(),
        levelIndex: data.level,
        width: level.width,
        height: level.height,
        bitrate: level.bitrate,
        reason: 'abr_switch'
    });
    console.log(`Quality switched to ${level.width}x${level.height} @ ${level.bitrate}bps`);
});

hls.on(Hls.Events.LEVEL_LOADING, (event, data) => {
    console.log(`Loading level ${data.level}`);
});

// Monitor fragment loading for bandwidth estimation
hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
    const stats = data.frag.stats;
    const loadTime = stats.loading.end - stats.loading.start;
    const size = stats.total;
    const bandwidth = (size * 8) / (loadTime / 1000); // bits per second

    console.log(`Fragment loaded: ${size} bytes in ${loadTime}ms (${(bandwidth/1e6).toFixed(2)} Mbps)`);
});

// Access current ABR state
function getHLSMetrics() {
    return {
        currentLevel: hls.currentLevel,
        nextLevel: hls.nextLevel,
        autoLevelEnabled: hls.autoLevelEnabled,
        bandwidthEstimate: hls.bandwidthEstimate,
        levels: hls.levels.map((l, i) => ({
            index: i,
            width: l.width,
            height: l.height,
            bitrate: l.bitrate,
            codecs: l.codecs
        })),
        latency: hls.latency,
        targetLatency: hls.targetLatency,
        drift: hls.drift
    };
}
```

### dash.js Quality Monitoring

```javascript
const player = dashjs.MediaPlayer().create();
player.initialize(video, manifestUrl, true);

// Quality switch events
player.on(dashjs.MediaPlayer.events.QUALITY_CHANGE_REQUESTED, (e) => {
    console.log(`Quality change requested: ${e.mediaType} from ${e.oldQuality} to ${e.newQuality}`);
});

player.on(dashjs.MediaPlayer.events.QUALITY_CHANGE_RENDERED, (e) => {
    console.log(`Quality change rendered: ${e.mediaType} now at ${e.newQuality}`);
});

// Get current quality info
function getDashMetrics() {
    const dashMetrics = player.getDashMetrics();
    const videoQuality = player.getQualityFor('video');
    const audioQuality = player.getQualityFor('audio');
    const bitrateList = player.getBitrateInfoListFor('video');

    return {
        video: {
            currentQuality: videoQuality,
            currentBitrate: bitrateList[videoQuality]?.bitrate,
            bufferLevel: dashMetrics.getCurrentBufferLevel('video'),
            availableBitrates: bitrateList.map(b => ({
                quality: b.qualityIndex,
                bitrate: b.bitrate,
                width: b.width,
                height: b.height
            }))
        },
        audio: {
            currentQuality: audioQuality,
            bufferLevel: dashMetrics.getCurrentBufferLevel('audio')
        },
        settings: {
            abrEnabled: player.getSettings().streaming.abr.autoSwitchBitrate.video
        }
    };
}
```

### Shaka Player Quality Monitoring

```javascript
const player = new shaka.Player(video);
await player.load(manifestUrl);

// Quality switch tracking
player.addEventListener('adaptation', (event) => {
    console.log('Adaptation event:', event);
});

player.addEventListener('variantchanged', (event) => {
    const variant = player.getVariantTracks().find(t => t.active);
    console.log(`Variant changed to ${variant.width}x${variant.height} @ ${variant.bandwidth}bps`);
});

// Get comprehensive stats
function getShakaStats() {
    const stats = player.getStats();
    const bufferedInfo = player.getBufferedInfo();
    const variants = player.getVariantTracks();

    return {
        resolution: {
            width: stats.width,
            height: stats.height
        },
        frames: {
            decoded: stats.decodedFrames,
            dropped: stats.droppedFrames,
            corrupted: stats.corruptedFrames
        },
        timing: {
            playTime: stats.playTime,
            pauseTime: stats.pauseTime,
            bufferingTime: stats.bufferingTime,
            loadLatency: stats.loadLatency,
            liveLatency: stats.liveLatency
        },
        network: {
            estimatedBandwidth: stats.estimatedBandwidth,
            streamBandwidth: stats.streamBandwidth,
            bytesDownloaded: stats.bytesDownloaded
        },
        quality: {
            stallsDetected: stats.stallsDetected,
            gapsJumped: stats.gapsJumped,
            switchHistory: stats.switchHistory
        },
        buffer: bufferedInfo,
        availableVariants: variants.map(v => ({
            id: v.id,
            active: v.active,
            width: v.width,
            height: v.height,
            bandwidth: v.bandwidth,
            codecs: v.codecs
        }))
    };
}
```

---

## 4. Detecting Buffering and Stall Events

### Native Video Element Events

```javascript
class BufferingDetector {
    constructor(video) {
        this.video = video;
        this.isBuffering = false;
        this.bufferingEvents = [];
        this.currentBufferingStart = null;

        this.setupListeners();
    }

    setupListeners() {
        // Primary buffering indicator
        this.video.addEventListener('waiting', () => {
            this.onBufferingStart('waiting');
        });

        // Playback resumed
        this.video.addEventListener('playing', () => {
            this.onBufferingEnd('playing');
        });

        // Also check canplay and canplaythrough
        this.video.addEventListener('canplay', () => {
            this.onBufferingEnd('canplay');
        });

        this.video.addEventListener('canplaythrough', () => {
            this.onBufferingEnd('canplaythrough');
        });

        // Stalled event (no data coming in)
        this.video.addEventListener('stalled', () => {
            console.log('Stream stalled - no data being received');
            this.onBufferingStart('stalled');
        });

        // Progress event (data is loading)
        this.video.addEventListener('progress', () => {
            // Can use to track download progress
        });

        // Seeking events
        this.video.addEventListener('seeking', () => {
            this.onBufferingStart('seeking');
        });

        this.video.addEventListener('seeked', () => {
            this.onBufferingEnd('seeked');
        });

        // Error handling
        this.video.addEventListener('error', (e) => {
            console.error('Video error:', this.video.error);
        });
    }

    onBufferingStart(reason) {
        if (!this.isBuffering) {
            this.isBuffering = true;
            this.currentBufferingStart = performance.now();
            console.log(`Buffering started (${reason})`);
        }
    }

    onBufferingEnd(reason) {
        if (this.isBuffering) {
            const duration = performance.now() - this.currentBufferingStart;
            this.bufferingEvents.push({
                start: this.currentBufferingStart,
                duration: duration,
                endReason: reason
            });
            this.isBuffering = false;
            console.log(`Buffering ended (${reason}) - Duration: ${duration.toFixed(0)}ms`);
        }
    }

    getStats() {
        const totalBufferingTime = this.bufferingEvents.reduce((sum, e) => sum + e.duration, 0);
        return {
            isCurrentlyBuffering: this.isBuffering,
            totalEvents: this.bufferingEvents.length,
            totalBufferingTime: totalBufferingTime,
            averageBufferingDuration: totalBufferingTime / (this.bufferingEvents.length || 1),
            events: this.bufferingEvents
        };
    }
}
```

### HLS.js Buffering Events

```javascript
// HLS.js specific buffering detection
hls.on(Hls.Events.ERROR, (event, data) => {
    if (data.details === 'bufferStalledError') {
        console.log('Buffer stalled:', data);
    }
    if (data.details === 'bufferNudgeOnStall') {
        console.log('Buffer nudge on stall');
    }
});

hls.on(Hls.Events.BUFFER_APPENDING, (event, data) => {
    console.log('Appending to buffer:', data.type);
});

hls.on(Hls.Events.BUFFER_APPENDED, (event, data) => {
    console.log('Buffer appended:', data.type);
});

hls.on(Hls.Events.BUFFER_FLUSHING, (event, data) => {
    console.log('Buffer flushing');
});

// Check if buffered to end
function checkBufferHealth() {
    return {
        bufferedToEnd: hls.bufferedToEnd,
        bufferingEnabled: hls.bufferingEnabled
    };
}
```

### MediaSource Extensions Buffer Monitoring

```javascript
// For MSE-based players, monitor SourceBuffer events
function monitorSourceBuffer(mediaSource) {
    mediaSource.addEventListener('sourceopen', () => {
        console.log('MediaSource opened');

        // Monitor each source buffer
        for (let i = 0; i < mediaSource.sourceBuffers.length; i++) {
            const sb = mediaSource.sourceBuffers[i];

            sb.addEventListener('updatestart', () => {
                console.log('SourceBuffer update started');
            });

            sb.addEventListener('update', () => {
                console.log('SourceBuffer updated');
            });

            sb.addEventListener('updateend', () => {
                console.log('SourceBuffer update ended');
            });

            sb.addEventListener('error', (e) => {
                console.error('SourceBuffer error:', e);
            });
        }
    });
}
```

---

## 5. Visualization Libraries for Extensions

### Recommended Libraries

| Library | Size | Real-time | Ease of Use | Best For |
|---------|------|-----------|-------------|----------|
| **Chart.js** | ~60KB | Good | Excellent | General purpose |
| **uPlot** | ~35KB | Excellent | Good | High-performance time series |
| **Sparklines** | ~5KB | Good | Excellent | Compact mini charts |
| **D3.js** | ~230KB | Excellent | Complex | Custom visualizations |
| **Plotly.js** | ~3MB | Good | Good | Scientific charts |

### Chart.js Implementation for Extensions

```javascript
// Chart.js is ideal for Chrome extensions due to good size/feature balance

class MetricsChart {
    constructor(canvasId, maxDataPoints = 60) {
        this.maxDataPoints = maxDataPoints;
        this.chart = new Chart(document.getElementById(canvasId), {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Buffer (s)',
                        data: [],
                        borderColor: '#4CAF50',
                        backgroundColor: 'rgba(76, 175, 80, 0.1)',
                        fill: true,
                        tension: 0.4,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Bitrate (Mbps)',
                        data: [],
                        borderColor: '#2196F3',
                        backgroundColor: 'rgba(33, 150, 243, 0.1)',
                        fill: true,
                        tension: 0.4,
                        yAxisID: 'y1'
                    },
                    {
                        label: 'Dropped Frames',
                        data: [],
                        borderColor: '#f44336',
                        backgroundColor: 'rgba(244, 67, 54, 0.1)',
                        fill: false,
                        tension: 0,
                        yAxisID: 'y2'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 0 // Disable for real-time performance
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                scales: {
                    x: {
                        display: true,
                        title: { display: true, text: 'Time' }
                    },
                    y: {
                        type: 'linear',
                        position: 'left',
                        title: { display: true, text: 'Buffer (s)' },
                        min: 0
                    },
                    y1: {
                        type: 'linear',
                        position: 'right',
                        title: { display: true, text: 'Bitrate (Mbps)' },
                        grid: { drawOnChartArea: false }
                    },
                    y2: {
                        type: 'linear',
                        position: 'right',
                        title: { display: true, text: 'Dropped' },
                        grid: { drawOnChartArea: false },
                        display: false
                    }
                },
                plugins: {
                    legend: { position: 'top' }
                }
            }
        });
    }

    addDataPoint(buffer, bitrate, droppedFrames) {
        const now = new Date().toLocaleTimeString();

        this.chart.data.labels.push(now);
        this.chart.data.datasets[0].data.push(buffer);
        this.chart.data.datasets[1].data.push(bitrate / 1e6); // Convert to Mbps
        this.chart.data.datasets[2].data.push(droppedFrames);

        // Keep rolling window
        if (this.chart.data.labels.length > this.maxDataPoints) {
            this.chart.data.labels.shift();
            this.chart.data.datasets.forEach(ds => ds.data.shift());
        }

        this.chart.update('none'); // 'none' mode for best performance
    }
}
```

### Lightweight Sparkline Implementation

```javascript
// Ultra-lightweight sparkline for sidebar/overlay
class Sparkline {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.data = [];
        this.maxPoints = options.maxPoints || 50;
        this.color = options.color || '#4CAF50';
        this.fillColor = options.fillColor || 'rgba(76, 175, 80, 0.2)';
    }

    push(value) {
        this.data.push(value);
        if (this.data.length > this.maxPoints) {
            this.data.shift();
        }
        this.draw();
    }

    draw() {
        const { width, height } = this.canvas;
        const ctx = this.ctx;

        ctx.clearRect(0, 0, width, height);

        if (this.data.length < 2) return;

        const max = Math.max(...this.data);
        const min = Math.min(...this.data);
        const range = max - min || 1;

        const xStep = width / (this.maxPoints - 1);

        // Draw fill
        ctx.beginPath();
        ctx.moveTo(0, height);

        this.data.forEach((val, i) => {
            const x = i * xStep;
            const y = height - ((val - min) / range) * height;
            ctx.lineTo(x, y);
        });

        ctx.lineTo((this.data.length - 1) * xStep, height);
        ctx.closePath();
        ctx.fillStyle = this.fillColor;
        ctx.fill();

        // Draw line
        ctx.beginPath();
        this.data.forEach((val, i) => {
            const x = i * xStep;
            const y = height - ((val - min) / range) * height;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });

        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}
```

### D3.js Real-Time Chart

```javascript
// D3.js for more complex visualizations
class D3RealTimeChart {
    constructor(containerId, options = {}) {
        this.container = d3.select(`#${containerId}`);
        this.margin = { top: 20, right: 20, bottom: 30, left: 50 };
        this.width = (options.width || 400) - this.margin.left - this.margin.right;
        this.height = (options.height || 200) - this.margin.top - this.margin.bottom;
        this.maxDataPoints = options.maxDataPoints || 60;
        this.data = [];

        this.setupChart();
    }

    setupChart() {
        this.svg = this.container.append('svg')
            .attr('width', this.width + this.margin.left + this.margin.right)
            .attr('height', this.height + this.margin.top + this.margin.bottom)
            .append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

        this.x = d3.scaleTime().range([0, this.width]);
        this.y = d3.scaleLinear().range([this.height, 0]);

        this.line = d3.line()
            .x(d => this.x(d.time))
            .y(d => this.y(d.value))
            .curve(d3.curveMonotoneX);

        this.xAxis = this.svg.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0,${this.height})`);

        this.yAxis = this.svg.append('g')
            .attr('class', 'y-axis');

        this.path = this.svg.append('path')
            .attr('class', 'line')
            .attr('fill', 'none')
            .attr('stroke', '#2196F3')
            .attr('stroke-width', 2);
    }

    addDataPoint(value) {
        const now = new Date();
        this.data.push({ time: now, value: value });

        if (this.data.length > this.maxDataPoints) {
            this.data.shift();
        }

        this.update();
    }

    update() {
        this.x.domain(d3.extent(this.data, d => d.time));
        this.y.domain([0, d3.max(this.data, d => d.value) * 1.1]);

        this.xAxis.transition().duration(0).call(d3.axisBottom(this.x).ticks(5));
        this.yAxis.transition().duration(0).call(d3.axisLeft(this.y));

        this.path.datum(this.data)
            .attr('d', this.line);
    }
}
```

---

## 6. How Existing Players Expose Debug Info

### YouTube "Stats for Nerds"

YouTube's Stats for Nerds displays:
- **Video ID / sCPN**: Unique identifiers
- **Viewport / Frames**: Player size and frame info
- **Current / Optimal Res**: Current and recommended resolution
- **Volume / Normalized**: Audio levels
- **Codecs**: Video and audio codecs in use
- **Connection Speed**: Estimated bandwidth
- **Network Activity**: Real-time data transfer
- **Buffer Health**: Seconds of video buffered

### Netflix Debug Overlay

Netflix exposes similar metrics through their debug overlay:
- Current bitrate and resolution
- Buffer size
- CDN information
- Frame rate
- Audio/video codec info

### Implementation Pattern: Stats Overlay

```javascript
class StatsOverlay {
    constructor(video, container) {
        this.video = video;
        this.overlay = this.createOverlay(container);
        this.visible = false;
        this.updateInterval = null;
    }

    createOverlay(container) {
        const overlay = document.createElement('div');
        overlay.className = 'stats-overlay';
        overlay.style.cssText = `
            position: absolute;
            top: 10px;
            left: 10px;
            background: rgba(0, 0, 0, 0.75);
            color: #fff;
            font-family: monospace;
            font-size: 12px;
            padding: 10px;
            border-radius: 4px;
            z-index: 9999;
            pointer-events: none;
            display: none;
            min-width: 250px;
        `;
        container.appendChild(overlay);
        return overlay;
    }

    formatBytes(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(2) + ' MB';
    }

    formatTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
                     : `${m}:${s.toString().padStart(2, '0')}`;
    }

    update() {
        const quality = this.video.getVideoPlaybackQuality();
        const buffered = this.video.buffered;

        // Calculate buffer ahead
        let bufferAhead = 0;
        for (let i = 0; i < buffered.length; i++) {
            if (this.video.currentTime >= buffered.start(i) &&
                this.video.currentTime <= buffered.end(i)) {
                bufferAhead = buffered.end(i) - this.video.currentTime;
                break;
            }
        }

        this.overlay.innerHTML = `
            <div><strong>Video Stats</strong></div>
            <div>Resolution: ${this.video.videoWidth}x${this.video.videoHeight}</div>
            <div>Viewport: ${this.video.clientWidth}x${this.video.clientHeight}</div>
            <div>Current Time: ${this.formatTime(this.video.currentTime)} / ${this.formatTime(this.video.duration)}</div>
            <div>Playback Rate: ${this.video.playbackRate}x</div>
            <div style="margin-top: 5px;"><strong>Performance</strong></div>
            <div>Total Frames: ${quality.totalVideoFrames}</div>
            <div>Dropped Frames: ${quality.droppedVideoFrames} (${(quality.droppedVideoFrames / quality.totalVideoFrames * 100).toFixed(2)}%)</div>
            <div>Corrupted Frames: ${quality.corruptedVideoFrames}</div>
            <div style="margin-top: 5px;"><strong>Buffer</strong></div>
            <div>Buffer Ahead: ${bufferAhead.toFixed(1)}s</div>
            <div>Buffer Ranges: ${buffered.length}</div>
            <div>Ready State: ${['NOTHING', 'METADATA', 'CURRENT_DATA', 'FUTURE_DATA', 'ENOUGH_DATA'][this.video.readyState]}</div>
        `;
    }

    show() {
        this.visible = true;
        this.overlay.style.display = 'block';
        this.updateInterval = setInterval(() => this.update(), 1000);
        this.update();
    }

    hide() {
        this.visible = false;
        this.overlay.style.display = 'none';
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    toggle() {
        this.visible ? this.hide() : this.show();
    }
}
```

---

## 7. Chrome Media Internals Access

### Overview

`chrome://media-internals` is Chrome's built-in debugging tool for media playback. It displays:
- Active media players and their states
- Decoded audio/video information
- Network activity
- Error logs
- Property changes over time

### Programmatic Access Limitations

**Direct programmatic access to `chrome://media-internals` is not available** for Chrome extensions or web pages due to security restrictions. The `chrome://` protocol is reserved for internal Chrome pages.

### Alternative Approaches

#### 1. Chrome DevTools Protocol (CDP)

The Chrome DevTools Protocol can be used to instrument media playback, though it requires running Chrome with remote debugging enabled:

```javascript
// Requires Chrome launched with: --remote-debugging-port=9222
// Or using puppeteer/playwright

// Example with Chrome DevTools Protocol
const cdp = await chrome.debugger.attach({ tabId: tab.id }, '1.3');

// Listen to media events (if available in CDP)
await chrome.debugger.sendCommand({ tabId: tab.id }, 'Media.enable');

chrome.debugger.onEvent.addListener((source, method, params) => {
    if (method === 'Media.playerPropertiesChanged') {
        console.log('Media properties changed:', params);
    }
    if (method === 'Media.playerEventsAdded') {
        console.log('Media events:', params);
    }
});
```

#### 2. Content Script Approach

For Chrome extensions, the best approach is to inject a content script that monitors the video element directly:

```javascript
// content-script.js
(function() {
    const videos = document.querySelectorAll('video');

    videos.forEach(video => {
        // Create MutationObserver for new video elements
        // Monitor existing videos
        const collector = new VideoMetricsCollector(video);

        setInterval(() => {
            const metrics = collector.collect();
            // Send to extension
            chrome.runtime.sendMessage({
                type: 'VIDEO_METRICS',
                data: metrics
            });
        }, 1000);
    });
})();
```

#### 3. MediaCapabilities API

For probing codec/resolution support (not real-time metrics):

```javascript
const mediaCapabilities = navigator.mediaCapabilities;

async function checkDecodingCapabilities() {
    const config = {
        type: 'media-source',
        video: {
            contentType: 'video/mp4; codecs="avc1.4d401f"',
            width: 1920,
            height: 1080,
            framerate: 30,
            bitrate: 5000000
        }
    };

    const result = await mediaCapabilities.decodingInfo(config);
    console.log('Supported:', result.supported);
    console.log('Smooth:', result.smooth);
    console.log('Power Efficient:', result.powerEfficient);
}
```

---

## 8. Complete Implementation Examples

### Full Metrics Dashboard Component

```javascript
class VideoMetricsDashboard {
    constructor(videoElement, options = {}) {
        this.video = videoElement;
        this.player = options.player; // hls.js, dash.js, or shaka instance
        this.playerType = options.playerType; // 'hls', 'dash', 'shaka', or 'native'

        this.metrics = {
            buffer: [],
            bitrate: [],
            frames: [],
            latency: [],
            quality: []
        };

        this.maxDataPoints = options.maxDataPoints || 120;
        this.updateInterval = options.updateInterval || 1000;
        this.isRunning = false;

        this.callbacks = {
            onMetricsUpdate: options.onMetricsUpdate || (() => {}),
            onQualityChange: options.onQualityChange || (() => {}),
            onBuffering: options.onBuffering || (() => {}),
            onError: options.onError || (() => {})
        };

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Native video events
        this.video.addEventListener('waiting', () => {
            this.callbacks.onBuffering({ type: 'start', timestamp: performance.now() });
        });

        this.video.addEventListener('playing', () => {
            this.callbacks.onBuffering({ type: 'end', timestamp: performance.now() });
        });

        // Player-specific events
        if (this.playerType === 'hls' && this.player) {
            this.setupHLSEvents();
        } else if (this.playerType === 'dash' && this.player) {
            this.setupDashEvents();
        } else if (this.playerType === 'shaka' && this.player) {
            this.setupShakaEvents();
        }
    }

    setupHLSEvents() {
        this.player.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
            const level = this.player.levels[data.level];
            this.callbacks.onQualityChange({
                type: 'hls',
                level: data.level,
                width: level.width,
                height: level.height,
                bitrate: level.bitrate
            });
        });

        this.player.on(Hls.Events.ERROR, (event, data) => {
            this.callbacks.onError({ type: 'hls', details: data.details, fatal: data.fatal });
        });
    }

    setupDashEvents() {
        this.player.on(dashjs.MediaPlayer.events.QUALITY_CHANGE_RENDERED, (e) => {
            this.callbacks.onQualityChange({
                type: 'dash',
                mediaType: e.mediaType,
                quality: e.newQuality
            });
        });
    }

    setupShakaEvents() {
        this.player.addEventListener('variantchanged', () => {
            const variant = this.player.getVariantTracks().find(t => t.active);
            this.callbacks.onQualityChange({
                type: 'shaka',
                width: variant.width,
                height: variant.height,
                bandwidth: variant.bandwidth
            });
        });
    }

    collectMetrics() {
        const timestamp = performance.now();
        const quality = this.video.getVideoPlaybackQuality();

        // Buffer calculation
        let bufferAhead = 0;
        const buffered = this.video.buffered;
        for (let i = 0; i < buffered.length; i++) {
            if (this.video.currentTime >= buffered.start(i) &&
                this.video.currentTime <= buffered.end(i)) {
                bufferAhead = buffered.end(i) - this.video.currentTime;
                break;
            }
        }

        // Player-specific metrics
        let playerMetrics = {};
        if (this.playerType === 'hls' && this.player) {
            playerMetrics = {
                currentLevel: this.player.currentLevel,
                levels: this.player.levels,
                bandwidthEstimate: this.player.bandwidthEstimate,
                latency: this.player.latency,
                drift: this.player.drift
            };
        } else if (this.playerType === 'dash' && this.player) {
            const dashMetrics = this.player.getDashMetrics();
            playerMetrics = {
                videoQuality: this.player.getQualityFor('video'),
                videoBufferLevel: dashMetrics.getCurrentBufferLevel('video'),
                bitrateList: this.player.getBitrateInfoListFor('video')
            };
        } else if (this.playerType === 'shaka' && this.player) {
            const stats = this.player.getStats();
            playerMetrics = {
                estimatedBandwidth: stats.estimatedBandwidth,
                streamBandwidth: stats.streamBandwidth,
                bufferingTime: stats.bufferingTime,
                stallsDetected: stats.stallsDetected
            };
        }

        const metrics = {
            timestamp,
            native: {
                currentTime: this.video.currentTime,
                duration: this.video.duration,
                resolution: {
                    width: this.video.videoWidth,
                    height: this.video.videoHeight
                },
                frames: {
                    total: quality.totalVideoFrames,
                    dropped: quality.droppedVideoFrames,
                    corrupted: quality.corruptedVideoFrames
                },
                buffer: {
                    ahead: bufferAhead,
                    ranges: buffered.length
                },
                readyState: this.video.readyState,
                paused: this.video.paused
            },
            player: playerMetrics
        };

        // Store in rolling buffers
        this.addToBuffer('buffer', bufferAhead);
        this.addToBuffer('frames', quality.droppedVideoFrames);

        if (playerMetrics.bandwidthEstimate) {
            this.addToBuffer('bitrate', playerMetrics.bandwidthEstimate);
        }
        if (playerMetrics.latency) {
            this.addToBuffer('latency', playerMetrics.latency);
        }

        this.callbacks.onMetricsUpdate(metrics);

        return metrics;
    }

    addToBuffer(key, value) {
        this.metrics[key].push({ timestamp: performance.now(), value });
        if (this.metrics[key].length > this.maxDataPoints) {
            this.metrics[key].shift();
        }
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;

        this.intervalId = setInterval(() => {
            this.collectMetrics();
        }, this.updateInterval);
    }

    stop() {
        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    getHistory(metricType) {
        return this.metrics[metricType] || [];
    }

    exportData() {
        return {
            metrics: this.metrics,
            exportTime: new Date().toISOString()
        };
    }
}
```

### Extension Popup with Real-Time Charts

```html
<!-- popup.html -->
<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            width: 400px;
            padding: 10px;
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: 12px;
        }
        .metric-row {
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
            border-bottom: 1px solid #eee;
        }
        .metric-label { color: #666; }
        .metric-value { font-weight: 600; }
        .chart-container {
            height: 100px;
            margin: 10px 0;
        }
        canvas { width: 100%; height: 100%; }
        .status {
            padding: 5px;
            border-radius: 3px;
            text-align: center;
            margin-bottom: 10px;
        }
        .status.good { background: #e8f5e9; color: #2e7d32; }
        .status.warning { background: #fff3e0; color: #ef6c00; }
        .status.error { background: #ffebee; color: #c62828; }
    </style>
</head>
<body>
    <div id="status" class="status good">No video detected</div>

    <div class="metric-row">
        <span class="metric-label">Resolution</span>
        <span id="resolution" class="metric-value">--</span>
    </div>
    <div class="metric-row">
        <span class="metric-label">Bitrate</span>
        <span id="bitrate" class="metric-value">--</span>
    </div>
    <div class="metric-row">
        <span class="metric-label">Buffer</span>
        <span id="buffer" class="metric-value">--</span>
    </div>
    <div class="metric-row">
        <span class="metric-label">Dropped Frames</span>
        <span id="dropped" class="metric-value">--</span>
    </div>
    <div class="metric-row">
        <span class="metric-label">FPS</span>
        <span id="fps" class="metric-value">--</span>
    </div>

    <div class="chart-container">
        <canvas id="bufferChart"></canvas>
    </div>

    <script src="libs/chart.min.js"></script>
    <script src="popup.js"></script>
</body>
</html>
```

```javascript
// popup.js
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize chart
    const ctx = document.getElementById('bufferChart').getContext('2d');
    const bufferChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Buffer (s)',
                data: [],
                borderColor: '#4CAF50',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 0 },
            scales: {
                y: { min: 0 },
                x: { display: false }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });

    // Request metrics from content script
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.tabs.sendMessage(tab.id, { type: 'GET_METRICS' }, (response) => {
        if (response && response.hasVideo) {
            updateUI(response.metrics);
            addChartData(bufferChart, response.metrics.buffer.ahead);
        }
    });

    // Listen for real-time updates
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'METRICS_UPDATE') {
            updateUI(message.metrics);
            addChartData(bufferChart, message.metrics.buffer.ahead);
        }
    });

    function updateUI(metrics) {
        document.getElementById('status').textContent = 'Video Playing';
        document.getElementById('status').className = 'status good';

        document.getElementById('resolution').textContent =
            `${metrics.resolution.width}x${metrics.resolution.height}`;
        document.getElementById('buffer').textContent =
            `${metrics.buffer.ahead.toFixed(1)}s`;
        document.getElementById('dropped').textContent =
            metrics.frames.dropped;

        if (metrics.bitrate) {
            document.getElementById('bitrate').textContent =
                `${(metrics.bitrate / 1e6).toFixed(2)} Mbps`;
        }
    }

    function addChartData(chart, value) {
        chart.data.labels.push('');
        chart.data.datasets[0].data.push(value);

        if (chart.data.labels.length > 30) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
        }

        chart.update('none');
    }
});
```

---

## References

### MDN Web Docs
- [HTMLVideoElement](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement)
- [getVideoPlaybackQuality()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/getVideoPlaybackQuality)
- [VideoPlaybackQuality](https://developer.mozilla.org/en-US/docs/Web/API/VideoPlaybackQuality)
- [HTMLMediaElement.buffered](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/buffered)
- [SourceBuffer](https://developer.mozilla.org/en-US/docs/Web/API/SourceBuffer)
- [performance.now()](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now)
- [requestAnimationFrame()](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)

### Player Documentation
- [HLS.js API](https://github.com/video-dev/hls.js/blob/master/docs/API.md)
- [dash.js DashMetrics Module](https://cdn.dashjs.org/latest/jsdoc/module-DashMetrics.html)
- [Shaka Player API](https://shaka-player-demo.appspot.com/docs/api/shaka.Player.html)
- [Video.js Quality Levels Plugin](https://github.com/videojs/videojs-contrib-quality-levels)
- [Video.js Debugger Plugin](https://github.com/brightcove/videojs-debugger)

### Visualization Libraries
- [Chart.js Documentation](https://www.chartjs.org/docs/)
- [D3.js Documentation](https://d3js.org/)

### Chrome Development
- [Chrome Media Internals](https://www.chromium.org/audio-video/media-internals/)
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)

### Guides and Tutorials
- [HLS.js Complete Guide 2025](https://www.videosdk.live/developer-hub/hls/hls-js)
- [Testing HLS Streams](https://www.videosdk.live/developer-hub/hls/test-hls)
- [Real-Time Visualization with D3.js](https://fireship.io/lessons/realtime-charts-d3-firebase/)
- [Globo Player Stats Implementation](https://www.gabriella.work/work/player-stats)

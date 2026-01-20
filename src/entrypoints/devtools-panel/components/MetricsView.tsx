/**
 * MetricsView Component - Real-time playback metrics visualization
 * SOLID: Single Responsibility - Metrics display only
 */

import { useEffect, useRef, useState } from 'react';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Legend,
  Tooltip,
} from 'chart.js';
import type { DetectedStream } from '../../../store';

// Register Chart.js components
Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Legend,
  Tooltip
);

interface Props {
  stream: DetectedStream | null;
}

interface MetricsSample {
  timestamp: number;
  buffer: number;
  bitrate: number;
  droppedFrames: number;
  resolution: string;
}

export function MetricsView({ stream }: Props) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);
  const [metrics, setMetrics] = useState<MetricsSample[]>([]);
  const [isCollecting, setIsCollecting] = useState(false);
  const [currentMetrics, setCurrentMetrics] = useState<MetricsSample | null>(null);

  // Initialize chart
  useEffect(() => {
    if (!chartRef.current) return;

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Buffer (s)',
            data: [],
            borderColor: '#4ec9b0',
            backgroundColor: 'rgba(78, 201, 176, 0.1)',
            fill: true,
            tension: 0.4,
            yAxisID: 'y',
          },
          {
            label: 'Bitrate (Mbps)',
            data: [],
            borderColor: '#007acc',
            backgroundColor: 'rgba(0, 122, 204, 0.1)',
            fill: true,
            tension: 0.4,
            yAxisID: 'y1',
          },
          {
            label: 'Dropped Frames',
            data: [],
            borderColor: '#f14c4c',
            backgroundColor: 'rgba(241, 76, 76, 0.1)',
            fill: false,
            tension: 0,
            yAxisID: 'y2',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 0, // Disable for real-time performance
        },
        interaction: {
          intersect: false,
          mode: 'index',
        },
        scales: {
          x: {
            display: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)',
            },
            ticks: {
              color: '#858585',
              maxTicksLimit: 8,
            },
          },
          y: {
            type: 'linear',
            position: 'left',
            title: {
              display: true,
              text: 'Buffer (s)',
              color: '#4ec9b0',
            },
            min: 0,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)',
            },
            ticks: {
              color: '#858585',
            },
          },
          y1: {
            type: 'linear',
            position: 'right',
            title: {
              display: true,
              text: 'Bitrate (Mbps)',
              color: '#007acc',
            },
            min: 0,
            grid: {
              drawOnChartArea: false,
            },
            ticks: {
              color: '#858585',
            },
          },
          y2: {
            type: 'linear',
            position: 'right',
            display: false,
            min: 0,
          },
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: '#cccccc',
              usePointStyle: true,
              pointStyle: 'circle',
            },
          },
          tooltip: {
            backgroundColor: 'rgba(30, 30, 30, 0.9)',
            titleColor: '#cccccc',
            bodyColor: '#cccccc',
            borderColor: '#3c3c3c',
            borderWidth: 1,
          },
        },
      },
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, []);

  // Collect metrics from content script
  useEffect(() => {
    if (!stream || !isCollecting) return;

    const collectMetrics = () => {
      // Request metrics from content script via background
      chrome.runtime.sendMessage(
        {
          type: 'GET_VIDEO_METRICS',
          tabId: stream.info.tabId,
        },
        (response) => {
          if (response?.metrics) {
            const sample: MetricsSample = {
              timestamp: Date.now(),
              buffer: response.metrics.bufferAhead ?? 0,
              bitrate: response.metrics.bitrate ?? 0,
              droppedFrames: response.metrics.droppedFrames ?? 0,
              resolution: response.metrics.resolution ?? 'Unknown',
            };

            setCurrentMetrics(sample);
            setMetrics((prev) => {
              const newMetrics = [...prev, sample].slice(-60); // Keep last 60 samples
              updateChart(newMetrics);
              return newMetrics;
            });
          }
        }
      );
    };

    const intervalId = setInterval(collectMetrics, 1000);
    collectMetrics(); // Initial collection

    return () => clearInterval(intervalId);
  }, [stream, isCollecting]);

  // Update chart with new data
  const updateChart = (data: MetricsSample[]) => {
    if (!chartInstance.current) return;

    const labels = data.map((d) =>
      new Date(d.timestamp).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' })
    );

    chartInstance.current.data.labels = labels;
    chartInstance.current.data.datasets[0].data = data.map((d) => d.buffer);
    chartInstance.current.data.datasets[1].data = data.map((d) => d.bitrate / 1_000_000);
    chartInstance.current.data.datasets[2].data = data.map((d) => d.droppedFrames);
    chartInstance.current.update('none');
  };

  // Clear metrics
  const handleClear = () => {
    setMetrics([]);
    setCurrentMetrics(null);
    if (chartInstance.current) {
      chartInstance.current.data.labels = [];
      chartInstance.current.data.datasets.forEach((ds) => (ds.data = []));
      chartInstance.current.update();
    }
  };

  if (!stream) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📊</div>
        <h3 className="empty-state-title">No Stream Selected</h3>
        <p className="empty-state-text">
          Select a stream from the Streams tab to view real-time playback metrics.
        </p>
      </div>
    );
  }

  return (
    <div className="metrics-view">
      <div className="metrics-header">
        <h2>Playback Metrics</h2>
        <div className="metrics-actions">
          <button
            className={`btn ${isCollecting ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setIsCollecting(!isCollecting)}
          >
            {isCollecting ? 'Stop' : 'Start'} Collection
          </button>
          <button className="btn btn-secondary" onClick={handleClear}>
            Clear
          </button>
        </div>
      </div>

      {/* Current Metrics Cards */}
      <div className="metrics-cards">
        <div className="metric-card">
          <div className="metric-card-title">Buffer</div>
          <div className="metric-card-value">
            {currentMetrics ? `${currentMetrics.buffer.toFixed(1)}s` : '--'}
          </div>
          <div className={`metric-card-status ${getBufferStatus(currentMetrics?.buffer)}`}>
            {getBufferStatusText(currentMetrics?.buffer)}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-card-title">Bitrate</div>
          <div className="metric-card-value">
            {currentMetrics ? `${(currentMetrics.bitrate / 1_000_000).toFixed(2)} Mbps` : '--'}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-card-title">Dropped Frames</div>
          <div className="metric-card-value">
            {currentMetrics ? currentMetrics.droppedFrames.toString() : '--'}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-card-title">Resolution</div>
          <div className="metric-card-value">
            {currentMetrics?.resolution ?? '--'}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="metrics-chart-container">
        <canvas ref={chartRef} />
      </div>

      {/* No data message */}
      {!isCollecting && metrics.length === 0 && (
        <div className="metrics-hint">
          Click "Start Collection" to begin monitoring playback metrics.
          <br />
          Make sure a video is playing on the page.
        </div>
      )}
    </div>
  );
}

function getBufferStatus(buffer?: number): string {
  if (buffer === undefined) return '';
  if (buffer > 10) return 'good';
  if (buffer > 3) return 'warning';
  return 'error';
}

function getBufferStatusText(buffer?: number): string {
  if (buffer === undefined) return '';
  if (buffer > 10) return 'Healthy';
  if (buffer > 3) return 'Low';
  return 'Critical';
}

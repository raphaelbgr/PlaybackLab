/**
 * Stream Health Score Calculator
 * Provides a simple 0-100 score for stream quality
 */

export interface HealthMetrics {
  bufferLevel: number; // seconds
  droppedFrames: number;
  totalFrames: number;
  rebufferingEvents: number;
  playbackDuration: number; // seconds
  errorCount: number;
  qualitySwitches: number;
  averageBitrate: number;
  maxBitrate: number;
  startupTime?: number; // ms
  latency?: number; // for live streams, seconds behind live edge
}

export interface HealthScore {
  overall: number; // 0-100
  breakdown: {
    buffer: number;
    frames: number;
    stability: number;
    quality: number;
    errors: number;
  };
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  issues: string[];
  recommendations: string[];
}

/**
 * Calculate overall stream health score
 */
export function calculateHealthScore(metrics: HealthMetrics): HealthScore {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Buffer Score (0-100)
  // Ideal: > 10 seconds, Critical: < 2 seconds
  let bufferScore = 100;
  if (metrics.bufferLevel < 2) {
    bufferScore = 20;
    issues.push('Critical buffer level - high rebuffering risk');
    recommendations.push('Check network bandwidth or reduce quality');
  } else if (metrics.bufferLevel < 5) {
    bufferScore = 50;
    issues.push('Low buffer level');
    recommendations.push('Consider enabling more aggressive buffering');
  } else if (metrics.bufferLevel < 10) {
    bufferScore = 75;
  }

  // Frame Drop Score (0-100)
  // Ideal: < 0.1%, Critical: > 5%
  const dropRate = metrics.totalFrames > 0
    ? (metrics.droppedFrames / metrics.totalFrames) * 100
    : 0;
  let frameScore = 100;
  if (dropRate > 5) {
    frameScore = 20;
    issues.push(`High frame drop rate: ${dropRate.toFixed(2)}%`);
    recommendations.push('Reduce video quality or check device performance');
  } else if (dropRate > 1) {
    frameScore = 50;
    issues.push(`Elevated frame drops: ${dropRate.toFixed(2)}%`);
  } else if (dropRate > 0.1) {
    frameScore = 80;
  }

  // Stability Score (0-100)
  // Based on rebuffering ratio and quality switches
  const rebufferingRatio = metrics.playbackDuration > 0
    ? (metrics.rebufferingEvents / (metrics.playbackDuration / 60))
    : 0;
  let stabilityScore = 100;
  if (rebufferingRatio > 2) {
    stabilityScore = 30;
    issues.push('Frequent rebuffering events');
    recommendations.push('Consider lowering max quality or check CDN');
  } else if (rebufferingRatio > 0.5) {
    stabilityScore = 60;
    issues.push('Occasional rebuffering');
  }

  // Quality switches penalty
  const switchRate = metrics.playbackDuration > 0
    ? (metrics.qualitySwitches / (metrics.playbackDuration / 60))
    : 0;
  if (switchRate > 5) {
    stabilityScore = Math.max(stabilityScore - 30, 0);
    issues.push('Excessive quality switching');
    recommendations.push('ABR algorithm may need tuning');
  } else if (switchRate > 2) {
    stabilityScore = Math.max(stabilityScore - 15, 0);
  }

  // Quality Score (0-100)
  // Based on average bitrate vs max available
  const qualityRatio = metrics.maxBitrate > 0
    ? metrics.averageBitrate / metrics.maxBitrate
    : 1;
  let qualityScore = Math.min(qualityRatio * 100, 100);
  if (qualityRatio < 0.3) {
    issues.push('Playing at low quality');
    recommendations.push('Check if bandwidth supports higher quality');
  }

  // Startup time bonus/penalty
  if (metrics.startupTime !== undefined) {
    if (metrics.startupTime > 5000) {
      qualityScore = Math.max(qualityScore - 20, 0);
      issues.push(`Slow startup: ${(metrics.startupTime / 1000).toFixed(1)}s`);
      recommendations.push('Consider preloading or reducing initial quality');
    } else if (metrics.startupTime > 2000) {
      qualityScore = Math.max(qualityScore - 10, 0);
    }
  }

  // Error Score (0-100)
  let errorScore = 100;
  if (metrics.errorCount > 5) {
    errorScore = 20;
    issues.push(`Multiple errors detected: ${metrics.errorCount}`);
    recommendations.push('Check error logs for details');
  } else if (metrics.errorCount > 0) {
    errorScore = 100 - (metrics.errorCount * 15);
    issues.push(`Errors detected: ${metrics.errorCount}`);
  }

  // Live latency penalty
  if (metrics.latency !== undefined && metrics.latency > 30) {
    stabilityScore = Math.max(stabilityScore - 20, 0);
    issues.push(`High live latency: ${metrics.latency.toFixed(1)}s`);
    recommendations.push('Enable low-latency mode if available');
  }

  // Calculate overall score (weighted average)
  const overall = Math.round(
    bufferScore * 0.25 +
    frameScore * 0.20 +
    stabilityScore * 0.25 +
    qualityScore * 0.15 +
    errorScore * 0.15
  );

  // Determine grade and status
  let grade: HealthScore['grade'];
  let status: HealthScore['status'];

  if (overall >= 90) {
    grade = 'A';
    status = 'excellent';
  } else if (overall >= 75) {
    grade = 'B';
    status = 'good';
  } else if (overall >= 60) {
    grade = 'C';
    status = 'fair';
  } else if (overall >= 40) {
    grade = 'D';
    status = 'poor';
  } else {
    grade = 'F';
    status = 'critical';
  }

  // Add positive feedback if no issues
  if (issues.length === 0) {
    recommendations.push('Stream is performing optimally');
  }

  return {
    overall,
    breakdown: {
      buffer: Math.round(bufferScore),
      frames: Math.round(frameScore),
      stability: Math.round(stabilityScore),
      quality: Math.round(qualityScore),
      errors: Math.round(errorScore),
    },
    grade,
    status,
    issues,
    recommendations,
  };
}

/**
 * Get color for score
 */
export function getScoreColor(score: number): string {
  if (score >= 90) return '#4ec9b0'; // Green
  if (score >= 75) return '#85c46c'; // Light green
  if (score >= 60) return '#dcdcaa'; // Yellow
  if (score >= 40) return '#ce9178'; // Orange
  return '#f14c4c'; // Red
}

/**
 * Get status color
 */
export function getStatusColor(status: HealthScore['status']): string {
  switch (status) {
    case 'excellent': return '#4ec9b0';
    case 'good': return '#85c46c';
    case 'fair': return '#dcdcaa';
    case 'poor': return '#ce9178';
    case 'critical': return '#f14c4c';
  }
}

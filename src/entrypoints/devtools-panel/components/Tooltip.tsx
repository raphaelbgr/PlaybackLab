/**
 * Tooltip Component - Hybrid tooltip system
 *
 * Two modes:
 * 1. CSS-only: Use data-tooltip attribute on any element (simple, fast)
 * 2. React component: For rich tooltips with icons, links, formatting
 *
 * Usage:
 * - Simple: <span data-tooltip="Simple text">Hover me</span>
 * - Rich: <Tooltip content={<RichContent />}>Hover me</Tooltip>
 */

import { useState, useRef, useEffect, type ReactNode } from 'react';

export interface TooltipProps {
  /** Tooltip content - string for simple, ReactNode for rich */
  content: ReactNode;
  /** Element to wrap */
  children: ReactNode;
  /** Position preference */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Delay before showing (ms) */
  delay?: number;
  /** Max width of tooltip */
  maxWidth?: number;
  /** Additional class for tooltip */
  className?: string;
  /** Disable tooltip */
  disabled?: boolean;
}

export function Tooltip({
  content,
  children,
  position = 'top',
  delay = 300,
  maxWidth = 300,
  className = '',
  disabled = false,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showTooltip = () => {
    if (disabled) return;
    timeoutRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setCoords(calculatePosition(rect, position));
        setIsVisible(true);
      }
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  // Recalculate position if tooltip overflows viewport
  useEffect(() => {
    if (isVisible && tooltipRef.current && triggerRef.current) {
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const triggerRect = triggerRef.current.getBoundingClientRect();

      // Check if tooltip overflows and adjust
      let newCoords = { ...coords };

      if (tooltipRect.right > window.innerWidth) {
        newCoords.x = window.innerWidth - tooltipRect.width - 10;
      }
      if (tooltipRect.left < 0) {
        newCoords.x = 10;
      }
      if (tooltipRect.top < 0) {
        // Flip to bottom
        newCoords.y = triggerRect.bottom + 8;
      }
      if (tooltipRect.bottom > window.innerHeight) {
        // Flip to top
        newCoords.y = triggerRect.top - tooltipRect.height - 8;
      }

      if (newCoords.x !== coords.x || newCoords.y !== coords.y) {
        setCoords(newCoords);
      }
    }
  }, [isVisible, coords]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <span
        ref={triggerRef}
        className="tooltip-trigger"
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
      >
        {children}
      </span>
      {isVisible && (
        <div
          ref={tooltipRef}
          className={`tooltip-content tooltip-${position} ${className}`}
          style={{
            position: 'fixed',
            left: coords.x,
            top: coords.y,
            maxWidth,
            zIndex: 10000,
          }}
          role="tooltip"
        >
          {content}
          <div className="tooltip-arrow" />
        </div>
      )}
    </>
  );
}

function calculatePosition(
  rect: DOMRect,
  position: 'top' | 'bottom' | 'left' | 'right'
): { x: number; y: number } {
  const gap = 8;

  switch (position) {
    case 'top':
      return {
        x: rect.left + rect.width / 2,
        y: rect.top - gap,
      };
    case 'bottom':
      return {
        x: rect.left + rect.width / 2,
        y: rect.bottom + gap,
      };
    case 'left':
      return {
        x: rect.left - gap,
        y: rect.top + rect.height / 2,
      };
    case 'right':
      return {
        x: rect.right + gap,
        y: rect.top + rect.height / 2,
      };
  }
}

// ============================================
// Rich Tooltip Content Components
// ============================================

interface TagTooltipProps {
  title: string;
  description: string;
  details?: Array<{ label: string; value: string }>;
  icon?: string;
  learnMoreUrl?: string;
}

/**
 * Rich tooltip content for tags
 */
export function TagTooltip({ title, description, details, icon, learnMoreUrl }: TagTooltipProps) {
  return (
    <div className="tag-tooltip">
      <div className="tag-tooltip-header">
        {icon && <span className="tag-tooltip-icon">{icon}</span>}
        <span className="tag-tooltip-title">{title}</span>
      </div>
      <p className="tag-tooltip-description">{description}</p>
      {details && details.length > 0 && (
        <div className="tag-tooltip-details">
          {details.map((detail, i) => (
            <div key={i} className="tag-tooltip-detail">
              <span className="detail-label">{detail.label}:</span>
              <span className="detail-value">{detail.value}</span>
            </div>
          ))}
        </div>
      )}
      {learnMoreUrl && (
        <a
          className="tag-tooltip-link"
          href={learnMoreUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          Learn more →
        </a>
      )}
    </div>
  );
}

// ============================================
// Codec-Specific Rich Tooltips
// ============================================

export function H264Tooltip() {
  return (
    <TagTooltip
      icon="🎬"
      title="H.264 / AVC"
      description="The most widely supported video codec. Works on virtually all devices and browsers."
      details={[
        { label: 'Also known as', value: 'AVC, MPEG-4 Part 10' },
        { label: 'Efficiency', value: 'Baseline (good compatibility)' },
        { label: 'Support', value: 'Universal' },
      ]}
    />
  );
}

export function H265Tooltip() {
  return (
    <TagTooltip
      icon="🎬"
      title="H.265 / HEVC"
      description="High Efficiency Video Coding. 50% better compression than H.264 at same quality."
      details={[
        { label: 'Also known as', value: 'HEVC, MPEG-H Part 2' },
        { label: 'Efficiency', value: '50% better than H.264' },
        { label: 'Support', value: 'Modern devices (2015+)' },
      ]}
    />
  );
}

export function VP9Tooltip() {
  return (
    <TagTooltip
      icon="🎬"
      title="VP9"
      description="Google's open and royalty-free video codec. Standard for YouTube."
      details={[
        { label: 'Developer', value: 'Google' },
        { label: 'License', value: 'Royalty-free' },
        { label: 'Used by', value: 'YouTube, Netflix' },
      ]}
    />
  );
}

export function AV1Tooltip() {
  return (
    <TagTooltip
      icon="🎬"
      title="AV1"
      description="Next-generation open codec. 30% more efficient than HEVC, royalty-free."
      details={[
        { label: 'Developer', value: 'Alliance for Open Media' },
        { label: 'Efficiency', value: '30% better than HEVC' },
        { label: 'Support', value: 'Growing (Chrome, Firefox, newer devices)' },
      ]}
    />
  );
}

export function DolbyVisionTooltip() {
  return (
    <TagTooltip
      icon="🌈"
      title="Dolby Vision"
      description="Premium HDR format with dynamic metadata that optimizes every scene."
      details={[
        { label: 'Color depth', value: 'Up to 12-bit' },
        { label: 'Brightness', value: 'Up to 10,000 nits' },
        { label: 'Metadata', value: 'Dynamic (per-scene)' },
      ]}
    />
  );
}

export function HDR10Tooltip() {
  return (
    <TagTooltip
      icon="🌈"
      title="HDR10"
      description="Open HDR standard with static metadata. Most widely supported HDR format."
      details={[
        { label: 'Color depth', value: '10-bit' },
        { label: 'Brightness', value: 'Up to 1,000 nits typical' },
        { label: 'Metadata', value: 'Static (whole video)' },
      ]}
    />
  );
}

export function DolbyAtmosTooltip() {
  return (
    <TagTooltip
      icon="🔊"
      title="Dolby Atmos"
      description="Immersive 3D audio with sound objects that move around and above you."
      details={[
        { label: 'Channels', value: 'Object-based (up to 128 tracks)' },
        { label: 'Height', value: 'Overhead speakers supported' },
        { label: 'Codec', value: 'E-AC-3 with JOC extension' },
      ]}
    />
  );
}

export function DolbyDigitalPlusTooltip() {
  return (
    <TagTooltip
      icon="🔊"
      title="Dolby Digital Plus"
      description="Enhanced surround sound codec. Supports up to 7.1 channels and Dolby Atmos."
      details={[
        { label: 'Also known as', value: 'E-AC-3, DD+' },
        { label: 'Max channels', value: '7.1 (or Atmos)' },
        { label: 'Bitrate', value: 'Up to 6 Mbps' },
      ]}
    />
  );
}

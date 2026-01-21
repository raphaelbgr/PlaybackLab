/**
 * CopyButton Component - Reusable copy button with visual feedback
 * Shows checkmark animation on successful copy
 */

import { useCopyFeedback, type CopyState } from '../../../shared/hooks/useCopyFeedback';

interface CopyButtonProps {
  text: string;
  label?: string;
  title?: string;
  className?: string;
  size?: 'small' | 'medium' | 'large';
  variant?: 'icon' | 'text' | 'full';
  onCopy?: (success: boolean) => void;
}

export function CopyButton({
  text,
  label = 'Copy',
  title = 'Copy to clipboard',
  className = '',
  size = 'medium',
  variant = 'text',
  onCopy,
}: CopyButtonProps) {
  const { copyState, copy } = useCopyFeedback(1500);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await copy(text);
    onCopy?.(success);
  };

  const getIcon = (state: CopyState) => {
    switch (state) {
      case 'copied':
        return '✓';
      case 'error':
        return '✗';
      case 'copying':
        return '...';
      default:
        return '📋';
    }
  };

  const getLabel = (state: CopyState) => {
    switch (state) {
      case 'copied':
        return 'Copied!';
      case 'error':
        return 'Failed';
      case 'copying':
        return 'Copying...';
      default:
        return label;
    }
  };

  const sizeClass = `copy-btn-${size}`;
  const stateClass = `copy-btn-${copyState}`;

  if (variant === 'icon') {
    return (
      <button
        className={`copy-btn copy-btn-icon ${sizeClass} ${stateClass} ${className}`}
        onClick={handleClick}
        title={copyState === 'copied' ? 'Copied!' : title}
        disabled={copyState === 'copying'}
      >
        <span className="copy-icon">{getIcon(copyState)}</span>
      </button>
    );
  }

  if (variant === 'full') {
    return (
      <button
        className={`copy-btn copy-btn-full ${sizeClass} ${stateClass} ${className}`}
        onClick={handleClick}
        title={title}
        disabled={copyState === 'copying'}
      >
        <span className="copy-icon">{getIcon(copyState)}</span>
        <span className="copy-label">{getLabel(copyState)}</span>
      </button>
    );
  }

  // Default: text variant
  return (
    <button
      className={`copy-btn copy-btn-text ${sizeClass} ${stateClass} ${className}`}
      onClick={handleClick}
      title={copyState === 'copied' ? 'Copied!' : title}
      disabled={copyState === 'copying'}
    >
      <span className="copy-label">{getLabel(copyState)}</span>
    </button>
  );
}

// Shorthand component for just the icon
export function CopyIconButton(props: Omit<CopyButtonProps, 'variant'>) {
  return <CopyButton {...props} variant="icon" />;
}

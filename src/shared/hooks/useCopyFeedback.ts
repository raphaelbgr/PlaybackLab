/**
 * useCopyFeedback - Hook for clipboard copy with visual feedback
 * Provides copy state management with automatic reset after animation
 */

import { useState, useCallback, useRef } from 'react';
import { copyToClipboard } from '../utils/copyAsCurl';

export type CopyState = 'idle' | 'copying' | 'copied' | 'error';

export interface UseCopyFeedbackReturn {
  copyState: CopyState;
  isCopied: boolean;
  isError: boolean;
  copy: (text: string) => Promise<boolean>;
  reset: () => void;
}

/**
 * Hook for managing copy-to-clipboard with visual feedback
 * @param resetDelay - Time in ms before resetting to idle state (default: 2000)
 */
export function useCopyFeedback(resetDelay: number = 2000): UseCopyFeedbackReturn {
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    setCopyState('idle');
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const copy = useCallback(async (text: string): Promise<boolean> => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setCopyState('copying');

    try {
      const success = await copyToClipboard(text);

      if (success) {
        setCopyState('copied');
        // Auto-reset after delay
        timeoutRef.current = setTimeout(() => {
          setCopyState('idle');
          timeoutRef.current = null;
        }, resetDelay);
        return true;
      } else {
        setCopyState('error');
        // Also reset error state after delay
        timeoutRef.current = setTimeout(() => {
          setCopyState('idle');
          timeoutRef.current = null;
        }, resetDelay);
        return false;
      }
    } catch {
      setCopyState('error');
      timeoutRef.current = setTimeout(() => {
        setCopyState('idle');
        timeoutRef.current = null;
      }, resetDelay);
      return false;
    }
  }, [resetDelay]);

  return {
    copyState,
    isCopied: copyState === 'copied',
    isError: copyState === 'error',
    copy,
    reset,
  };
}

/**
 * Hook for managing multiple copy buttons (e.g., list items)
 * Tracks which item was last copied
 */
export function useCopyFeedbackMap(resetDelay: number = 2000) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(async (id: string, text: string): Promise<boolean> => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    try {
      const success = await copyToClipboard(text);

      if (success) {
        setCopiedId(id);
        // Auto-reset after delay
        timeoutRef.current = setTimeout(() => {
          setCopiedId(null);
          timeoutRef.current = null;
        }, resetDelay);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [resetDelay]);

  const isCopied = useCallback((id: string): boolean => {
    return copiedId === id;
  }, [copiedId]);

  const reset = useCallback(() => {
    setCopiedId(null);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  return {
    copiedId,
    copy,
    isCopied,
    reset,
  };
}

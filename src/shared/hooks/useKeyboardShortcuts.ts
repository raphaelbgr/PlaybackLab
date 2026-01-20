/**
 * Keyboard Shortcuts Hook
 * Provides global keyboard shortcuts for power users
 */

import { useEffect, useCallback } from 'react';

export interface ShortcutDefinition {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  action: () => void;
}

// Default shortcuts
export const DEFAULT_SHORTCUTS: Omit<ShortcutDefinition, 'action'>[] = [
  { key: '1', ctrl: true, description: 'Go to Streams tab' },
  { key: '2', ctrl: true, description: 'Go to Manifest tab' },
  { key: '3', ctrl: true, description: 'Go to Metrics tab' },
  { key: '4', ctrl: true, description: 'Go to DRM tab' },
  { key: '5', ctrl: true, description: 'Go to Network tab' },
  { key: '6', ctrl: true, description: 'Go to Errors tab' },
  { key: '7', ctrl: true, description: 'Go to Export tab' },
  { key: 'k', ctrl: true, description: 'Open Command Palette' },
  { key: 'l', ctrl: true, description: 'Clear all streams' },
  { key: 'e', ctrl: true, description: 'Export session' },
  { key: 'r', ctrl: true, description: 'Refresh streams' },
  { key: 's', ctrl: true, description: 'Start/Stop metrics collection' },
  { key: 'Escape', description: 'Close dialogs/panels' },
];

export function useKeyboardShortcuts(shortcuts: ShortcutDefinition[]) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Allow Escape to work in inputs
        if (event.key !== 'Escape') {
          return;
        }
      }

      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          event.preventDefault();
          shortcut.action();
          return;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

// Format shortcut for display
export function formatShortcut(shortcut: Omit<ShortcutDefinition, 'action'>): string {
  const parts: string[] = [];
  if (shortcut.ctrl) parts.push('Ctrl');
  if (shortcut.shift) parts.push('Shift');
  if (shortcut.alt) parts.push('Alt');
  parts.push(shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key);
  return parts.join('+');
}

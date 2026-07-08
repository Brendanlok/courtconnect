'use client';
import { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Gives a modal overlay Escape-to-close, a trapped Tab cycle, and dialog
 * semantics. Attach the returned ref + dialogProps to the modal panel
 * (the inner content div, not the fixed-inset backdrop).
 */
export function useModalA11y(open: boolean, onClose: () => void, label: string) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const panel = ref.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const firstField = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (firstField ?? panel)?.focus();

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter(el => el.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  return {
    ref,
    dialogProps: {
      role: 'dialog' as const,
      'aria-modal': true as const,
      'aria-label': label,
      tabIndex: -1,
    },
  };
}

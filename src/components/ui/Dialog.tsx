import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), not([tabindex="-1"])';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Accessible modal dialog.
 *
 * Features:
 * - Focus trapping with Tab and Shift+Tab
 * - Escape-to-close
 * - Focus restoration when closed
 * - Page scroll locking while open
 *
 * The latest onClose callback is stored in a ref. This prevents the modal
 * focus effect from restarting whenever a parent component re-renders.
 *
 * This is important on the Today page because live timers update every
 * second. Restarting the focus effect on every timer update would move focus
 * back to the first field and close an open select dropdown.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  const titleId = useId();
  const descriptionId = useId();

  /**
   * Keep the ref updated with the newest callback without making onClose
   * a dependency of the focus-management effect.
   */
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  /**
   * Keyboard handling remains stable across parent re-renders.
   */
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onCloseRef.current();
      return;
    }

    if (event.key !== 'Tab' || !panelRef.current) {
      return;
    }

    const focusableElements = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
    ).filter(
      (element) =>
        element.offsetParent !== null &&
        !element.hasAttribute('disabled') &&
        element.getAttribute('aria-hidden') !== 'true',
    );

    if (focusableElements.length === 0) {
      event.preventDefault();
      panelRef.current.focus();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (!firstElement || !lastElement) {
      return;
    }

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }, []);

  /**
   * Set up focus handling only when the dialog opens or closes.
   *
   * It does not restart when the parent page re-renders every second.
   */
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown, true);

    const focusTimer = window.setTimeout(() => {
      if (!panelRef.current) {
        return;
      }

      const firstFocusableElement =
        panelRef.current.querySelector<HTMLElement>(FOCUSABLE);

      if (firstFocusableElement) {
        firstFocusableElement.focus();
      } else {
        panelRef.current.focus();
      }
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = previousOverflow;

      const previousFocus = previousFocusRef.current;

      window.setTimeout(() => {
        if (previousFocus?.isConnected) {
          previousFocus.focus();
        }
      }, 0);
    };
  }, [open, handleKeyDown]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      aria-live="polite"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-slate-900/50 backdrop-blur-[1px]"
        onClick={() => onCloseRef.current()}
        aria-label="Close dialog"
        tabIndex={-1}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          'relative z-10 max-h-[92vh] w-full overflow-y-auto',
          'rounded-t-2xl bg-white shadow-xl sm:rounded-2xl',
          'dark:bg-slate-900',
          size === 'sm' && 'sm:max-w-md',
          size === 'md' && 'sm:max-w-lg',
          size === 'lg' && 'sm:max-w-3xl',
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              {title}
            </h2>

            {description ? (
              <p
                id={descriptionId}
                className="mt-0.5 text-sm text-slate-500 dark:text-slate-400"
              >
                {description}
              </p>
            ) : null}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCloseRef.current()}
            aria-label="Close dialog"
            className="shrink-0"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </header>

        <div className="px-5 py-4">{children}</div>

        {footer ? (
          <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
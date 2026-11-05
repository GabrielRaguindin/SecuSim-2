'use client';

import { useEffect, useId, useRef } from 'react';
import Icon from './Icon';

/**
 * A modal sheet built on the native <dialog>, so focus is trapped, Esc works and
 * the page behind is inert without any extra code. It springs in, and eases out.
 * Mark the element that should get focus first with `data-autofocus`.
 * `header` replaces the plain title with your own markup; `title` is then the accessible name.
 */
export default function Sheet({ open, onClose, title, header = null, children, dismissible = true }) {
  const ref = useRef(null);
  const titleId = useId();
  const closeTimer = useRef(null);
  const openedAt = useRef(0);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return undefined;
    window.clearTimeout(closeTimer.current);

    if (open) {
      if (!dialog.open) openedAt.current = performance.now();
      if (!dialog.open) dialog.showModal();
      dialog.dataset.state = 'open';
      const first = dialog.querySelector('[data-autofocus]');
      if (first) first.focus({ preventScroll: true });
    } else if (dialog.open) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      dialog.dataset.state = 'closing';
      closeTimer.current = window.setTimeout(() => {
        dialog.close();
        dialog.dataset.state = '';
      }, reduce ? 0 : 230);
    }
    return () => window.clearTimeout(closeTimer.current);
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sx-sheet"
      aria-labelledby={header ? undefined : titleId}
      aria-label={header ? title : undefined}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) onClose?.();
      }}
      onClick={(e) => {
        // A tap that opened the sheet is followed by a synthetic click, which now lands on the backdrop.
        // Ignore backdrop clicks for a moment after opening, or the sheet closes the instant it appears.
        if (dismissible && e.target === e.currentTarget && performance.now() - openedAt.current > 450) onClose?.();
      }}
    >
      <div className="sx-sheet__scroll">
        <div className="sx-sheet__head">
          {header ?? <h2 id={titleId} className="sx-title-2">{title}</h2>}
          {dismissible && (
            <button type="button" className="sx-iconbtn" onClick={onClose} aria-label="Close">
              <Icon name="x" />
            </button>
          )}
        </div>
        {children}
      </div>
    </dialog>
  );
}

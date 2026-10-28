'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export function useToast() {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    setToast((t) => (t ? { ...t, visible: false } : t));
  }, []);

  const show = useCallback(
    (message, action) => {
      window.clearTimeout(timer.current);
      setToast({ message, action, visible: true });
      timer.current = window.setTimeout(hide, action ? 6000 : 2600);
    },
    [hide]
  );

  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { toast, show, hide };
}

export function ToastRegion({ toast, onHide }) {
  return (
    <div className="sx-toast-region" role="status" aria-live="polite">
      <div className="sx-toast" data-visible={Boolean(toast?.visible)}>
        <span>{toast?.message}</span>
        {toast?.action && (
          <button
            type="button"
            className="sx-toast__action"
            onClick={() => {
              toast.action.onClick();
              onHide();
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
    </div>
  );
}

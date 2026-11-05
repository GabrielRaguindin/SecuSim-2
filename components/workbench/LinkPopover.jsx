'use client';

import { useEffect, useRef } from 'react';
import Icon from '@/components/ui/Icon';
import Segmented from '@/components/ui/Segmented';
import { CABLES, CABLE_IDS, cableLabel, explainCable, requiredCable } from '@/lib/cabling.js';
import { popoverPlacement } from '@/lib/overlays.js';

/**
 * What you see when you double-click a link: who it joins, the cable, whether it is the right one,
 * and the option to remove it. It hangs from the middle of the link, and closes on Escape, on a click
 * anywhere else, or when the link goes away.
 */
export default function LinkPopover({ doc, edgeId, size, disabled, dispatch, onClose, onRemove }) {
  const ref = useRef(null);
  const edge = doc.edges.find((e) => e.id === edgeId) ?? null;
  const a = edge ? doc.nodes.find((n) => n.id === edge.a) : null;
  const b = edge ? doc.nodes.find((n) => n.id === edge.b) : null;
  const present = Boolean(edge && a && b);

  useEffect(() => {
    if (!present) onClose();
  }, [present, onClose]);

  useEffect(() => {
    if (!present) return undefined;
    ref.current?.focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    const onDown = (e) => {
      if (!ref.current?.contains(e.target)) onClose();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onDown, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onDown, true);
    };
  }, [present, onClose]);

  if (!present) return null;
  const need = requiredCable(a.type, b.type);
  const have = edge.cable ?? 'straight';
  const wrong = have !== need;
  const place = popoverPlacement({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, size);

  return (
    <div
      ref={ref}
      className="sx-glass sx-popover"
      role="dialog"
      aria-label={`Link between ${a.name} and ${b.name}`}
      tabIndex={-1}
      data-placement={place.placement}
      style={{ left: place.left, top: place.top }}
    >
      <header className="sx-popover__head">
        <div>
          <h3 className="sx-title-3">Link</h3>
          <p className="sx-caption">{a.name} to {b.name}</p>
        </div>
        <button type="button" className="sx-iconbtn" onClick={onClose} aria-label="Close">
          <Icon name="x" size={18} />
        </button>
      </header>

      <div className="sx-field">
        <span className="sx-field__label">Cable</span>
        <Segmented
          label="Cable type"
          options={CABLE_IDS.map((id) => ({ value: id, label: CABLES[id].label }))}
          value={have}
          onChange={(cable) => { if (!disabled) dispatch({ type: 'setCable', id: edge.id, cable }); }}
        />
      </div>

      <p className="sx-caption sx-cablenote" data-wrong={wrong} role="status">
        <strong>{wrong ? `Wrong cable. This link needs ${cableLabel(need).toLowerCase()}. ` : 'Right cable. '}</strong>
        {explainCable(a.type, b.type)}
      </p>

      <button type="button" className="sx-btn sx-btn--danger sx-btn--block" disabled={disabled} onClick={() => onRemove(edge.id)}>
        <Icon name="trash" size={18} /> Remove link
      </button>
    </div>
  );
}

'use client';

import { useRef, useState } from 'react';
import DeviceGlyph from '@/components/ui/DeviceGlyph';
import { DEVICE_TYPES } from '@/lib/devices.js';

/**
 * The device tray. Drag a tile onto the canvas (a ghost follows your pointer),
 * or tap / press Enter to drop it in the next free spot.
 */
export default function DeviceDock({ types, onDrop, onTap, getStageRect, disabled }) {
  const [ghost, setGhost] = useState(null);
  const press = useRef(null);
  const justDragged = useRef(false);

  const onPointerDown = (e, type) => {
    if (disabled || (e.button !== undefined && e.button !== 0)) return;
    press.current = { type, pointerId: e.pointerId, x: e.clientX, y: e.clientY, dragging: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    const p = press.current;
    if (!p || p.pointerId !== e.pointerId) return;
    if (!p.dragging && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 6) p.dragging = true;
    if (p.dragging) setGhost({ type: p.type, x: e.clientX, y: e.clientY });
  };

  const finish = (e, commit) => {
    const p = press.current;
    if (!p || p.pointerId !== e.pointerId) return;
    press.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    setGhost(null);
    if (!p.dragging) return;
    justDragged.current = true;
    window.setTimeout(() => { justDragged.current = false; }, 0);
    if (!commit) return;
    const rect = getStageRect();
    if (rect && e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
      onDrop(p.type, e.clientX - rect.left, e.clientY - rect.top);
    }
  };

  return (
    <>
      <div className="sx-dock" role="toolbar" aria-label="Devices">
        {types.map((type) => (
          <button
            key={type}
            type="button"
            className="sx-dock__tile"
            data-type={type}
            disabled={disabled}
            aria-label={`Add ${DEVICE_TYPES[type].label}`}
            title={`${DEVICE_TYPES[type].label}: ${DEVICE_TYPES[type].blurb}`}
            onPointerDown={(e) => onPointerDown(e, type)}
            onPointerMove={onPointerMove}
            onPointerUp={(e) => finish(e, true)}
            onPointerCancel={(e) => finish(e, false)}
            onClick={() => {
              if (!justDragged.current) onTap(type);
            }}
          >
            <span className="sx-dock__icon"><DeviceGlyph type={type} size={26} /></span>
            <span className="sx-dock__label">{DEVICE_TYPES[type].label}</span>
          </button>
        ))}
      </div>
      {ghost && (
        <div className="sx-dock__ghost" data-type={ghost.type} style={{ left: ghost.x, top: ghost.y }} aria-hidden="true">
          <DeviceGlyph type={ghost.type} size={30} />
        </div>
      )}
    </>
  );
}

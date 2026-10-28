'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { CABLES, CABLE_IDS } from '@/lib/cabling.js';
import { IP_CLASSES, IP_CLASS_IDS } from '@/lib/ip.js';

/** Pick a class, and every device that isn't in it gets the next free address from that class. */
function AutoIpMenu({ onPick, disabled }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!wrap.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span ref={wrap}>
      <button
        type="button"
        className="sx-iconbtn"
        aria-label="Assign IP addresses"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Assign IP addresses by class"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="zap" />
      </button>
      {open && (
        <div className="sx-menu" role="menu" aria-label="Assign IP addresses">
          <p className="sx-menu__title">Give every device an address from</p>
          {IP_CLASS_IDS.map((cls) => (
            <button
              key={cls}
              type="button"
              role="menuitem"
              className="sx-menu__item"
              onClick={() => {
                setOpen(false);
                onPick(cls);
              }}
            >
              <span className="sx-callout"><strong>{IP_CLASSES[cls].label}</strong>, {IP_CLASSES[cls].autoPrefix}x</span>
              <small>{IP_CLASSES[cls].use}</small>
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

export default function Toolbar({ tool, setTool, cable, setCable, canUndo, canRedo, onUndo, onRedo, onDelete, canDelete, onAutoIps, onClear, hasNodes, disabled, extra }) {
  return (
    <div className="sx-toolbar">
      <div className="sx-glass sx-toolbar__group" role="toolbar" aria-label="Tools">
        <button type="button" className="sx-iconbtn" aria-pressed={tool === 'select'} onClick={() => setTool('select')} disabled={disabled} aria-label="Select and move" title="Select and move (V)">
          <Icon name="pointer" />
        </button>
        <button type="button" className="sx-iconbtn" aria-pressed={tool === 'link'} onClick={() => setTool('link')} disabled={disabled} aria-label="Link devices" title="Link devices: drag from one to another (L)">
          <Icon name="link" />
        </button>
        <div className="sx-cablesel" role="group" aria-label="Cable for new links">
          <span className="sx-cablesel__label">Cable</span>
          {CABLE_IDS.map((id) => (
            <button key={id} type="button" className="sx-cablesel__btn" aria-pressed={cable === id} disabled={disabled} title={`${CABLES[id].label}: ${CABLES[id].help} (C switches)`} onClick={() => setCable(id)}>
              {CABLES[id].short}
            </button>
          ))}
        </div>
        <span className="sx-toolbar__divider" aria-hidden="true" />
        <button type="button" className="sx-iconbtn" onClick={onUndo} disabled={disabled || !canUndo} aria-label="Undo" title="Undo (Ctrl or ⌘ Z)">
          <Icon name="undo" />
        </button>
        <button type="button" className="sx-iconbtn" onClick={onRedo} disabled={disabled || !canRedo} aria-label="Redo" title="Redo (Shift Ctrl or ⌘ Z)">
          <Icon name="redo" />
        </button>
      </div>

      <div className="sx-glass sx-toolbar__group" role="toolbar" aria-label="Actions">
        <AutoIpMenu onPick={onAutoIps} disabled={disabled || !hasNodes} />
        <button type="button" className="sx-iconbtn" onClick={onDelete} disabled={disabled || !canDelete} aria-label="Delete selection" title="Delete selection (Delete)">
          <Icon name="trash" />
        </button>
        <button type="button" className="sx-iconbtn" onClick={onClear} disabled={disabled || !hasNodes} aria-label="Clear the canvas" title="Clear the canvas">
          <Icon name="reset" />
        </button>
        {extra}
      </div>
    </div>
  );
}

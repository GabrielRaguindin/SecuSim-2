'use client';

import Icon from '@/components/ui/Icon';

export default function Toolbar({ tool, setTool, canUndo, canRedo, onUndo, onRedo, onDelete, canDelete, onAutoIps, onClear, hasNodes, disabled, extra }) {
  return (
    <div className="sx-toolbar">
      <div className="sx-glass sx-toolbar__group" role="toolbar" aria-label="Tools">
        <button type="button" className="sx-iconbtn" aria-pressed={tool === 'select'} onClick={() => setTool('select')} disabled={disabled} aria-label="Select and move" title="Select and move (V)">
          <Icon name="pointer" />
        </button>
        <button type="button" className="sx-iconbtn" aria-pressed={tool === 'link'} onClick={() => setTool('link')} disabled={disabled} aria-label="Link devices" title="Link devices: drag from one to another (L)">
          <Icon name="link" />
        </button>
        <span className="sx-toolbar__divider" aria-hidden="true" />
        <button type="button" className="sx-iconbtn" onClick={onUndo} disabled={disabled || !canUndo} aria-label="Undo" title="Undo (Ctrl or ⌘ Z)">
          <Icon name="undo" />
        </button>
        <button type="button" className="sx-iconbtn" onClick={onRedo} disabled={disabled || !canRedo} aria-label="Redo" title="Redo (Shift Ctrl or ⌘ Z)">
          <Icon name="redo" />
        </button>
      </div>

      <div className="sx-glass sx-toolbar__group" role="toolbar" aria-label="Actions">
        <button type="button" className="sx-iconbtn" onClick={onAutoIps} disabled={disabled || !hasNodes} aria-label="Assign IP addresses to all devices" title="Assign IP addresses to devices that don’t have one">
          <Icon name="zap" />
        </button>
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

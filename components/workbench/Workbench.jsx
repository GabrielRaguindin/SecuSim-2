'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import NetworkCanvas from './NetworkCanvas';
import DeviceDock from './DeviceDock';
import Toolbar from './Toolbar';
import DeviceEditor from './DeviceEditor';
import LinkPopover from './LinkPopover';
import ActionBar from './ActionBar';
import AddressPlan from './AddressPlan';
import Icon from '@/components/ui/Icon';
import { ToastRegion } from '@/components/ui/Toast';
import { clampToBounds, fitToBounds, nextFreeSpot } from '@/lib/network.js';
import { normalizeDoc } from '@/lib/networkReducer.js';
import { nextHint } from '@/lib/hints.js';
import { dismissHint, loadDismissedHints } from '@/lib/storage.js';
import { pluralize } from '@/lib/format.js';

const NO_SELECTION = { nodes: [], edge: null };

/**
 * The shared editing surface used by the sandbox and the simulator:
 * the canvas, toolbar and device dock, and a sidebar for whatever the page puts there plus the address plan.
 *
 * Nothing is configured in the sidebar. A device is edited in a modal (double-click, double-tap, Enter,
 * or the Edit button that floats by a selected device) and a link in a small popover.
 *
 * `net` comes from useNetwork(); `toast` from useToast().
 * A parent can pass `controllerRef` to get `{ loadDoc }` for opening saved networks,
 * and `trace` to show a packet travelling across the canvas.
 */
export default function Workbench({ net, toast, disabled = false, palette, toolbarExtra, sidebarTop, controllerRef, trace = null }) {
  const { doc, dispatch, canUndo, canRedo } = net;
  const stageRef = useRef(null);
  const [size, setSize] = useState({ width: 900, height: 620 });
  const [tool, setTool] = useState('select');
  const [cable, setCable] = useState('straight');
  const [selection, setSelection] = useState(NO_SELECTION);
  const [linkFrom, setLinkFrom] = useState(null);
  const [newNodeId, setNewNodeId] = useState(null);
  const [editor, setEditor] = useState(null); // { ids, open }: ids stay while the modal animates closed
  const [popoverEdge, setPopoverEdge] = useState(null);
  const [dismissed, setDismissed] = useState(null); // null until read from storage, so no hint flashes first
  const editorOpen = Boolean(editor?.open);

  /* Track the stage size so devices stay inside it. */
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const update = () => {
      const r = el.getBoundingClientRect();
      setSize({ width: Math.round(r.width), height: Math.round(r.height) });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => setDismissed(loadDismissedHints()), []);

  const dismiss = useCallback((id) => {
    dismissHint(id);
    setDismissed((list) => (list && !list.includes(id) ? [...list, id] : list));
  }, []);

  /* Keep the selection honest when devices disappear (delete, undo, load). */
  useEffect(() => {
    const ids = new Set(doc.nodes.map((n) => n.id));
    const edgeIds = new Set(doc.edges.map((e) => e.id));
    setSelection((sel) => {
      const nodes = sel.nodes.filter((id) => ids.has(id));
      const edge = sel.edge && edgeIds.has(sel.edge) ? sel.edge : null;
      return nodes.length === sel.nodes.length && edge === sel.edge ? sel : { nodes, edge };
    });
    setLinkFrom((from) => (from && !ids.has(from) ? null : from));
    // The editor closes when every device it was editing is gone, and drops the ones that went.
    setEditor((e) => {
      if (!e || !e.open) return e;
      const kept = e.ids.filter((id) => ids.has(id));
      if (kept.length === 0) return { ...e, open: false };
      return kept.length === e.ids.length ? e : { ...e, ids: kept };
    });
  }, [doc]);

  /* The first link ends the "link" hint for good. */
  useEffect(() => {
    if (dismissed && doc.edges.length > 0 && !dismissed.includes('link')) dismiss('link');
  }, [doc.edges.length, dismissed, dismiss]);

  const closeEditor = useCallback(() => setEditor((e) => (e ? { ...e, open: false } : e)), []);
  const closePopover = useCallback(() => setPopoverEdge(null), []);

  /* A timed scenario that isn't running can't be edited, so nothing stays open. */
  useEffect(() => {
    if (disabled) {
      closeEditor();
      closePopover();
    }
  }, [disabled, closeEditor, closePopover]);

  /* The popover belongs to one selected link. */
  useEffect(() => {
    if (popoverEdge && selection.edge !== popoverEdge) setPopoverEdge(null);
  }, [selection.edge, popoverEdge]);

  const chooseTool = useCallback((next) => {
    setTool(next);
    setLinkFrom(null);
  }, []);

  const undoAction = (label) => ({ label: 'Undo', onClick: () => dispatch({ type: 'undo' }), title: label });

  const docRef = useRef(doc);
  docRef.current = doc;

  const openEditor = (ids) => {
    if (disabled) return;
    const valid = ids.filter((id) => docRef.current.nodes.some((n) => n.id === id));
    if (valid.length === 0) return;
    setPopoverEdge(null);
    setSelection({ nodes: valid, edge: null });
    setEditor({ ids: valid, open: true });
    dismiss('edit');
    if (valid.length > 1) dismiss('multi');
  };

  const openPopover = (edgeId) => {
    if (disabled || !docRef.current.edges.some((e) => e.id === edgeId)) return;
    closeEditor();
    setSelection({ nodes: [], edge: edgeId });
    setPopoverEdge(edgeId);
    dismiss('cable');
  };

  const addDevice = (type, x, y) => {
    const p = clampToBounds({ x, y }, size);
    const id = `n${doc.seq}`;
    dispatch({ type: 'add', nodeType: type, x: p.x, y: p.y });
    setNewNodeId(id);
    setSelection({ nodes: [id], edge: null });
  };

  const tapDevice = (type) => {
    const p = nextFreeSpot(doc.nodes, size);
    addDevice(type, p.x, p.y);
  };

  const removeNodes = (ids) => {
    dispatch({ type: 'remove', ids });
    setSelection(NO_SELECTION);
    closeEditor();
    toast.show(`Removed ${pluralize(ids.length, 'device')}`, undoAction());
  };

  const removeEdge = (id) => {
    dispatch({ type: 'removeEdge', id });
    setSelection(NO_SELECTION);
    closePopover();
    toast.show('Link removed', undoAction());
  };

  const removeSelection = () => {
    if (selection.edge) removeEdge(selection.edge);
    else if (selection.nodes.length) removeNodes(selection.nodes);
  };

  const startLink = (id) => {
    setTool('link');
    setLinkFrom(id);
  };

  const selectAll = () => setSelection({ nodes: doc.nodes.map((n) => n.id), edge: null });

  const loadDoc = (next) => {
    dispatch({ type: 'load', doc: fitToBounds(normalizeDoc(next), size) });
    setSelection(NO_SELECTION);
    setLinkFrom(null);
    closeEditor();
    closePopover();
  };

  if (controllerRef) controllerRef.current = { loadDoc };

  /* Keyboard shortcuts. Ignored while typing and while a sheet is open. */
  const keys = useRef(null);
  keys.current = {
    disabled,
    undo: () => dispatch({ type: 'undo' }),
    redo: () => dispatch({ type: 'redo' }),
    selectAll,
    removeSelection,
    editSelection: () => (selection.edge ? openPopover(selection.edge) : openEditor(selection.nodes)),
    hasSelection: selection.nodes.length > 0 || Boolean(selection.edge),
    chooseTool,
    toggleCable: () => setCable((c) => (c === 'straight' ? 'crossover' : 'straight')),
    clear: () => {
      setSelection(NO_SELECTION);
      chooseTool('select');
    },
  };

  useEffect(() => {
    const onKey = (e) => {
      const k = keys.current;
      if (k.disabled || e.defaultPrevented) return;
      const target = e.target;
      if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (document.querySelector('dialog[open]')) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) k.redo();
        else k.undo();
      } else if (mod && key === 'y') {
        e.preventDefault();
        k.redo();
      } else if (mod && key === 'a') {
        e.preventDefault();
        k.selectAll();
      } else if (!mod && (e.key === 'Delete' || e.key === 'Backspace') && k.hasSelection) {
        e.preventDefault();
        k.removeSelection();
      } else if (!mod && !e.altKey && key === 'v') {
        k.chooseTool('select');
      } else if (!mod && !e.altKey && key === 'l') {
        k.chooseTool('link');
      } else if (!mod && !e.altKey && key === 'c') {
        k.toggleCable();
      } else if (!mod && !e.altKey && key === 'e' && k.hasSelection) {
        e.preventDefault();
        k.editSelection();
      } else if (e.key === 'Escape') {
        k.clear();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const status =
    tool === 'link' ? (linkFrom ? 'Now choose the device to link it to.' : 'Drag from one device to another to link them.') : null;
  const hasSelection = selection.nodes.length > 0 || Boolean(selection.edge);
  const hint = dismissed && !disabled && !editorOpen && !popoverEdge && tool === 'select' ? nextHint(doc, dismissed) : null;

  return (
    <div className="sx-bench">
      <div className="sx-stage" ref={stageRef} data-disabled={disabled} data-tool={tool}>
        <NetworkCanvas
          doc={doc}
          dispatch={dispatch}
          selection={selection}
          onSelect={setSelection}
          tool={tool}
          size={size}
          disabled={disabled}
          newNodeId={newNodeId}
          linkFrom={linkFrom}
          setLinkFrom={setLinkFrom}
          cable={cable}
          trace={trace}
          onEditNodes={openEditor}
          onEditLink={openPopover}
          onLinkRejected={(message) => toast.show(message)}
        />

        {doc.nodes.length === 0 && !disabled && (
          <div className="sx-stage__hint" aria-hidden="true">
            <p className="sx-title-3">Start with a device</p>
            <p className="sx-body">Drag one from the dock below, or tap it.</p>
          </div>
        )}

        <Toolbar
          tool={tool}
          setTool={chooseTool}
          cable={cable}
          setCable={setCable}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={() => dispatch({ type: 'undo' })}
          onRedo={() => dispatch({ type: 'redo' })}
          canDelete={hasSelection}
          onDelete={removeSelection}
          hasNodes={doc.nodes.length > 0}
          onSelectAll={selectAll}
          onAutoIps={(ipClass) => {
            dispatch({ type: 'autoIps', ipClass });
            toast.show(`Gave every addressable device a Class ${ipClass} address.`, undoAction());
          }}
          onClear={() => {
            dispatch({ type: 'clear' });
            setSelection(NO_SELECTION);
            toast.show('Canvas cleared.', undoAction());
          }}
          disabled={disabled}
          extra={toolbarExtra}
        />

        {status && <p className="sx-glass sx-stage__status" role="status">{status}</p>}

        {hint && (
          <div className="sx-glass sx-hint" role="status">
            <span className="sx-hint__icon" aria-hidden="true"><Icon name="info" size={18} /></span>
            <p className="sx-callout">{hint.text}</p>
            <button type="button" className="sx-btn sx-btn--sm" onClick={() => dismiss(hint.id)}>Got it</button>
          </div>
        )}

        {!disabled && tool === 'select' && !editorOpen && !popoverEdge && hasSelection && (
          <ActionBar
            doc={doc}
            selection={selection}
            size={size}
            onEditNodes={openEditor}
            onEditLink={openPopover}
            onLink={startLink}
            onDelete={removeSelection}
          />
        )}

        {popoverEdge && (
          <LinkPopover doc={doc} edgeId={popoverEdge} size={size} disabled={disabled} dispatch={dispatch} onClose={closePopover} onRemove={removeEdge} />
        )}

        <DeviceDock
          types={palette}
          onDrop={addDevice}
          onTap={tapDevice}
          getStageRect={() => stageRef.current?.getBoundingClientRect()}
          disabled={disabled}
        />
      </div>

      <aside className="sx-side" aria-label="Details">
        {sidebarTop}
        <AddressPlan doc={doc} />
      </aside>

      <DeviceEditor
        open={editorOpen}
        ids={editor?.ids ?? []}
        doc={doc}
        dispatch={dispatch}
        disabled={disabled}
        onClose={closeEditor}
        onRemove={removeNodes}
      />

      <ToastRegion toast={toast.toast} onHide={toast.hide} />
    </div>
  );
}

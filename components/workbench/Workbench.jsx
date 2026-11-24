'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import NetworkCanvas from './NetworkCanvas';
import DeviceDock from './DeviceDock';
import Toolbar from './Toolbar';
import DeviceEditor from './DeviceEditor';
import LinkPopover from './LinkPopover';
import ActionBar from './ActionBar';
import ZoomControls from './ZoomControls';
import AddressPlan from './AddressPlan';
import Icon from '@/components/ui/Icon';
import { ToastRegion } from '@/components/ui/Toast';
import { nextFreeSpotIn } from '@/lib/network.js';
import { IDENTITY_VIEW, ZOOM_STEP, clampToWorld, fitView, limitView, panBy, toWorld, usableWorldRect, zoomAt, zoomTo } from '@/lib/view.js';
import { normalizeDoc } from '@/lib/networkReducer.js';
import { nextHint } from '@/lib/hints.js';
import { dismissHint, loadDismissedHints, loadUiPrefs, saveUiPrefs } from '@/lib/storage.js';
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
export default function Workbench({ net, toast, disabled = false, palette, toolbarExtra, sidebarTop, collapsedExtra = null, controllerRef, trace = null }) {
  const { doc, dispatch, canUndo, canRedo } = net;
  const stageRef = useRef(null);
  const [size, setSize] = useState({ width: 900, height: 620 });
  const [tool, setTool] = useState('select');
  const [cable, setCable] = useState('straight');
  const [selection, setSelection] = useState(NO_SELECTION);
  const [linkFrom, setLinkFrom] = useState(null);
  const [newNodeId, setNewNodeId] = useState(null);
  const [editor, setEditor] = useState(null); // { ids, open, token }: ids stay while the modal animates closed
  const editorToken = useRef(0);
  const [view, setView] = useState(IDENTITY_VIEW); // which part of the world is on screen, and how big
  const [collapsed, setCollapsed] = useState(false); // is the side panel hidden?
  const [popoverEdge, setPopoverEdge] = useState(null);
  const [dismissed, setDismissed] = useState(null); // null until read from storage, so no hint flashes first
  const [ready, setReady] = useState(false);
  const editorOpen = Boolean(editor?.open);

  useEffect(() => {
    setReady(true);
  }, []); 

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

  useEffect(() => {
    setDismissed(loadDismissedHints());
    setCollapsed(loadUiPrefs().sidebarCollapsed);
  }, []);

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
    editorToken.current += 1;
    setEditor({ ids: valid, open: true, token: editorToken.current });
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

  /** Adds a device at a place in the world. */
  const addDeviceAt = (type, world) => {
    const p = clampToWorld(world);
    const id = `n${doc.seq}`;
    dispatch({ type: 'add', nodeType: type, x: p.x, y: p.y });
    setNewNodeId(id);
    setSelection({ nodes: [id], edge: null });
  };

  /** The dock reports where a device was dropped on the stage; devices live in the world. */
  const addDevice = (type, x, y) => addDeviceAt(type, toWorld(view, { x, y }));

  /** Tapping a dock tile puts the device where you are looking. */
  const tapDevice = (type) => addDeviceAt(type, nextFreeSpotIn(doc.nodes, usableWorldRect(view, size)));

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

  /* ---------- Moving around ---------- */

  const centre = { x: size.width / 2, y: size.height / 2 };
  const changeView = (next) => {
    setView(next);
    dismiss('move');
  };
  const zoomBy = (factor) => changeView(limitView(zoomAt(view, factor, centre), size));
  const actualSize = () => changeView(limitView(zoomTo(view, 1, centre), size));
  const fit = () => changeView(fitView(doc.nodes, size));
  const panView = (dx, dy) => changeView(limitView(panBy(view, dx, dy), size));
  const toggleSidebar = () => {
    const next = !collapsed;
    setCollapsed(next);
    saveUiPrefs({ sidebarCollapsed: next });
  };

  const selectAll = () => setSelection({ nodes: doc.nodes.map((n) => n.id), edge: null });

  const loadDoc = (next) => {
    const loaded = normalizeDoc(next);
    dispatch({ type: 'load', doc: loaded });
    setView(fitView(loaded.nodes, size));
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
    zoomIn: () => zoomBy(ZOOM_STEP),
    zoomOut: () => zoomBy(1 / ZOOM_STEP),
    actualSize,
    fit,
    pan: panView,
    toggleSidebar,
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
      } else if (!mod && !e.altKey && (key === '+' || key === '=')) {
        e.preventDefault();
        k.zoomIn();
      } else if (!mod && !e.altKey && (key === '-' || key === '_')) {
        e.preventDefault();
        k.zoomOut();
      } else if (!mod && !e.altKey && key === '0') {
        k.fit();
      } else if (!mod && !e.altKey && key === '1') {
        k.actualSize();
      } else if (!mod && !e.altKey && key === 'p') {
        k.toggleSidebar();
      } else if (!mod && key.startsWith('arrow')) {
        // Arrow keys move the view, unless a device has focus: then they nudge it, and that has already been handled.
        e.preventDefault();
        const step = e.shiftKey ? 240 : 80;
        const [dx, dy] = { arrowleft: [step, 0], arrowright: [-step, 0], arrowup: [0, step], arrowdown: [0, -step] }[key] ?? [0, 0];
        k.pan(dx, dy);
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
    <div className="sx-bench" data-collapsed={collapsed} data-ready={ready}>
      <div
        className="sx-stage"
        ref={stageRef}
        data-disabled={disabled}
        data-tool={tool}
        style={{ '--vx': `${view.x}px`, '--vy': `${view.y}px`, '--grid': `${(view.k < 0.5 ? 48 : 24) * view.k}px` }}
      >
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
          view={view}
          onView={changeView}
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
          sidebarCollapsed={collapsed}
          onToggleSidebar={toggleSidebar}
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
            view={view}
            onEditNodes={openEditor}
            onEditLink={openPopover}
            onLink={startLink}
            onDelete={removeSelection}
          />
        )}

        {popoverEdge && (
          <LinkPopover doc={doc} edgeId={popoverEdge} size={size} view={view} disabled={disabled} dispatch={dispatch} onClose={closePopover} onRemove={removeEdge} />
        )}

        {collapsed && collapsedExtra}

        <ZoomControls view={view} onZoomIn={() => zoomBy(ZOOM_STEP)} onZoomOut={() => zoomBy(1 / ZOOM_STEP)} onActualSize={actualSize} onFit={fit} hasNodes={doc.nodes.length > 0} />

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
        token={editor?.token ?? 0}
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

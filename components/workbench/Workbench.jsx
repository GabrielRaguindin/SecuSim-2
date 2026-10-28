'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import NetworkCanvas from './NetworkCanvas';
import DeviceDock from './DeviceDock';
import Toolbar from './Toolbar';
import Inspector from './Inspector';
import AddressPlan from './AddressPlan';
import { ToastRegion } from '@/components/ui/Toast';
import { clampToBounds, fitToBounds, nextFreeSpot } from '@/lib/network.js';
import { normalizeDoc } from '@/lib/networkReducer.js';
import { pluralize } from '@/lib/format.js';

const NO_SELECTION = { nodes: [], edge: null };

/**
 * The shared editing surface used by the sandbox and the simulator:
 * canvas, toolbar, device dock and the inspector sidebar.
 *
 * `net` comes from useNetwork(); `toast` from useToast().
 * A parent can pass `controllerRef` to get `{ loadDoc }` for opening saved networks.
 */
export default function Workbench({ net, toast, disabled = false, palette, toolbarExtra, sidebarTop, controllerRef }) {
  const { doc, dispatch, canUndo, canRedo } = net;
  const stageRef = useRef(null);
  const [size, setSize] = useState({ width: 900, height: 620 });
  const [tool, setTool] = useState('select');
  const [cable, setCable] = useState('straight');
  const [selection, setSelection] = useState(NO_SELECTION);
  const [linkFrom, setLinkFrom] = useState(null);
  const [newNodeId, setNewNodeId] = useState(null);

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
  }, [doc]);

  const chooseTool = useCallback((next) => {
    setTool(next);
    setLinkFrom(null);
  }, []);

  const undoAction = (label) => ({ label: 'Undo', onClick: () => dispatch({ type: 'undo' }), title: label });

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
    toast.show(`Removed ${pluralize(ids.length, 'device')}`, undoAction());
  };

  const removeEdge = (id) => {
    dispatch({ type: 'removeEdge', id });
    setSelection(NO_SELECTION);
    toast.show('Link removed', undoAction());
  };

  const removeSelection = () => {
    if (selection.edge) removeEdge(selection.edge);
    else if (selection.nodes.length) removeNodes(selection.nodes);
  };

  const loadDoc = (next) => {
    dispatch({ type: 'load', doc: fitToBounds(normalizeDoc(next), size) });
    setSelection(NO_SELECTION);
    setLinkFrom(null);
  };

  if (controllerRef) controllerRef.current = { loadDoc };

  /* Keyboard shortcuts. Ignored while typing and while a sheet is open. */
  const keys = useRef(null);
  keys.current = {
    disabled,
    undo: () => dispatch({ type: 'undo' }),
    redo: () => dispatch({ type: 'redo' }),
    selectAll: () => setSelection({ nodes: doc.nodes.map((n) => n.id), edge: null }),
    removeSelection,
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
      } else if (e.key === 'Escape') {
        k.clear();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const status =
    tool === 'link' ? (linkFrom ? 'Now choose the device to link it to.' : 'Drag from one device to another to link them.') : null;

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
          canDelete={selection.nodes.length > 0 || Boolean(selection.edge)}
          onDelete={removeSelection}
          hasNodes={doc.nodes.length > 0}
          onAutoIps={(ipClass) => {
            dispatch({ type: 'autoIps', ipClass });
            toast.show(`Gave every device a Class ${ipClass} address.`, undoAction());
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
        <Inspector
          doc={doc}
          selection={selection}
          dispatch={dispatch}
          disabled={disabled}
          onRemoveNodes={removeNodes}
          onRemoveEdge={removeEdge}
        />
        <AddressPlan doc={doc} />
      </aside>

      <ToastRegion toast={toast.toast} onHide={toast.hide} />
    </div>
  );
}

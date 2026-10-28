'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GlyphPaths } from '@/components/ui/DeviceGlyph';
import { NODE_SIZE, clampToBounds, edgeId } from '@/lib/network.js';
import { isSettled, projectRelease, stepSpring, velocityFromSamples } from '@/lib/spring.js';
import { DEVICE_ORDER } from '@/lib/devices.js';
import { canConnect } from '@/lib/networkReducer.js';
import { cableLabel, requiredCable } from '@/lib/cabling.js';
import { usePrefersReducedMotion } from '@/components/hooks.js';

const HALF = NODE_SIZE / 2;
const HIT_RADIUS = 46;
const MAX_THROW = 2600;

/**
 * The drawing surface. Positions are in CSS pixels relative to the canvas.
 *
 * Gestures:
 *  - drag a device: it lifts, follows the finger, and glides to rest with the speed you let go at.
 *    Grab it again mid-glide and it stops under your finger.
 *  - Link tool: drag from one device to another, or click one then the other.
 *    New links use the cable chosen in the toolbar. A link with the wrong cable for its two devices is flagged.
 *  - Shift/Cmd/Ctrl click adds to the selection. Arrow keys nudge the selection.
 */
export default function NetworkCanvas({ doc, dispatch, selection, onSelect, tool, size, disabled, newNodeId, onLinkRejected, linkFrom, setLinkFrom, cable, trace }) {
  const svgRef = useRef(null);
  const drag = useRef(null);
  const anim = useRef(null);
  const docRef = useRef(doc);
  const selRef = useRef(selection);
  const sizeRef = useRef(size);
  const cableRef = useRef(cable);
  cableRef.current = cable;
  docRef.current = doc;
  selRef.current = selection;
  sizeRef.current = size;

  const reduced = usePrefersReducedMotion();
  const [cursor, setCursor] = useState(null);
  const [draggingId, setDraggingId] = useState(null);

  const toLocal = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const cancelMomentum = useCallback(() => {
    if (anim.current) cancelAnimationFrame(anim.current);
    anim.current = null;
  }, []);

  useEffect(() => cancelMomentum, [cancelMomentum]);
  useEffect(() => {
    if (disabled) cancelMomentum();
  }, [disabled, cancelMomentum]);

  const hitTest = (p, excludeId) => {
    let best = null;
    let bestDistance = HIT_RADIUS;
    for (const n of docRef.current.nodes) {
      if (n.id === excludeId) continue;
      const d = Math.hypot(n.x - p.x, n.y - p.y);
      if (d < bestDistance) {
        best = n.id;
        bestDistance = d;
      }
    }
    return best;
  };

  const tryConnect = (a, b) => {
    const verdict = canConnect(docRef.current, a, b);
    if (!verdict.ok) {
      onLinkRejected?.(verdict.reason);
      return;
    }
    dispatch({ type: 'connect', a, b, cable: cableRef.current });
  };

  const startMomentum = (ids, velocity) => {
    const vx = Math.max(-MAX_THROW, Math.min(MAX_THROW, velocity.x));
    const vy = Math.max(-MAX_THROW, Math.min(MAX_THROW, velocity.y));
    const items = [];
    for (const id of ids) {
      const n = docRef.current.nodes.find((m) => m.id === id);
      if (!n) continue;
      const target = clampToBounds(
        { x: projectRelease(n.x, vx, 0.985), y: projectRelease(n.y, vy, 0.985) },
        sizeRef.current
      );
      items.push({ id, sx: { x: n.x, v: vx }, sy: { x: n.y, v: vy }, tx: target.x, ty: target.y });
    }
    if (items.every((it) => Math.hypot(it.tx - it.sx.x, it.ty - it.sy.x) < 1.5)) return;

    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.032, Math.max(0.001, (now - last) / 1000));
      last = now;
      let done = true;
      const positions = {};
      for (const it of items) {
        it.sx = stepSpring(it.sx, it.tx, dt);
        it.sy = stepSpring(it.sy, it.ty, dt);
        if (!isSettled(it.sx, it.tx) || !isSettled(it.sy, it.ty)) done = false;
        positions[it.id] = { x: it.sx.x, y: it.sy.x };
      }
      if (done) for (const it of items) positions[it.id] = { x: it.tx, y: it.ty };
      dispatch({ type: 'preview', positions });
      anim.current = done ? null : requestAnimationFrame(tick);
    };
    anim.current = requestAnimationFrame(tick);
  };

  /* ---------- Device gestures ---------- */

  const onNodePointerDown = (e, node) => {
    if (disabled || (e.button !== undefined && e.button !== 0)) return;
    e.stopPropagation();
    cancelMomentum();
    const p = toLocal(e);

    if (tool === 'link') {
      if (linkFrom && linkFrom !== node.id) {
        tryConnect(linkFrom, node.id);
        setLinkFrom(null);
        setCursor(null);
        return;
      }
      setLinkFrom(node.id);
      setCursor(p);
      drag.current = { mode: 'link', id: node.id, start: p, moved: false, pointerId: e.pointerId };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    const current = selRef.current.nodes;
    let ids = current;
    if (additive) {
      ids = current.includes(node.id) ? current.filter((i) => i !== node.id) : [...current, node.id];
      onSelect({ nodes: ids, edge: null });
      if (!ids.includes(node.id)) return;
    } else if (!current.includes(node.id)) {
      ids = [node.id];
      onSelect({ nodes: ids, edge: null });
    }

    const origins = {};
    for (const id of ids) {
      const n = docRef.current.nodes.find((m) => m.id === id);
      if (n) origins[id] = { x: n.x, y: n.y };
    }
    drag.current = {
      mode: 'move',
      ids,
      start: p,
      origins,
      moved: false,
      samples: [{ t: performance.now(), x: p.x, y: p.y }],
      pointerId: e.pointerId,
      collapseTo: !additive && current.length > 1 && current.includes(node.id) ? node.id : null,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onNodePointerMove = (e) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const p = toLocal(e);

    if (d.mode === 'link') {
      setCursor(p);
      if (Math.hypot(p.x - d.start.x, p.y - d.start.y) > 8) d.moved = true;
      return;
    }

    const dx = p.x - d.start.x;
    const dy = p.y - d.start.y;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < 4) return;
      d.moved = true;
      dispatch({ type: 'checkpoint' });
      setDraggingId(d.ids[0]);
    }
    d.samples.push({ t: performance.now(), x: p.x, y: p.y });
    if (d.samples.length > 8) d.samples.shift();

    const positions = {};
    for (const id of d.ids) {
      const o = d.origins[id];
      if (o) positions[id] = clampToBounds({ x: o.x + dx, y: o.y + dy }, sizeRef.current);
    }
    dispatch({ type: 'preview', positions });
  };

  const onNodePointerUp = (e) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    setDraggingId(null);
    const p = toLocal(e);

    if (d.mode === 'link') {
      if (d.moved) {
        const target = hitTest(p, d.id);
        if (target) tryConnect(d.id, target);
        setLinkFrom(null);
        setCursor(null);
      }
      return; // a plain click keeps the source armed, waiting for the second device
    }

    if (!d.moved) {
      if (d.collapseTo) onSelect({ nodes: [d.collapseTo], edge: null });
      return;
    }
    if (!reduced) startMomentum(d.ids, velocityFromSamples(d.samples));
  };

  const onNodePointerCancel = () => {
    drag.current = null;
    setDraggingId(null);
    setCursor(null);
  };

  const onNodeKeyDown = (e, node) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const additive = e.shiftKey || e.metaKey || e.ctrlKey;
      if (tool === 'link') {
        if (linkFrom && linkFrom !== node.id) {
          tryConnect(linkFrom, node.id);
          setLinkFrom(null);
        } else {
          setLinkFrom(node.id);
        }
        return;
      }
      const current = selRef.current.nodes;
      const next = additive
        ? current.includes(node.id) ? current.filter((i) => i !== node.id) : [...current, node.id]
        : [node.id];
      onSelect({ nodes: next, edge: null });
      return;
    }
    const step = e.shiftKey ? 32 : 8;
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!delta) return;
    e.preventDefault();
    const ids = selRef.current.nodes.includes(node.id) ? selRef.current.nodes : [node.id];
    const positions = {};
    for (const id of ids) {
      const n = docRef.current.nodes.find((m) => m.id === id);
      if (n) positions[id] = clampToBounds({ x: n.x + delta[0], y: n.y + delta[1] }, sizeRef.current);
    }
    dispatch({ type: 'checkpoint' });
    dispatch({ type: 'preview', positions });
  };

  /* ---------- Background and links ---------- */

  const onBackgroundPointerDown = (e) => {
    if (disabled) return;
    if (!(e.shiftKey || e.metaKey || e.ctrlKey)) onSelect({ nodes: [], edge: null });
    setLinkFrom(null);
    setCursor(null);
  };

  const onSvgPointerMove = (e) => {
    if (linkFrom && tool === 'link' && !drag.current) setCursor(toLocal(e));
  };

  const source = linkFrom ? doc.nodes.find((n) => n.id === linkFrom) : null;
  const nodeById = new Map(doc.nodes.map((n) => [n.id, n]));

  /* A packet in flight: which links it has crossed, where it is, and how it ended. */
  const traceEdges = new Set();
  const traceNodes = new Map();
  let packet = null;
  let marker = null;
  if (trace && trace.path.length > 0) {
    const last = trace.path.length - 1;
    const at = Math.min(trace.step, last);
    for (let i = 0; i < at; i += 1) traceEdges.add(edgeId(trace.path[i], trace.path[i + 1]));
    for (let i = 0; i <= at; i += 1) traceNodes.set(trace.path[i], 'passed');
    traceNodes.set(trace.path[at], 'current');
    if (trace.done) {
      if (trace.ok) traceNodes.set(trace.path[last], 'delivered');
      else if (trace.failNode) traceNodes.set(trace.failNode, 'failed');
      const failEdge = trace.failEdge ? doc.edges.find((e) => e.id === trace.failEdge) : null;
      if (trace.ok) {
        const end = nodeById.get(trace.path[last]);
        if (end) marker = { kind: 'ok', x: end.x, y: end.y - HALF - 14 };
      } else if (failEdge) {
        const a = nodeById.get(failEdge.a);
        const b = nodeById.get(failEdge.b);
        if (a && b) marker = { kind: 'fail', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      } else if (trace.failNode) {
        const n = nodeById.get(trace.failNode);
        if (n) marker = { kind: 'fail', x: n.x, y: n.y - HALF - 14 };
      }
    } else {
      packet = nodeById.get(trace.path[at]) ?? null;
    }
  }

  return (
    <svg
      ref={svgRef}
      className="sx-canvas"
      data-tool={tool}
      width={size.width}
      height={size.height}
      role="group"
      aria-label="Network canvas"
      onPointerDown={onBackgroundPointerDown}
      onPointerMove={onSvgPointerMove}
    >
      <defs>
        {DEVICE_ORDER.map((type) => (
          <linearGradient key={type} id={`sx-grad-${type}`} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0" style={{ stopColor: `var(--dev-${type}-top)` }} />
            <stop offset="1" style={{ stopColor: `var(--dev-${type})` }} />
          </linearGradient>
        ))}
      </defs>

      <g>
        {doc.edges.map((edge) => {
          const a = nodeById.get(edge.a);
          const b = nodeById.get(edge.b);
          if (!a || !b) return null;
          const selected = selection.edge === edge.id;
          const need = requiredCable(a.type, b.type);
          const wrong = (edge.cable ?? 'straight') !== need;
          const mark = wrong ? '!' : edge.cable === 'crossover' ? 'X' : null;
          return (
            <g key={edge.id}>
              <line
                className="sx-edge"
                data-selected={selected}
                data-cable={edge.cable}
                data-wrong={wrong}
                data-trace={trace?.done && trace.failEdge === edge.id ? 'failed' : traceEdges.has(edge.id) ? 'lit' : undefined}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
              />
              {mark && !(trace?.done && trace.failEdge === edge.id) && (
                <g className="sx-edge__badge" data-wrong={wrong} transform={`translate(${(a.x + b.x) / 2} ${(a.y + b.y) / 2})`}>
                  <circle r="9" />
                  <text y="0.5" textAnchor="middle" dominantBaseline="central">{mark}</text>
                </g>
              )}
              <line
                className="sx-edge-hit"
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                onPointerDown={(e) => {
                  if (disabled) return;
                  e.stopPropagation();
                  onSelect({ nodes: [], edge: edge.id });
                }}
              >
                <title>{`${a.name} to ${b.name}: ${cableLabel(edge.cable).toLowerCase()} cable${wrong ? `, but this link needs ${cableLabel(need).toLowerCase()}` : ''}`}</title>
              </line>
            </g>
          );
        })}
        {source && cursor && (
          <line className="sx-edge sx-edge--ghost" x1={source.x} y1={source.y} x2={cursor.x} y2={cursor.y} />
        )}
      </g>

      <g>
        {doc.nodes.map((node) => {
          const selected = selection.nodes.includes(node.id);
          const policyCount = (doc.policies[node.id] ?? []).length;
          const label = [node.name, node.ip || 'no IP address', policyCount ? `${policyCount} policies` : null, selected ? 'selected' : null]
            .filter(Boolean)
            .join(', ');
          return (
            <g
              key={node.id}
              className="sx-node"
              data-type={node.type}
              data-selected={selected}
              data-dragging={draggingId === node.id}
              data-source={linkFrom === node.id}
              data-trace={traceNodes.get(node.id)}
              style={{ transform: `translate(${node.x}px, ${node.y}px)` }}
              role="button"
              tabIndex={disabled ? -1 : 0}
              aria-label={label}
              onPointerDown={(e) => onNodePointerDown(e, node)}
              onPointerMove={onNodePointerMove}
              onPointerUp={onNodePointerUp}
              onPointerCancel={onNodePointerCancel}
              onKeyDown={(e) => onNodeKeyDown(e, node)}
            >
              <g className={node.id === newNodeId ? 'sx-node__body sx-node__body--new' : 'sx-node__body'}>
                <rect className="sx-node__ring" x={-HALF - 6} y={-HALF - 6} width={NODE_SIZE + 12} height={NODE_SIZE + 12} rx="24" />
                <rect className="sx-node__tile" x={-HALF} y={-HALF} width={NODE_SIZE} height={NODE_SIZE} rx="18" fill={`url(#sx-grad-${node.type})`} />
                <g className="sx-node__glyph" transform="translate(-14 -14) scale(1.1667)">
                  <GlyphPaths type={node.type} />
                </g>
                {policyCount > 0 && (
                  <g className="sx-node__badge" transform={`translate(${HALF - 2} ${-HALF + 2})`}>
                    <circle r="10" />
                    <text y="0.5" textAnchor="middle" dominantBaseline="central">{policyCount}</text>
                  </g>
                )}
              </g>
              <text className="sx-node__name" y={HALF + 20} textAnchor="middle">{node.name}</text>
              {node.ip && (
                <text className="sx-node__ip" y={HALF + 36} textAnchor="middle">{node.ip}</text>
              )}
            </g>
          );
        })}
      </g>

      {(packet || marker) && (
        <g className="sx-trace" aria-hidden="true">
          {packet && (
            <g className="sx-packet" style={{ transform: `translate(${packet.x}px, ${packet.y}px)` }}>
              <circle className="sx-packet__halo" r="17" />
              <circle className="sx-packet__core" r="7" />
            </g>
          )}
          {marker && (
            <g transform={`translate(${marker.x} ${marker.y})`}>
              <g className="sx-trace__badge" data-kind={marker.kind}>
                <circle r="13" />
                <path d={marker.kind === 'ok' ? 'M-5.5 0.5l3.5 3.5l7-8' : 'M-4.5 -4.5l9 9M4.5 -4.5l-9 9'} />
              </g>
            </g>
          )}
        </g>
      )}
    </svg>
  );
}

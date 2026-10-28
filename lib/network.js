/** Pure graph and geometry helpers. Nothing here touches React or the DOM. */

import { DEVICE_TYPES } from './devices.js';

export const edgeId = (a, b) => (a < b ? `${a}~${b}` : `${b}~${a}`);

export const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));

/** Map of node id -> Set of neighbour ids. Ignores self-links and links to missing nodes. */
export function adjacency(nodes, edges) {
  const adj = new Map(nodes.map((n) => [n.id, new Set()]));
  for (const e of edges) {
    if (e.a === e.b || !adj.has(e.a) || !adj.has(e.b)) continue;
    adj.get(e.a).add(e.b);
    adj.get(e.b).add(e.a);
  }
  return adj;
}

export function isConnected(nodes, edges) {
  if (nodes.length === 0) return false;
  const adj = adjacency(nodes, edges);
  const seen = new Set([nodes[0].id]);
  const queue = [nodes[0].id];
  while (queue.length) {
    const current = queue.shift();
    for (const next of adj.get(current)) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen.size === nodes.length;
}

export function countByType(nodes) {
  const counts = {};
  for (const n of nodes) counts[n.type] = (counts[n.type] ?? 0) + 1;
  return counts;
}

/** "PC 3": the smallest unused number for that type, so names never collide. */
export function nextName(nodes, type) {
  const label = DEVICE_TYPES[type]?.label ?? type;
  const used = new Set();
  const pattern = new RegExp(`^${label} (\\d+)$`);
  for (const n of nodes) {
    const m = pattern.exec(n.name ?? '');
    if (m) used.add(Number(m[1]));
  }
  let i = 1;
  while (used.has(i)) i += 1;
  return `${label} ${i}`;
}

/* ---------- Canvas geometry ---------- */

export const NODE_SIZE = 64;
export const DEFAULT_INSETS = { top: 76, right: 48, bottom: 124, left: 48 };

export function usableRect({ width, height, insets = DEFAULT_INSETS }) {
  const left = insets.left;
  const top = insets.top;
  const right = Math.max(left, width - insets.right);
  const bottom = Math.max(top, height - insets.bottom);
  return { left, top, right, bottom };
}

export function clampToBounds(point, bounds) {
  const r = usableRect(bounds);
  return { x: clamp(point.x, r.left, r.right), y: clamp(point.y, r.top, r.bottom) };
}

/** First open spot near the middle of the canvas, spiralling outwards. */
export function nextFreeSpot(nodes, bounds, minGap = 104) {
  const r = usableRect(bounds);
  const cx = (r.left + r.right) / 2;
  const cy = (r.top + r.bottom) / 2;
  const free = (p) =>
    p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom &&
    nodes.every((n) => Math.hypot(n.x - p.x, n.y - p.y) >= minGap);

  if (free({ x: cx, y: cy })) return { x: cx, y: cy };
  for (let ring = 1; ring <= 8; ring += 1) {
    const radius = ring * minGap;
    const steps = Math.max(6, Math.floor((2 * Math.PI * radius) / minGap));
    for (let i = 0; i < steps; i += 1) {
      const angle = (i / steps) * 2 * Math.PI - Math.PI / 2;
      const p = { x: cx + Math.cos(angle) * radius * 1.25, y: cy + Math.sin(angle) * radius };
      if (free(p)) return p;
    }
  }
  return clampToBounds({ x: cx + nodes.length * 14, y: cy + nodes.length * 14 }, bounds);
}

/** Scale and centre a document so every node sits inside the usable area. */
export function fitToBounds(doc, bounds) {
  if (doc.nodes.length === 0) return doc;
  const r = usableRect(bounds);
  const xs = doc.nodes.map((n) => n.x);
  const ys = doc.nodes.map((n) => n.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const fits = minX >= r.left && maxX <= r.right && minY >= r.top && maxY <= r.bottom;
  if (fits) return doc;

  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  const scale = Math.min(1, (r.right - r.left) / w, (r.bottom - r.top) / h);
  const offsetX = (r.left + r.right) / 2 - ((minX + maxX) / 2) * scale;
  const offsetY = (r.top + r.bottom) / 2 - ((minY + maxY) / 2) * scale;
  return {
    ...doc,
    nodes: doc.nodes.map((n) => ({ ...n, x: n.x * scale + offsetX, y: n.y * scale + offsetY })),
  };
}

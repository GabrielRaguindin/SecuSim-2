/**
 * Panning and zooming the canvas. Devices live at fixed positions in a "world"; the view says which part
 * of that world is on screen. A view is { x, y, k }: the world point (wx, wy) is drawn at
 * (wx * k + x, wy * k + y) on the stage, and k is the zoom (1 is actual size).
 * Nothing here touches React or the DOM.
 */

import { NODE_SIZE, DEFAULT_INSETS } from './network.js';

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2.5;
export const ZOOM_STEP = 1.25; // one press of the + or - button
/** Devices can't be dragged further than this from the middle of the world, so numbers stay sane. */
export const WORLD_LIMIT = 4000;
export const IDENTITY_VIEW = { x: 0, y: 0, k: 1 };

const HALF = NODE_SIZE / 2;
const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));

export const clampZoom = (k) => clamp(k, MIN_ZOOM, MAX_ZOOM);

/** A point on the stage, as a point in the world. */
export const toWorld = (view, p) => ({ x: (p.x - view.x) / view.k, y: (p.y - view.y) / view.k });

/** A point in the world, as a point on the stage. */
export const toScreen = (view, p) => ({ x: p.x * view.k + view.x, y: p.y * view.k + view.y });

export const clampToWorld = (p) => ({ x: clamp(p.x, -WORLD_LIMIT, WORLD_LIMIT), y: clamp(p.y, -WORLD_LIMIT, WORLD_LIMIT) });

/** Moves the view so the middle of the stage is still inside the world: a pan can never lose the canvas. */
export function limitView(view, size) {
  const cx = size.width / 2;
  const cy = size.height / 2;
  const world = toWorld(view, { x: cx, y: cy });
  const wx = clamp(world.x, -WORLD_LIMIT, WORLD_LIMIT);
  const wy = clamp(world.y, -WORLD_LIMIT, WORLD_LIMIT);
  if (wx === world.x && wy === world.y) return view;
  return { ...view, x: cx - wx * view.k, y: cy - wy * view.k };
}

/**
 * Zooms by `factor` around a point on the stage, so whatever is under that point stays under it.
 * Returns the same view object when the zoom is already at its limit.
 */
export function zoomAt(view, factor, center) {
  const k = clampZoom(view.k * factor);
  if (k === view.k) return view;
  const ratio = k / view.k;
  return { x: center.x - (center.x - view.x) * ratio, y: center.y - (center.y - view.y) * ratio, k };
}

/** Zooms to an exact level (1 is actual size) around a point on the stage. */
export const zoomTo = (view, k, center) => zoomAt(view, clampZoom(k) / view.k, center);

export const panBy = (view, dx, dy) => ({ ...view, x: view.x + dx, y: view.y + dy });

/** The part of the world that is on the stage, as { left, top, right, bottom }. */
export function visibleRect(view, size) {
  return { left: (0 - view.x) / view.k, top: (0 - view.y) / view.k, right: (size.width - view.x) / view.k, bottom: (size.height - view.y) / view.k };
}

/**
 * The part of the stage that is free of the toolbar across the top and the dock along the bottom,
 * as a part of the world. New devices appear here, so they appear where you are looking.
 */
export function usableWorldRect(view, size) {
  const inner = {
    x: DEFAULT_INSETS.left,
    y: DEFAULT_INSETS.top,
    right: Math.max(DEFAULT_INSETS.left, size.width - DEFAULT_INSETS.right),
    bottom: Math.max(DEFAULT_INSETS.top, size.height - DEFAULT_INSETS.bottom),
  };
  const a = toWorld(view, { x: inner.x, y: inner.y });
  const b = toWorld(view, { x: inner.right, y: inner.bottom });
  return { left: a.x, top: a.y, right: b.x, bottom: b.y };
}

/**
 * A view that shows every device, centred in the free part of the stage, never zoomed in past `maxZoom`.
 * With no devices it is the plain view.
 */
export function fitView(nodes, size, { maxZoom = 1 } = {}) {
  if (nodes.length === 0) return IDENTITY_VIEW;
  // A device takes up its tile, and the name and address written under it.
  const minX = Math.min(...nodes.map((n) => n.x)) - HALF - 12;
  const maxX = Math.max(...nodes.map((n) => n.x)) + HALF + 12;
  const minY = Math.min(...nodes.map((n) => n.y)) - HALF - 12;
  const maxY = Math.max(...nodes.map((n) => n.y)) + HALF + 48;
  const area = {
    left: DEFAULT_INSETS.left,
    top: DEFAULT_INSETS.top,
    right: Math.max(DEFAULT_INSETS.left + 1, size.width - DEFAULT_INSETS.right),
    bottom: Math.max(DEFAULT_INSETS.top + 1, size.height - DEFAULT_INSETS.bottom),
  };
  const k = clamp(Math.min((area.right - area.left) / (maxX - minX), (area.bottom - area.top) / (maxY - minY), maxZoom), MIN_ZOOM, MAX_ZOOM);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return { x: (area.left + area.right) / 2 - cx * k, y: (area.top + area.bottom) / 2 - cy * k, k };
}

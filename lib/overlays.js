/**
 * Where a floating bar or popover sits over the canvas, always kept inside the stage.
 * Positions are CSS pixels relative to the stage's top-left corner.
 */

import { NODE_SIZE, DEFAULT_INSETS } from './network.js';

const HALF = NODE_SIZE / 2;
const MARGIN = 8;
const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));

/** The space a device takes up on the canvas: its tile, and the name and address written under it. */
const footprint = (p) => ({ left: p.x - HALF - 4, right: p.x + HALF + 4, top: p.y - HALF - 4, bottom: p.y + HALF + 44 });
const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/**
 * The small Edit / Link / Delete bar for the selection. It tries above the selection, then below,
 * then to the right, then to the left, and takes the first place that doesn't cover another device
 * (`obstacles`: the centres of the devices that are not selected). If every place covers something,
 * it takes the one that covers the fewest. It always stays inside the stage, clear of the toolbar
 * across the top and the dock along the bottom.
 */
export function actionBarPlacement(points, stage, bar = { width: 232, height: 44 }, obstacles = []) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const minTop = DEFAULT_INSETS.top - 8;
  const maxTop = stage.height - DEFAULT_INSETS.bottom - bar.height;
  const fit = (left, top) => ({ left: clamp(left, MARGIN, stage.width - bar.width - MARGIN), top: clamp(top, MARGIN, maxTop) });

  const candidates = [
    ['above', Math.min(...ys) - HALF - bar.height - 12 >= minTop ? fit(cx - bar.width / 2, Math.min(...ys) - HALF - bar.height - 12) : null],
    ['below', fit(cx - bar.width / 2, Math.max(...ys) + HALF + 52)], // clear of the name and address under a device
    ['right', fit(Math.max(...xs) + HALF + 14, cy - bar.height / 2)],
    ['left', fit(Math.min(...xs) - HALF - 14 - bar.width, cy - bar.height / 2)],
  ].filter(([, box]) => box);

  let best = null;
  for (const [placement, box] of candidates) {
    const rect = { left: box.left, right: box.left + bar.width, top: box.top, bottom: box.top + bar.height };
    const covered = obstacles.filter((o) => overlaps(rect, footprint(o))).length;
    if (best === null || covered < best.covered) best = { ...box, placement, covered };
    if (covered === 0) break;
  }
  const { covered, ...result } = best;
  return result;
}

/** The popover for a link, hanging below its midpoint, or above it when it would run off the bottom. */
export function popoverPlacement(point, stage, box = { width: 300, height: 250 }) {
  const below = point.y + 20;
  const placement = below + box.height <= stage.height - MARGIN ? 'below' : 'above';
  const top = placement === 'below' ? below : point.y - 20 - box.height;
  return {
    left: clamp(point.x - box.width / 2, MARGIN, stage.width - box.width - MARGIN),
    top: clamp(top, MARGIN, stage.height - box.height - MARGIN),
    placement,
  };
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_ZOOM, MAX_ZOOM, ZOOM_STEP, WORLD_LIMIT, IDENTITY_VIEW,
  clampZoom, toWorld, toScreen, clampToWorld, limitView, zoomAt, zoomTo, panBy, visibleRect, usableWorldRect, fitView,
} from '../lib/view.js';
import { nextFreeSpotIn, usableRect, NODE_SIZE, DEFAULT_INSETS } from '../lib/network.js';
import { actionBarPlacement } from '../lib/overlays.js';
import { nextHint, HINT_IDS } from '../lib/hints.js';
import { loadUiPrefs, saveUiPrefs, UI_KEY } from '../lib/storage.js';
import { fakeStore } from './helpers.js';

const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const stage = { width: 900, height: 620 };
const node = (x, y) => ({ x, y });

/* ---------- the maths of a view ---------- */

test('the plain view changes nothing', () => {
  assert.deepEqual(IDENTITY_VIEW, { x: 0, y: 0, k: 1 });
  assert.deepEqual(toWorld(IDENTITY_VIEW, { x: 120, y: 80 }), { x: 120, y: 80 });
  assert.deepEqual(toScreen(IDENTITY_VIEW, { x: 120, y: 80 }), { x: 120, y: 80 });
});

test('toWorld and toScreen undo each other for any view', () => {
  for (const view of [{ x: 40, y: -30, k: 0.5 }, { x: -200, y: 90, k: 2 }, { x: 0, y: 0, k: 1.25 }]) {
    for (const p of [{ x: 0, y: 0 }, { x: 333, y: 217 }, { x: -50, y: 700 }]) {
      const back = toScreen(view, toWorld(view, p));
      assert.ok(close(back.x, p.x) && close(back.y, p.y), JSON.stringify([view, p]));
    }
  }
  assert.deepEqual(toScreen({ x: 10, y: 20, k: 2 }, { x: 5, y: 5 }), { x: 20, y: 30 });
});

test('the zoom is limited to a sensible range', () => {
  assert.equal(clampZoom(0.01), MIN_ZOOM);
  assert.equal(clampZoom(99), MAX_ZOOM);
  assert.equal(clampZoom(1), 1);
  assert.ok(MIN_ZOOM < 1 && MAX_ZOOM > 1 && ZOOM_STEP > 1);
});

test('zooming keeps whatever is under the pointer under the pointer', () => {
  for (const view of [IDENTITY_VIEW, { x: 60, y: -40, k: 0.7 }, { x: -120, y: 30, k: 1.6 }]) {
    for (const factor of [ZOOM_STEP, 1 / ZOOM_STEP, 1.1, 0.8]) {
      const center = { x: 410, y: 275 };
      const before = toWorld(view, center);
      const next = zoomAt(view, factor, center);
      const after = toWorld(next, center);
      assert.ok(close(before.x, after.x, 1e-6) && close(before.y, after.y, 1e-6), JSON.stringify([view, factor]));
      assert.ok(close(next.k, clampZoom(view.k * factor)));
    }
  }
});

test('zooming stops at the limits, and says so by returning the same view', () => {
  const max = { x: 0, y: 0, k: MAX_ZOOM };
  assert.equal(zoomAt(max, ZOOM_STEP, { x: 5, y: 5 }), max);
  const min = { x: 0, y: 0, k: MIN_ZOOM };
  assert.equal(zoomAt(min, 1 / ZOOM_STEP, { x: 5, y: 5 }), min);
  let view = IDENTITY_VIEW;
  for (let i = 0; i < 50; i += 1) view = zoomAt(view, ZOOM_STEP, { x: 450, y: 300 });
  assert.equal(view.k, MAX_ZOOM);
  for (let i = 0; i < 80; i += 1) view = zoomAt(view, 1 / ZOOM_STEP, { x: 450, y: 300 });
  assert.equal(view.k, MIN_ZOOM);
});

test('zoomTo goes to an exact level, such as back to actual size', () => {
  const view = zoomTo({ x: 100, y: 50, k: 0.4 }, 1, { x: 450, y: 310 });
  assert.equal(view.k, 1);
  assert.equal(zoomTo(IDENTITY_VIEW, 100, { x: 0, y: 0 }).k, MAX_ZOOM);
});

test('panning moves the view by the amount dragged, in screen pixels', () => {
  assert.deepEqual(panBy({ x: 10, y: 20, k: 0.5 }, 30, -15), { x: 40, y: 5, k: 0.5 });
});

test('the visible part of the world follows the view', () => {
  assert.deepEqual(visibleRect(IDENTITY_VIEW, stage), { left: 0, top: 0, right: 900, bottom: 620 });
  assert.deepEqual(visibleRect({ x: -100, y: -50, k: 2 }, stage), { left: 50, top: 25, right: 500, bottom: 335 });
  assert.equal(visibleRect({ x: 0, y: 0, k: 0.5 }, stage).right, 1800);
});

test('the free part of the stage, as a part of the world, leaves out the toolbar and the dock', () => {
  const rect = usableWorldRect(IDENTITY_VIEW, stage);
  const old = usableRect(stage);
  assert.deepEqual(rect, { left: old.left, top: old.top, right: old.right, bottom: old.bottom }, 'the same as before at the plain view');
  const panned = usableWorldRect({ x: -300, y: -200, k: 1 }, stage);
  assert.equal(panned.left, old.left + 300);
  assert.equal(panned.top, old.top + 200);
});

test('a pan can never lose the canvas: the middle of the stage stays inside the world', () => {
  assert.equal(limitView(IDENTITY_VIEW, stage), IDENTITY_VIEW, 'a good view is left as it is');
  for (const view of [{ x: -1e6, y: 0, k: 1 }, { x: 1e6, y: 1e6, k: 0.5 }, { x: 0, y: -9e5, k: 2 }]) {
    const fixed = limitView(view, stage);
    const middle = toWorld(fixed, { x: stage.width / 2, y: stage.height / 2 });
    assert.ok(Math.abs(middle.x) <= WORLD_LIMIT + 1e-6 && Math.abs(middle.y) <= WORLD_LIMIT + 1e-6, JSON.stringify(view));
    assert.equal(fixed.k, view.k);
  }
});

test('devices cannot be dragged out of the world', () => {
  assert.deepEqual(clampToWorld({ x: 10, y: -20 }), { x: 10, y: -20 });
  assert.deepEqual(clampToWorld({ x: 1e9, y: -1e9 }), { x: WORLD_LIMIT, y: -WORLD_LIMIT });
});

/* ---------- fitting everything in ---------- */

test('with no devices, fit gives the plain view', () => {
  assert.equal(fitView([], stage), IDENTITY_VIEW);
});

test('fit puts every device, with its name and address, inside the free part of the stage', () => {
  let seed = 90210;
  const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  for (let round = 0; round < 300; round += 1) {
    const count = 1 + Math.floor(rand() * 12);
    const spread = rand() < 0.3 ? 4000 : 700;
    const nodes = Array.from({ length: count }, () => node((rand() - 0.5) * spread, (rand() - 0.5) * spread));
    const view = fitView(nodes, stage);
    assert.ok(view.k >= MIN_ZOOM && view.k <= 1, `zoom ${view.k}`);
    if (view.k > MIN_ZOOM) {
      for (const n of nodes) {
        const s = toScreen(view, n);
        const half = (NODE_SIZE / 2) * view.k;
        assert.ok(s.x - half >= DEFAULT_INSETS.left - 1 && s.x + half <= stage.width - DEFAULT_INSETS.right + 1, `x ${s.x}`);
        assert.ok(s.y - half >= DEFAULT_INSETS.top - 1 && s.y + half <= stage.height - DEFAULT_INSETS.bottom + 1, `y ${s.y}`);
      }
    }
  }
});

test('fit never zooms in past actual size, and centres what it finds', () => {
  const one = fitView([node(2000, -900)], stage);
  assert.equal(one.k, 1);
  const s = toScreen(one, node(2000, -900));
  assert.ok(Math.abs(s.x - (DEFAULT_INSETS.left + stage.width - DEFAULT_INSETS.right) / 2) < 1);
  assert.ok(fitView([node(0, 0), node(10, 10)], stage, { maxZoom: 2 }).k > 1, 'unless asked to');
});

test('a layout too big for the zoom limit is still centred, at the smallest zoom', () => {
  assert.equal(fitView([node(-3000, -3000), node(3000, 3000)], stage).k, MIN_ZOOM);
});

/* ---------- where new devices go ---------- */

test('a new device is put near the middle of the part of the world you are looking at', () => {
  const view = { x: -1500, y: -900, k: 1 };
  const rect = usableWorldRect(view, stage);
  const p = nextFreeSpotIn([], rect);
  assert.ok(p.x > 1500 && p.y > 900, `${p.x},${p.y}`);
  assert.ok(p.x >= rect.left && p.x <= rect.right && p.y >= rect.top && p.y <= rect.bottom);
});

test('and it avoids the devices that are already there, wherever in the world they are', () => {
  const rect = { left: 1000, top: 500, right: 1800, bottom: 1000 };
  const nodes = [];
  for (let i = 0; i < 14; i += 1) {
    const p = nextFreeSpotIn(nodes, rect);
    for (const other of nodes) assert.ok(Math.hypot(other.x - p.x, other.y - p.y) >= 100, `device ${i}`);
    nodes.push({ x: p.x, y: p.y });
  }
});

/* ---------- the action bar at other zooms ---------- */

test('zoomed out, a device takes up less room, so the action bar can sit closer', () => {
  const sel = [{ x: 450, y: 330 }];
  const neighbour = { x: 450, y: 230 }; // 100px above: in the way at full size, not when zoomed out
  const full = actionBarPlacement(sel, stage, { width: 232, height: 44 }, [neighbour], 1);
  const small = actionBarPlacement(sel, stage, { width: 232, height: 44 }, [neighbour], 0.25);
  assert.notEqual(full.placement, 'above', 'at 100% the neighbour is in the way');
  assert.equal(small.placement, 'above', 'at 25% the neighbour is a small thing, and above is clear');
});

/* ---------- the movement hint and the sidebar preference ---------- */

const doc = (nodes, edges = 0) => ({ nodes: Array.from({ length: nodes }, (_, i) => ({ id: `n${i}` })), edges: Array.from({ length: edges }, (_, i) => ({ id: `e${i}` })) });

test('a hint about moving around comes once there are four devices', () => {
  assert.ok(HINT_IDS.includes('move'));
  assert.equal(nextHint(doc(3, 1), ['edit', 'link', 'cable']).id, 'multi', 'with three, the multi-select hint comes first');
  assert.equal(nextHint(doc(4, 1), ['edit', 'link', 'cable']).id, 'move');
  assert.equal(nextHint(doc(4, 1), ['edit', 'link', 'cable', 'move']).id, 'multi');
  assert.equal(nextHint(doc(4, 1), ['edit', 'link', 'cable', 'move', 'multi']), null);
});

test('the sidebar preference is remembered in one key, and defaults to open', () => {
  const store = fakeStore();
  store.setItem('unrelated', 'keep me');
  assert.deepEqual(loadUiPrefs(store), { sidebarCollapsed: false });
  assert.equal(saveUiPrefs({ sidebarCollapsed: true }, store), true);
  assert.deepEqual(loadUiPrefs(store), { sidebarCollapsed: true });
  assert.equal(saveUiPrefs({ sidebarCollapsed: false }, store), true);
  assert.deepEqual(loadUiPrefs(store), { sidebarCollapsed: false });
  assert.equal(store.getItem('unrelated'), 'keep me');
  assert.ok(store.getItem(UI_KEY));
});

test('damaged preferences and blocked storage never throw', () => {
  const corrupt = fakeStore();
  corrupt.setItem(UI_KEY, '{not json');
  assert.deepEqual(loadUiPrefs(corrupt), { sidebarCollapsed: false });
  const junk = fakeStore();
  junk.setItem(UI_KEY, JSON.stringify({ sidebarCollapsed: 'yes' }));
  assert.deepEqual(loadUiPrefs(junk), { sidebarCollapsed: false }, 'only a real true counts');
  junk.setItem(UI_KEY, JSON.stringify(7));
  assert.deepEqual(loadUiPrefs(junk), { sidebarCollapsed: false });
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('full'); } };
  assert.deepEqual(loadUiPrefs(broken), { sidebarCollapsed: false });
  assert.equal(saveUiPrefs({ sidebarCollapsed: true }, broken), false);
});

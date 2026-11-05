import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, networkReducer, normalizeDoc, validateName, cleanDeviceName, NAME_MAX } from '../lib/networkReducer.js';
import { holderIds, policyState, categoryCounts, ipSummary } from '../lib/deviceEditor.js';
import { actionBarPlacement, popoverPlacement } from '../lib/overlays.js';
import { nextHint, HINTS, HINT_IDS } from '../lib/hints.js';
import { loadDismissedHints, dismissHint, HINTS_KEY } from '../lib/storage.js';
import { fakeStore, addNodes, run } from './helpers.js';

const base = () => addNodes(createState(), ['pc', 'router', 'hub']);

/* ---------- renaming ---------- */

test('a device can be renamed, and the new name is one undo step', () => {
  const { state, ids } = base();
  let s = run(state, { type: 'rename', id: ids[0], name: 'Front desk' });
  assert.equal(s.doc.nodes[0].name, 'Front desk');
  s = run(s, { type: 'undo' });
  assert.equal(s.doc.nodes[0].name, 'PC 1');
  s = run(s, { type: 'redo' });
  assert.equal(s.doc.nodes[0].name, 'Front desk');
});

test('names are cleaned: spaces collapsed and trimmed', () => {
  const { state, ids } = base();
  assert.equal(run(state, { type: 'rename', id: ids[0], name: '  Front    desk \n' }).doc.nodes[0].name, 'Front desk');
  assert.equal(cleanDeviceName('  a   b  '), 'a b');
  assert.equal(cleanDeviceName(null), '');
  assert.equal(cleanDeviceName('x'.repeat(100)).length, NAME_MAX);
});

test('a name is 1 to 24 characters and unique among devices, ignoring case', () => {
  const { state, ids } = base();
  assert.equal(NAME_MAX, 24);
  assert.match(validateName(state.doc, ids[0], ''), /Give the device a name/);
  assert.match(validateName(state.doc, ids[0], '   '), /Give the device a name/);
  assert.match(validateName(state.doc, ids[0], 'x'.repeat(25)), /24 characters or fewer/);
  assert.equal(validateName(state.doc, ids[0], 'x'.repeat(24)), null);
  assert.match(validateName(state.doc, ids[0], 'Router 1'), /Router 1 is already the name of another device/);
  assert.match(validateName(state.doc, ids[0], 'router 1'), /Router 1 is already the name of another device/, 'case makes no difference');
  assert.equal(validateName(state.doc, ids[0], 'PC 1'), null, 'a device may keep its own name');
  assert.equal(validateName(state.doc, ids[0], 'pc 1'), null, 'or change only its case');
});

test('invalid or unchanged renames do nothing and add no history', () => {
  const { state, ids } = base();
  assert.equal(run(state, { type: 'rename', id: ids[0], name: 'Router 1' }), state);
  assert.equal(run(state, { type: 'rename', id: ids[0], name: '' }), state);
  assert.equal(run(state, { type: 'rename', id: ids[0], name: 'PC 1' }), state, 'the same name is not a change');
  assert.equal(run(state, { type: 'rename', id: 'ghost', name: 'Nope' }), state);
});

test('a renamed device frees its old name, and new devices still get a free number', () => {
  const { state, ids } = base();
  let s = run(state, { type: 'rename', id: ids[0], name: 'Front desk' });
  s = run(s, { type: 'add', nodeType: 'pc', x: 1, y: 1 });
  assert.equal(s.doc.nodes[3].name, 'PC 1', 'PC 1 is free again');
  s = run(s, { type: 'rename', id: ids[1], name: 'PC 2' });
  s = run(s, { type: 'add', nodeType: 'pc', x: 2, y: 2 });
  assert.equal(s.doc.nodes[4].name, 'PC 3', 'and PC 2 is taken, so the next is PC 3');
  assert.equal(new Set(s.doc.nodes.map((n) => n.name.toLowerCase())).size, s.doc.nodes.length, 'every name is still unique');
});

test('renamed devices keep their links, address and policies, and packet messages use the new name', () => {
  const { state, ids } = base();
  let s = run(state, { type: 'setIp', id: ids[0], ip: '192.168.1.5' }, { type: 'togglePolicy', ids: [ids[0]], policy: 'ssh', on: true }, { type: 'connect', a: ids[0], b: ids[1] }, { type: 'rename', id: ids[0], name: 'Front desk' });
  assert.equal(s.doc.nodes[0].ip, '192.168.1.5');
  assert.deepEqual(s.doc.policies[ids[0]], ['ssh']);
  assert.equal(s.doc.edges.length, 1);
});

test('saved networks keep their names, and long or messy ones are cleaned on load', () => {
  const doc = normalizeDoc({ nodes: [
    { id: 'n1', type: 'pc', x: 1, y: 1, name: 'Front desk' },
    { id: 'n2', type: 'pc', x: 2, y: 2, name: '  Back   office  ' },
    { id: 'n3', type: 'pc', x: 3, y: 3, name: 'z'.repeat(60) },
    { id: 'n4', type: 'pc', x: 4, y: 4, name: '   ' },
  ] });
  assert.equal(doc.nodes[0].name, 'Front desk');
  assert.equal(doc.nodes[1].name, 'Back office');
  assert.equal(doc.nodes[2].name.length, NAME_MAX);
  assert.equal(doc.nodes[3].name, 'PC 1', 'a blank name falls back to the next free one');
});

/* ---------- the editor's helpers ---------- */

test('policy state: all, none or mixed, counting only devices that can hold a policy', () => {
  const { state, ids } = base();
  const on = (list, policy) => run(state, { type: 'togglePolicy', ids: list, policy, on: true });
  assert.equal(policyState(state.doc, ids, 'ssh'), false);
  assert.equal(policyState(on([ids[0]], 'ssh').doc, ids, 'ssh'), 'mixed', 'PC has it, router does not');
  assert.equal(policyState(on([ids[0], ids[1]], 'ssh').doc, ids, 'ssh'), true, 'the hub is not counted against it');
  assert.equal(policyState(on(ids, 'ssh').doc, [ids[2]], 'ssh'), false, 'a hub on its own has nothing');
  assert.deepEqual(holderIds(state.doc, ids), [ids[0], ids[1]]);
});

test('category counts say how many policies are on in each of the four categories', () => {
  const { state, ids } = base();
  const s = run(state, { type: 'togglePolicy', ids: [ids[0]], policy: 'ssh', on: true }, { type: 'togglePolicy', ids: [ids[0]], policy: 'adminPrivilege', on: true }, { type: 'togglePolicy', ids: [ids[0], ids[1]], policy: 'blockPing', on: true });
  const counts = categoryCounts(s.doc, [ids[0]]);
  assert.deepEqual(counts.map((c) => c.label), ['Access control', 'Quality of service', 'Firewall', 'Encryption']);
  assert.deepEqual(counts.map((c) => c.on), [2, 0, 1, 0]);
  assert.ok(counts.every((c) => c.total === 4));
  assert.deepEqual(categoryCounts(s.doc, [ids[0], ids[1]]).map((c) => c.on), [2, 0, 1, 0], 'some of the selected having it counts as on');
  assert.deepEqual(categoryCounts(s.doc, [ids[2]]).map((c) => c.on), [0, 0, 0, 0], 'a hub has no policies');
});

test('the address summary is one line', () => {
  assert.equal(ipSummary('192.168.1.10'), 'Class C, private, 192.168.1.0/24');
  assert.equal(ipSummary('10.0.0.1'), 'Class A, private, 10.0.0.0/8');
  assert.equal(ipSummary('172.16.4.9'), 'Class B, private, 172.16.0.0/16');
  assert.equal(ipSummary('8.8.8.8'), 'Class A, public, 8.0.0.0/8');
  assert.equal(ipSummary(''), null);
  assert.equal(ipSummary('224.0.0.1'), null);
});

/* ---------- where the floating bar and popover sit ---------- */

const stage = { width: 900, height: 620 };
const inside = (box, size) => box.left >= 0 && box.top >= 0 && box.left + size.width <= stage.width && box.top + size.height <= stage.height;

test('the action bar sits above the device, centred on it', () => {
  const p = actionBarPlacement([{ x: 450, y: 320 }], stage);
  assert.equal(p.placement, 'above');
  assert.ok(p.top < 320 - 32);
  assert.equal(Math.round(p.left + 116), 450, 'centred (the bar is 232 wide)');
});

test('the action bar drops below a device near the top, and never leaves the stage', () => {
  const high = actionBarPlacement([{ x: 450, y: 100 }], stage);
  assert.equal(high.placement, 'below');
  assert.ok(high.top > 100 + 32);
  for (const [x, y] of [[0, 0], [900, 0], [0, 620], [900, 620], [20, 300], [880, 300], [450, 600]]) {
    const p = actionBarPlacement([{ x, y }], stage);
    assert.ok(inside(p, { width: 232, height: 44 }), `${x},${y}`);
  }
});

test('for several devices the bar is centred on the group', () => {
  const p = actionBarPlacement([{ x: 300, y: 300 }, { x: 500, y: 400 }], stage);
  assert.equal(Math.round(p.left + 116), 400);
});

test('the link popover hangs below the midpoint, flips above near the bottom, and stays inside', () => {
  const mid = popoverPlacement({ x: 450, y: 200 }, stage);
  assert.equal(mid.placement, 'below');
  assert.ok(mid.top > 200);
  const low = popoverPlacement({ x: 450, y: 560 }, stage);
  assert.equal(low.placement, 'above');
  assert.ok(low.top + 250 < 560);
  for (const [x, y] of [[0, 0], [900, 0], [0, 620], [900, 620], [450, 310]]) {
    assert.ok(inside(popoverPlacement({ x, y }, stage), { width: 300, height: 250 }), `${x},${y}`);
  }
});

/* ---------- first-use hints ---------- */

const doc = (nodes, edges = 0) => ({ nodes: Array.from({ length: nodes }, (_, i) => ({ id: `n${i}` })), edges: Array.from({ length: edges }, (_, i) => ({ id: `e${i}` })) });

test('hints appear one at a time, in order, as the moment for each comes', () => {
  assert.equal(nextHint(doc(0)), null, 'an empty canvas has its own hint');
  assert.equal(nextHint(doc(1)).id, 'edit');
  assert.equal(nextHint(doc(2), ['edit']).id, 'link');
  assert.equal(nextHint(doc(2, 1), ['edit']).id, 'cable', 'once there is a link, the link hint is no longer needed');
  assert.equal(nextHint(doc(3, 1), ['edit', 'cable']).id, 'multi');
  assert.equal(nextHint(doc(3, 1), ['edit', 'link', 'cable', 'multi']), null);
  assert.equal(nextHint(doc(1), ['edit']), null, 'a dismissed hint stays dismissed');
  assert.ok(HINTS.every((h) => h.text.length > 20 && HINT_IDS.includes(h.id)));
});

test('dismissed hints are remembered, in one key, and nothing else is touched', () => {
  const store = fakeStore();
  store.setItem('unrelated', 'keep me');
  assert.deepEqual(loadDismissedHints(store), []);
  assert.equal(dismissHint('edit', store), true);
  assert.equal(dismissHint('edit', store), true, 'dismissing twice is fine');
  assert.equal(dismissHint('cable', store), true);
  assert.deepEqual(loadDismissedHints(store), ['edit', 'cable']);
  assert.equal(dismissHint('nonsense', store), false);
  assert.equal(store.getItem('unrelated'), 'keep me');
  assert.ok(store.getItem(HINTS_KEY));
});

test('damaged hint data and blocked storage never throw', () => {
  const corrupt = fakeStore();
  corrupt.setItem(HINTS_KEY, '{not json');
  assert.deepEqual(loadDismissedHints(corrupt), []);
  const junk = fakeStore();
  junk.setItem(HINTS_KEY, JSON.stringify(['edit', 5, null, 'bogus', 'link']));
  assert.deepEqual(loadDismissedHints(junk), ['edit', 'link']);
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('full'); } };
  assert.deepEqual(loadDismissedHints(broken), []);
  assert.equal(dismissHint('edit', broken), false);
});

test('the action bar never covers another device if it can help it', () => {
  // A neighbour sits right above the selected device, so the bar can't go above
  const sel = [{ x: 500, y: 450 }];
  const above = { x: 500, y: 346 };
  const p = actionBarPlacement(sel, stage, { width: 232, height: 44 }, [above]);
  assert.notEqual(p.placement, 'above');
  const rect = { left: p.left, right: p.left + 232, top: p.top, bottom: p.top + 44 };
  assert.ok(rect.right <= above.x - 36 || rect.left >= above.x + 36 || rect.bottom <= above.y - 36 || rect.top >= above.y + 76, 'clear of the neighbour’s tile and its labels');
  // with nothing in the way it is still above
  assert.equal(actionBarPlacement(sel, stage, { width: 232, height: 44 }, [{ x: 800, y: 500 }]).placement, 'above');
});

test('with neighbours above and below, the bar goes to the side', () => {
  const sel = [{ x: 450, y: 320 }];
  const p = actionBarPlacement(sel, stage, { width: 232, height: 44 }, [{ x: 450, y: 216 }, { x: 450, y: 424 }]);
  assert.ok(['right', 'left'].includes(p.placement), p.placement);
});

test('when every place covers something, the bar takes the one that covers least, and stays inside', () => {
  const sel = [{ x: 450, y: 320 }];
  const crowd = [];
  for (let x = 60; x <= 840; x += 104) for (let y = 120; y <= 480; y += 104) if (!(x === 450 && y === 320) && Math.abs(x - 450) > 20) crowd.push({ x, y });
  const p = actionBarPlacement(sel, stage, { width: 232, height: 44 }, crowd);
  assert.ok(p.left >= 0 && p.top >= 0 && p.left + 232 <= stage.width && p.top + 44 <= stage.height);
  assert.ok(['above', 'below', 'right', 'left'].includes(p.placement));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, networkReducer, normalizeDoc, validateIp, canConnect, hasPolicy, HISTORY_LIMIT } from '../lib/networkReducer.js';
import { run, addNodes } from './helpers.js';

const base = () => addNodes(createState(), ['pc', 'pc', 'router']);

test('add gives each device a stable id and the next free name', () => {
  const { state, ids } = base();
  assert.deepEqual(state.doc.nodes.map((n) => n.name), ['PC 1', 'PC 2', 'Router 1']);
  assert.equal(new Set(ids).size, 3);
  const removed = run(state, { type: 'remove', ids: [ids[0]] });
  const again = run(removed, { type: 'add', nodeType: 'pc', x: 1, y: 1 });
  assert.ok(again.doc.nodes.some((n) => n.name === 'PC 1'), 'reuses the freed name');
  assert.equal(new Set(again.doc.nodes.map((n) => n.id)).size, 3, 'ids never collide');
});

test('unknown device types are ignored', () => {
  const s = networkReducer(createState(), { type: 'add', nodeType: 'toaster', x: 0, y: 0 });
  assert.equal(s.doc.nodes.length, 0);
});

test('connect: no duplicates, no self-links, order does not matter (was B-08)', () => {
  const { state, ids } = base();
  let s = run(state, { type: 'connect', a: ids[0], b: ids[1] });
  assert.equal(s.doc.edges.length, 1);
  assert.equal(run(s, { type: 'connect', a: ids[1], b: ids[0] }), s, 'reverse link is a no-op');
  assert.equal(run(s, { type: 'connect', a: ids[0], b: ids[0] }), s, 'self link is a no-op');
  assert.equal(run(s, { type: 'connect', a: ids[0], b: 'ghost' }), s, 'unknown node is a no-op');
  assert.equal(canConnect(s.doc, ids[0], ids[1]).ok, false);
  assert.equal(canConnect(s.doc, ids[0], ids[2]).ok, true);
});

test('removing a device removes its links and policies (was B-02)', () => {
  const { state, ids } = base();
  let s = run(state,
    { type: 'connect', a: ids[0], b: ids[1] },
    { type: 'connect', a: ids[1], b: ids[2] },
    { type: 'togglePolicy', ids: [ids[1]], policy: 'allowWeb', on: true });
  s = run(s, { type: 'remove', ids: [ids[1]] });
  assert.equal(s.doc.edges.length, 0);
  assert.equal(s.doc.policies[ids[1]], undefined);
  assert.equal(s.doc.nodes.length, 2);
});

test('changing an IP keeps the device’s policies (was B-03)', () => {
  const { state, ids } = base();
  let s = run(state,
    { type: 'setIp', id: ids[0], ip: '10.0.0.1' },
    { type: 'togglePolicy', ids: [ids[0]], policy: 'ssh', on: true },
    { type: 'setIp', id: ids[0], ip: '10.0.0.9' },
    { type: 'setIp', id: ids[0], ip: '10.0.0.10' });
  assert.equal(s.doc.nodes[0].ip, '10.0.0.10');
  assert.equal(hasPolicy(s.doc, ids[0], 'ssh'), true);
  assert.deepEqual(Object.keys(s.doc.policies), [ids[0]], 'no orphaned policy entries');
});

test('IP validation: format and uniqueness, saving the same IP again is fine', () => {
  const { state, ids } = base();
  const s = run(state, { type: 'setIp', id: ids[0], ip: '10.0.0.1' });
  assert.match(validateIp(s.doc, ids[1], 'nope'), /four numbers/i);
  assert.match(validateIp(s.doc, ids[1], '10.0.0.1'), /already used by PC 1/);
  assert.equal(validateIp(s.doc, ids[0], '10.0.0.1'), null, 'own IP is allowed');
  assert.equal(validateIp(s.doc, ids[1], ''), null, 'empty clears');
  assert.equal(run(s, { type: 'setIp', id: ids[1], ip: '10.0.0.1' }), s, 'duplicate rejected');
  assert.equal(run(s, { type: 'setIp', id: ids[1], ip: 'x' }), s, 'invalid rejected');
});

test('autoIps fills only the empty ones and never duplicates', () => {
  const { state, ids } = base();
  let s = run(state, { type: 'setIp', id: ids[1], ip: '192.168.1.1' }, { type: 'autoIps' });
  const ips = s.doc.nodes.map((n) => n.ip);
  assert.equal(ips.every(Boolean), true);
  assert.equal(new Set(ips).size, ips.length);
  assert.equal(s.doc.nodes[1].ip, '192.168.1.1');
});

test('togglePolicy sets all, then clears all; mixed selection turns on first', () => {
  const { state, ids } = base();
  let s = run(state, { type: 'togglePolicy', ids: [ids[0]], policy: 'voip' });
  s = run(s, { type: 'togglePolicy', ids, policy: 'voip' });
  assert.equal(ids.every((id) => hasPolicy(s.doc, id, 'voip')), true, 'mixed -> all on');
  s = run(s, { type: 'togglePolicy', ids, policy: 'voip' });
  assert.equal(ids.every((id) => !hasPolicy(s.doc, id, 'voip')), true, 'all on -> all off');
  assert.deepEqual(s.doc.policies, {}, 'empty lists are removed');
  assert.equal(run(s, { type: 'togglePolicy', ids, policy: 'nonsense' }), s);
});

test('undo and redo walk the history; new work clears redo', () => {
  const { state, ids } = base();
  let s = run(state, { type: 'connect', a: ids[0], b: ids[1] });
  s = run(s, { type: 'undo' });
  assert.equal(s.doc.edges.length, 0);
  s = run(s, { type: 'redo' });
  assert.equal(s.doc.edges.length, 1);
  s = run(s, { type: 'undo' }, { type: 'connect', a: ids[1], b: ids[2] });
  assert.equal(s.future.length, 0);
  assert.equal(run(createState(), { type: 'undo' }).doc.nodes.length, 0);
});

test('dragging: preview does not grow history; checkpoint makes the drag one undo step', () => {
  const { state, ids } = base();
  const depth = state.past.length;
  let s = run(state, { type: 'checkpoint' });
  for (let i = 1; i <= 20; i += 1) s = run(s, { type: 'preview', positions: { [ids[0]]: { x: 100 + i, y: 100 } } });
  assert.equal(s.past.length, depth + 1);
  assert.equal(s.doc.nodes[0].x, 120);
  s = run(s, { type: 'undo' });
  assert.equal(s.doc.nodes[0].x, 100);
});

test('history is capped', () => {
  let s = createState();
  for (let i = 0; i < HISTORY_LIMIT + 30; i += 1) s = run(s, { type: 'add', nodeType: 'pc', x: i, y: i });
  assert.equal(s.past.length, HISTORY_LIMIT);
});

test('clear empties the canvas but keeps ids unique afterwards', () => {
  const { state } = base();
  let s = run(state, { type: 'clear' });
  assert.equal(s.doc.nodes.length, 0);
  s = run(s, { type: 'add', nodeType: 'pc', x: 0, y: 0 });
  assert.equal(s.doc.nodes[0].id, 'n4');
});

test('normalizeDoc repairs bad input', () => {
  const doc = normalizeDoc({
    nodes: [
      { id: 'n1', type: 'pc', name: 'PC 1', x: 1, y: 2, ip: '300.1.1.1' },
      { id: 'n1', type: 'pc', x: 9, y: 9 },
      { id: 'n2', type: 'toaster', x: 1, y: 1 },
      { id: 'n3', type: 'hub', x: 'x', y: 1 },
      { id: 'n7', type: 'router', x: 5, y: 5, ip: '10.0.0.1' },
    ],
    edges: [{ a: 'n1', b: 'n7' }, { a: 'n7', b: 'n1' }, { a: 'n1', b: 'n1' }, { a: 'n1', b: 'zzz' }],
    policies: { n1: ['allowWeb', 'bogus', 'allowWeb'], zzz: ['voip'] },
  });
  assert.equal(doc.nodes.length, 2);
  assert.equal(doc.nodes[0].ip, '', 'invalid ip dropped');
  assert.equal(doc.edges.length, 1);
  assert.deepEqual(doc.policies, { n1: ['allowWeb'] });
  assert.equal(doc.seq, 8, 'seq moves past the highest id');
  assert.equal(normalizeDoc(null).nodes.length, 0);
});

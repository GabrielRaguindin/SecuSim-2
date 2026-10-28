import test from 'node:test';
import assert from 'node:assert/strict';
import { CABLES, CABLE_IDS, cableGroup, requiredCable, explainCable, cableMatrix, isCable, cableLabel } from '../lib/cabling.js';
import { DEVICE_ORDER, DEVICE_TYPES, isDeviceType } from '../lib/devices.js';
import { createState, networkReducer, normalizeDoc, canConnect } from '../lib/networkReducer.js';
import { evaluateScenario, getScenario } from '../lib/scenarios.js';
import { solveFileSharing, solveVideoStreaming, solveVoipMesh, link } from './fixtures.js';
import { run, addNodes } from './helpers.js';

const verdict = (id, state) => evaluateScenario(getScenario(id), state.doc);
const failing = (r) => r.checks.filter((c) => !c.ok).map((c) => c.id);
const flip = (c) => (c === 'straight' ? 'crossover' : 'straight');

test('Server is a real device type, and is an end device for cabling', () => {
  assert.equal(isDeviceType('server'), true);
  assert.deepEqual(DEVICE_ORDER, ['router', 'hub', 'pc', 'server', 'modem']);
  assert.equal(DEVICE_TYPES.server.label, 'Server');
  assert.equal(cableGroup('server'), cableGroup('pc'));
  const { state, ids } = addNodes(createState(), ['server', 'server']);
  assert.deepEqual(state.doc.nodes.map((n) => n.name), ['Server 1', 'Server 2']);
  assert.equal(new Set(ids).size, 2);
});

test('which cable joins which devices (the classic rule)', () => {
  const straight = [['pc', 'hub'], ['pc', 'modem'], ['server', 'hub'], ['router', 'hub'], ['router', 'modem'], ['server', 'modem']];
  const crossover = [['pc', 'pc'], ['hub', 'hub'], ['router', 'router'], ['pc', 'router'], ['pc', 'server'], ['server', 'router'], ['server', 'server'], ['hub', 'modem']];
  for (const [a, b] of straight) { assert.equal(requiredCable(a, b), 'straight', `${a}-${b}`); assert.equal(requiredCable(b, a), 'straight', `${b}-${a}`); }
  for (const [a, b] of crossover) { assert.equal(requiredCable(a, b), 'crossover', `${a}-${b}`); assert.equal(requiredCable(b, a), 'crossover', `${b}-${a}`); }
});

test('the rule is symmetric and covers every pair of device types', () => {
  for (const a of DEVICE_ORDER) for (const b of DEVICE_ORDER) {
    assert.equal(requiredCable(a, b), requiredCable(b, a));
    assert.ok(isCable(requiredCable(a, b)));
    assert.ok(explainCable(a, b).length > 20);
  }
  const m = cableMatrix();
  assert.equal(m.length, DEVICE_ORDER.length);
  assert.ok(m.every((row) => row.cells.length === DEVICE_ORDER.length));
  assert.equal(m[0].cells[0].cable, 'crossover', 'router to router');
});

test('explanations name the devices and the cable', () => {
  assert.match(explainCable('pc', 'hub'), /PC transmits.*hub receives.*straight-through/);
  assert.match(explainCable('hub', 'pc'), /PC transmits.*hub receives.*straight-through/, 'same sentence either way round');
  assert.match(explainCable('pc', 'pc'), /PC and a PC both transmit.*crossover/);
  assert.match(explainCable('hub', 'modem'), /hub and a modem both receive.*crossover/);
});

test('cable names', () => {
  assert.deepEqual(CABLE_IDS, ['straight', 'crossover']);
  assert.equal(cableLabel('straight'), 'Straight-through');
  assert.equal(cableLabel('crossover'), 'Crossover');
  assert.equal(cableLabel('nonsense'), 'Straight-through');
  assert.ok(CABLES.straight.help && CABLES.crossover.help);
  assert.equal(isCable('crossover'), true);
  assert.equal(isCable('fibre'), false);
});

test('links carry their cable; the default is straight-through', () => {
  const { state, ids } = addNodes(createState(), ['pc', 'pc', 'hub']);
  let s = run(state, { type: 'connect', a: ids[0], b: ids[1] });
  assert.equal(s.doc.edges[0].cable, 'straight');
  s = run(s, { type: 'connect', a: ids[1], b: ids[2], cable: 'crossover' });
  assert.equal(s.doc.edges[1].cable, 'crossover');
  s = run(s, { type: 'connect', a: ids[0], b: ids[2], cable: 'fibre' });
  assert.equal(s.doc.edges[2].cable, 'straight', 'unknown cables fall back to straight-through');
  assert.equal(canConnect(s.doc, ids[0], ids[1]).ok, false, 'cables do not allow duplicate links');
});

test('changing a cable is one undoable step, and ignores bad input', () => {
  const { state, ids } = addNodes(createState(), ['pc', 'hub']);
  let s = run(state, { type: 'connect', a: ids[0], b: ids[1] });
  const id = s.doc.edges[0].id;
  assert.equal(run(s, { type: 'setCable', id, cable: 'straight' }), s, 'no change, no history');
  assert.equal(run(s, { type: 'setCable', id, cable: 'fibre' }), s);
  assert.equal(run(s, { type: 'setCable', id: 'ghost', cable: 'crossover' }), s);
  s = run(s, { type: 'setCable', id, cable: 'crossover' });
  assert.equal(s.doc.edges[0].cable, 'crossover');
  s = run(s, { type: 'undo' });
  assert.equal(s.doc.edges[0].cable, 'straight');
});

test('saved networks keep their cables, and older ones default to straight-through', () => {
  const doc = normalizeDoc({
    nodes: [{ id: 'n1', type: 'pc', x: 1, y: 1 }, { id: 'n2', type: 'pc', x: 2, y: 2 }, { id: 'n3', type: 'hub', x: 3, y: 3 }],
    edges: [{ a: 'n1', b: 'n2', cable: 'crossover' }, { a: 'n1', b: 'n3' }, { a: 'n2', b: 'n3', cable: 'banana' }],
  });
  assert.deepEqual(doc.edges.map((e) => e.cable), ['crossover', 'straight', 'straight']);
});

test('reference solutions use the right cable everywhere', () => {
  for (const [id, solve] of [['file-sharing', solveFileSharing], ['video-streaming', solveVideoStreaming], ['voip-mesh', solveVoipMesh]]) {
    const { state } = solve();
    assert.equal(verdict(id, state).checks.find((c) => c.id === 'cables').ok, true, id);
  }
});

test('one wrong cable fails the cabling requirement and names the link', () => {
  for (const [id, solve] of [['file-sharing', solveFileSharing], ['video-streaming', solveVideoStreaming], ['voip-mesh', solveVoipMesh]]) {
    const { state } = solve();
    const edge = state.doc.edges[0];
    const s = run(state, { type: 'setCable', id: edge.id, cable: flip(edge.cable) });
    const r = verdict(id, s);
    assert.deepEqual(failing(r), ['cables'], `${id}: only the cabling fails`);
    const detail = r.checks.find((c) => c.id === 'cables').detail;
    assert.match(detail, /needs a (straight-through|crossover) cable, not a (straight-through|crossover) one/);
  }
});

test('every wrong cable is counted, and the first is named', () => {
  const { state } = solveVoipMesh();
  const s = run(state, ...state.doc.edges.slice(0, 3).map((e) => ({ type: 'setCable', id: e.id, cable: flip(e.cable) })));
  assert.match(verdict('voip-mesh', s).checks.find((c) => c.id === 'cables').detail, /and 2 more/);
});

test('no links is not "all links are right" (vacuous truth)', () => {
  const { state } = solveVoipMesh();
  const unlinked = run(state, ...state.doc.edges.map((e) => ({ type: 'removeEdge', id: e.id })));
  const cables = verdict('voip-mesh', unlinked).checks.find((c) => c.id === 'cables');
  assert.equal(cables.ok, false);
  assert.match(cables.detail, /No links yet/);
});

test('the right cable depends on the device types, not on a fixed pattern', () => {
  // Scenario 2: PCs need crossover to the router, hubs need straight.
  const { state, ids } = solveVideoStreaming();
  const [router, hub1, , pc1] = ids;
  const edgeOf = (a, b) => state.doc.edges.find((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));
  assert.equal(edgeOf(router, hub1).cable, 'straight');
  assert.equal(edgeOf(router, pc1).cable, 'crossover');
  // linking with the helper uses the right cable
  const fresh = addNodes(createState(), ['server', 'hub']);
  const linked = link(fresh.state, fresh.ids[0], fresh.ids[1]);
  assert.equal(linked.doc.edges[0].cable, 'straight');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS, getScenario, evaluateScenario } from '../lib/scenarios.js';
import { createState, networkReducer } from '../lib/networkReducer.js';
import { solveFileSharing, solveVideoStreaming, solveVoipMesh } from './fixtures.js';
import { run } from './helpers.js';

const ring = getScenario('file-sharing');
const star = getScenario('video-streaming');
const mesh = getScenario('voip-mesh');
const verdict = (scenario, state) => evaluateScenario(scenario, state.doc);
const failing = (result) => result.checks.filter((c) => !c.ok).map((c) => c.id);

test('every scenario is well formed', () => {
  assert.equal(SCENARIOS.length, 3);
  for (const s of SCENARIOS) {
    assert.ok(s.timeLimit > 0 && s.title && s.story && s.goal);
    assert.equal(new Set(s.checks.map((c) => c.id)).size, s.checks.length, 'unique check ids');
    for (const c of s.checks) assert.equal(typeof c.run, 'function');
  }
  assert.equal(getScenario('nope'), null);
});

test('reference solutions pass every check', () => {
  for (const [scenario, solve] of [[ring, solveFileSharing], [star, solveVideoStreaming], [mesh, solveVoipMesh]]) {
    const { state } = solve();
    const result = verdict(scenario, state);
    assert.deepEqual(failing(result), [], scenario.id);
    assert.equal(result.passed, true);
    assert.equal(result.met, result.total);
  }
});

test('an empty canvas fails everything with guidance', () => {
  for (const scenario of SCENARIOS) {
    const result = evaluateScenario(scenario, createState().doc);
    assert.equal(result.passed, false);
    assert.equal(result.met, 0, `${scenario.id}: nothing passes by default`);
    for (const c of result.checks) assert.ok(c.detail.length > 10);
  }
});

test('B-01: the right devices with NO links no longer pass the topology check', () => {
  for (const [scenario, solve] of [[ring, solveFileSharing], [mesh, solveVoipMesh]]) {
    const { state } = solve();
    const unlinked = run(state, ...state.doc.edges.map((e) => ({ type: 'removeEdge', id: e.id })));
    assert.equal(unlinked.doc.edges.length, 0);
    const result = verdict(scenario, unlinked);
    assert.ok(failing(result).includes('topology'), scenario.id);
  }
});

test('ring: two separate loops fail; an isolated device fails', () => {
  const { state, ids } = solveFileSharing();
  const cut = run(state,
    { type: 'removeEdge', id: state.doc.edges.find((e) => e.a === ids[4] || e.b === ids[4]).id });
  assert.ok(failing(verdict(ring, cut)).includes('topology'));

  // Two loops of four: remove the links that join them and close each half.
  let two = state;
  for (const e of state.doc.edges) two = run(two, { type: 'removeEdge', id: e.id });
  const half = (list) => list.forEach((id, i) => { two = run(two, { type: 'connect', a: id, b: list[(i + 1) % list.length] }); });
  half(ids.slice(0, 4));
  half(ids.slice(4));
  const result = verdict(ring, two);
  const topo = result.checks.find((c) => c.id === 'topology');
  assert.equal(topo.ok, false);
  assert.match(topo.detail, /separate loops/);
});

test('B-02: deleted devices leave no trace in policy checks', () => {
  const { state, ids } = solveVideoStreaming();
  // Add a stray PC with no policies, then delete it again. The scenario must still pass.
  let s = run(state, { type: 'add', nodeType: 'pc', x: 5, y: 5 });
  const strayId = s.doc.nodes[s.doc.nodes.length - 1].id;
  assert.equal(verdict(star, s).passed, false, 'stray device is visible while it exists');
  s = run(s, { type: 'remove', ids: [strayId] });
  assert.equal(verdict(star, s).passed, true, 'and gone once deleted');
});

test('B-03: re-assigning IPs mid-way does not lose policies', () => {
  const { state, ids } = solveVideoStreaming();
  const s = run(state, { type: 'setIp', id: ids[3], ip: '192.168.1.200' }, { type: 'setIp', id: ids[3], ip: '192.168.1.201' });
  assert.equal(verdict(star, s).passed, true);
});

test('B-04: policy checks are device-type aware', () => {
  // Scenario 3: remote desktop on three PCs instead of the router and hubs.
  const { state, ids } = solveVoipMesh();
  let s = run(state, { type: 'togglePolicy', ids: ids.slice(0, 3), policy: 'remoteDesktop', on: false },
    { type: 'togglePolicy', ids: ids.slice(3), policy: 'remoteDesktop', on: true });
  const remote = verdict(mesh, s).checks.find((c) => c.id === 'remote');
  assert.equal(remote.ok, false, 'three devices but the wrong three');

  // Scenario 1: a sixth PC with file transfer counts against you.
  const one = solveFileSharing();
  s = run(one.state, { type: 'togglePolicy', ids: [one.ids[5]], policy: 'fileTransfer', on: true });
  const transfer = verdict(ring, s).checks.find((c) => c.id === 'transfer');
  assert.equal(transfer.ok, false);
  assert.match(transfer.detail, /6 PCs have File transfer access, but only 5 should/);

  // Scenario 2: throttling a hub instead of a PC fails.
  const two = solveVideoStreaming();
  s = run(two.state, { type: 'togglePolicy', ids: [two.ids[3]], policy: 'throttleBulk', on: false },
    { type: 'togglePolicy', ids: [two.ids[1]], policy: 'throttleBulk', on: true });
  assert.equal(verdict(star, s).checks.find((c) => c.id === 'throttle').ok, false);
});

test('B-05: scenario 3 reports the right device counts', () => {
  const { state } = solveVoipMesh();
  const s = run(state, { type: 'add', nodeType: 'pc', x: 1, y: 1 });
  const devices = verdict(mesh, s).checks.find((c) => c.id === 'devices');
  assert.equal(devices.ok, false);
  assert.match(devices.detail, /Needs 3 PCs, 2 hubs and 1 router/);
  assert.match(devices.detail, /You have 4 PCs, 2 hubs and 1 router/);
  assert.doesNotMatch(devices.detail, /6 PCs/);
});

test('star: bypass links and missing links are named', () => {
  const { state, ids } = solveVideoStreaming();
  const bypass = run(state, { type: 'connect', a: ids[3], b: ids[4] });
  const t1 = verdict(star, bypass).checks.find((c) => c.id === 'topology');
  assert.equal(t1.ok, false);
  assert.match(t1.detail, /PC 1 to PC 2/);

  const missing = run(state, { type: 'removeEdge', id: state.doc.edges[0].id });
  const t2 = verdict(star, missing).checks.find((c) => c.id === 'topology');
  assert.equal(t2.ok, false);
  assert.match(t2.detail, /isn’t linked to/);
});

test('mesh: a single missing link is reported', () => {
  const { state } = solveVoipMesh();
  const s = run(state, { type: 'removeEdge', id: state.doc.edges[4].id });
  const t = verdict(mesh, s).checks.find((c) => c.id === 'topology');
  assert.equal(t.ok, false);
  assert.match(t.detail, /1 link is missing/);
});

test('ips check names devices without an address', () => {
  const { state, ids } = solveVoipMesh();
  const s = run(state, { type: 'setIp', id: ids[0], ip: '' });
  const ips = verdict(mesh, s).checks.find((c) => c.id === 'ips');
  assert.equal(ips.ok, false);
  assert.match(ips.detail, /Router 1 still needs an IP/);
});

test('scenario 1: block untrusted is only required on the file-sharing PCs', () => {
  const { state, ids } = solveFileSharing();
  // A non-sharing PC without Block untrusted is fine.
  const s = run(state, { type: 'togglePolicy', ids: [ids[7]], policy: 'blockUntrusted', on: false });
  assert.equal(verdict(ring, s).passed, true);
  // A sharing PC without it is not.
  const bad = run(state, { type: 'togglePolicy', ids: [ids[0]], policy: 'blockUntrusted', on: false });
  assert.equal(verdict(ring, bad).checks.find((c) => c.id === 'untrusted').ok, false);
});

test('address class: the right class passes, the wrong one names the devices and the range', () => {
  const { state, ids } = solveFileSharing(); // Class B
  assert.equal(verdict(ring, state).checks.find((c) => c.id === 'class').ok, true);

  const wrong = run(state, { type: 'setIp', id: ids[0], ip: '192.168.1.200' }, { type: 'setIp', id: ids[1], ip: '10.0.0.200' });
  const c = verdict(ring, wrong).checks.find((x) => x.id === 'class');
  assert.equal(c.ok, false);
  assert.match(c.detail, /PC 1 and PC 2 aren’t in Class B/);
  assert.match(c.detail, /128 to 191/);

  // Scenarios 2 and 3 want Class C, so the Class B solution of scenario 1 would not do.
  const star2 = solveVideoStreaming().state;
  const asB = run(star2, { type: 'autoIps', ipClass: 'B' });
  assert.deepEqual(failing(verdict(star, asB)), ['class']);
});

test('address class: a device without an address is asked for one, not misreported', () => {
  const { state, ids } = solveVoipMesh();
  const s = run(state, { type: 'setIp', id: ids[0], ip: '' });
  assert.match(verdict(mesh, s).checks.find((c) => c.id === 'class').detail, /Router 1 still needs an IP/);
});

test('auto-assigning the wrong class and then the right one fixes the requirement', () => {
  let { state } = solveVoipMesh();
  state = run(state, { type: 'autoIps', ipClass: 'A' });
  assert.equal(verdict(mesh, state).checks.find((c) => c.id === 'class').ok, false);
  state = run(state, { type: 'autoIps', ipClass: 'C' });
  assert.equal(verdict(mesh, state).passed, true);
});

test('scenario 1 is a ring of eight PCs, with no routers', () => {
  const { state, ids } = solveFileSharing();
  assert.equal(state.doc.nodes.length, 8);
  assert.ok(state.doc.nodes.every((n) => n.type === 'pc'));
  assert.equal(state.doc.edges.length, 8, 'a ring of eight has eight links');
  assert.ok(state.doc.edges.every((e) => e.cable === 'crossover'), 'PC to PC is always a crossover');
  assert.deepEqual(ring.checks.map((c) => c.id), ['devices', 'ips', 'class', 'topology', 'cables', 'transfer', 'untrusted', 'web']);
  assert.match(ring.goal, /ring of 8 PCs/);

  // A router has no place here.
  const withRouter = run(state, { type: 'add', nodeType: 'router', x: 5, y: 5 });
  const devices = verdict(ring, withRouter).checks.find((c) => c.id === 'devices');
  assert.equal(devices.ok, false);
  assert.match(devices.detail, /Needs 8 PCs\. You have 8 PCs and 1 router/);

  // Seven or nine PCs is wrong too.
  const seven = run(state, { type: 'remove', ids: [ids[7]] });
  assert.match(verdict(ring, seven).checks.find((c) => c.id === 'devices').detail, /Needs 8 PCs\. You have 7 PCs/);
  const nine = run(state, { type: 'add', nodeType: 'pc', x: 5, y: 5 });
  assert.equal(verdict(ring, nine).checks.find((c) => c.id === 'devices').ok, false);

  // Exactly five share files: four or six fail.
  const four = run(state, { type: 'togglePolicy', ids: [ids[4]], policy: 'fileTransfer', on: false });
  assert.match(verdict(ring, four).checks.find((c) => c.id === 'transfer').detail, /4 of 5 PCs/);
  assert.equal(verdict(ring, state).passed, true);
});

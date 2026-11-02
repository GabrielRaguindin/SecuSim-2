import test from 'node:test';
import assert from 'node:assert/strict';
import { DEVICE_ORDER, DEVICE_TYPES, isDeviceType, canHaveIp, canHavePolicies, isLayer1, deviceCountText } from '../lib/devices.js';
import { cableGroup, requiredCable, explainCable, cableMatrix } from '../lib/cabling.js';
import { createState, normalizeDoc, validateIp, hasPolicy } from '../lib/networkReducer.js';
import { traceRoute, canBeEndpoint } from '../lib/packets.js';
import { emptySpec, normalizeSpec, validateSpec, compileScenario, buildReferenceSolution, ruleLabel } from '../lib/customScenarios.js';
import { evaluateScenario } from '../lib/scenarios.js';
import { addNodes, run } from './helpers.js';

const rule = (over) => ({ id: 'r', policy: 'voip', kind: 'all', types: [], count: 1, requires: '', ...over });
const spec = (over = {}) => ({ ...emptySpec(), title: 'Switch scenario', ...over });

test('the Switch is a sixth device, and it is a managed one: an address and policies are allowed', () => {
  assert.equal(isDeviceType('switch'), true);
  assert.equal(DEVICE_ORDER.length, 6);
  assert.deepEqual(DEVICE_ORDER, ['router', 'switch', 'hub', 'pc', 'server', 'modem']);
  assert.equal(DEVICE_TYPES.switch.label, 'Switch');
  assert.equal(deviceCountText('switch', 1), '1 switch');
  assert.equal(deviceCountText('switch', 2), '2 switches');
  assert.equal(isLayer1('switch'), false);
  assert.equal(canHaveIp('switch'), true);
  assert.equal(canHavePolicies('switch'), true);
  assert.equal(canBeEndpoint('switch'), true);
});

test('adding switches names them, and the hub is still the only device without an address', () => {
  const { state } = addNodes(createState(), ['switch', 'switch']);
  assert.deepEqual(state.doc.nodes.map((n) => n.name), ['Switch 1', 'Switch 2']);
  assert.deepEqual(DEVICE_ORDER.filter((t) => !canHaveIp(t)), ['hub']);
  assert.deepEqual(DEVICE_ORDER.filter((t) => !canHavePolicies(t)), ['hub']);
});

test('a switch takes an address, policies and auto-assigned addresses', () => {
  const { state, ids } = addNodes(createState(), ['switch', 'pc', 'hub']);
  assert.equal(validateIp(state.doc, ids[0], '192.168.1.2'), null);
  let s = run(state, { type: 'setIp', id: ids[0], ip: '192.168.1.2' }, { type: 'togglePolicy', ids: [ids[0]], policy: 'ssh', on: true });
  assert.equal(s.doc.nodes[0].ip, '192.168.1.2');
  assert.equal(hasPolicy(s.doc, ids[0], 'ssh'), true);
  s = run(s, { type: 'autoIps', ipClass: 'C' });
  assert.ok(s.doc.nodes[1].ip, 'the PC got an address');
  assert.equal(s.doc.nodes[2].ip, '', 'the hub still gets none');
  // a mixed selection applies to the switch and skips the hub
  s = run(s, { type: 'togglePolicy', ids: [ids[0], ids[2]], policy: 'blockPing', on: true });
  assert.equal(hasPolicy(s.doc, ids[0], 'blockPing'), true);
  assert.equal(hasPolicy(s.doc, ids[2], 'blockPing'), false);
});

test('saved networks keep a switch’s address and policies', () => {
  const doc = normalizeDoc({
    nodes: [{ id: 'n1', type: 'switch', x: 1, y: 1, ip: '192.168.1.5' }, { id: 'n2', type: 'hub', x: 2, y: 2, ip: '192.168.1.6' }],
    policies: { n1: ['ssh'], n2: ['ssh'] },
  });
  assert.equal(doc.nodes[0].ip, '192.168.1.5');
  assert.deepEqual(doc.policies, { n1: ['ssh'] });
  assert.equal(doc.nodes[1].ip, '', 'the hub is still cleaned');
});

test('cabling: a switch port behaves like a hub port', () => {
  assert.equal(cableGroup('switch'), 'receive');
  const straight = [['pc', 'switch'], ['server', 'switch'], ['router', 'switch']];
  const crossover = [['switch', 'switch'], ['switch', 'hub'], ['switch', 'modem']];
  for (const [a, b] of straight) { assert.equal(requiredCable(a, b), 'straight', `${a}-${b}`); assert.equal(requiredCable(b, a), 'straight', `${b}-${a}`); }
  for (const [a, b] of crossover) { assert.equal(requiredCable(a, b), 'crossover', `${a}-${b}`); assert.equal(requiredCable(b, a), 'crossover', `${b}-${a}`); }
  assert.match(explainCable('pc', 'switch'), /PC transmits.*switch receives.*straight-through/);
  assert.match(explainCable('switch', 'switch'), /switch and a switch both receive.*crossover/);
  const m = cableMatrix();
  assert.equal(m.length, 6);
  assert.ok(m.every((row) => row.cells.length === 6));
});

test('packets cross a switch, and a switch can send and receive', () => {
  const { state, ids } = addNodes(createState(), ['pc', 'switch', 'pc']);
  let s = run(state,
    { type: 'connect', a: ids[0], b: ids[1], cable: 'straight' },
    { type: 'connect', a: ids[1], b: ids[2], cable: 'straight' },
    { type: 'setIp', id: ids[0], ip: '192.168.1.1' },
    { type: 'setIp', id: ids[1], ip: '192.168.1.2' },
    { type: 'setIp', id: ids[2], ip: '192.168.1.3' });
  const through = traceRoute(s.doc, ids[0], ids[2], 'ping');
  assert.equal(through.ok, true);
  assert.deepEqual(through.path, ids);
  assert.match(through.log[1].text, /Switch 1 forwards it on/);

  const toSwitch = traceRoute(s.doc, ids[0], ids[1], 'ping');
  assert.equal(toSwitch.ok, true, 'a switch is a valid receiver');
  assert.equal(traceRoute(s.doc, ids[1], ids[2], 'ping').ok, true, 'and a valid sender');

  s = run(s, { type: 'togglePolicy', ids: [ids[1]], policy: 'blockPing', on: true });
  const blocked = traceRoute(s.doc, ids[0], ids[1], 'ping');
  assert.equal(blocked.failure.code, 'receiver-blocked');
  assert.match(blocked.failure.detail, /Block ping requests is on for Switch 1/);
  assert.equal(traceRoute(s.doc, ids[0], ids[2], 'ping').ok, true, 'a switch is not an endpoint for traffic passing through it');
});

test('a switch with no address still passes traffic through', () => {
  const { state, ids } = addNodes(createState(), ['pc', 'switch', 'pc']);
  const s = run(state,
    { type: 'connect', a: ids[0], b: ids[1], cable: 'straight' },
    { type: 'connect', a: ids[1], b: ids[2], cable: 'straight' },
    { type: 'setIp', id: ids[0], ip: '192.168.1.1' },
    { type: 'setIp', id: ids[2], ip: '192.168.1.3' });
  assert.equal(traceRoute(s.doc, ids[0], ids[2], 'ping').ok, true);
});

test('grading: a switch counts as a device that needs an address and a policy', () => {
  const s = spec({ devices: { ...emptySpec().devices, switch: 1, pc: 2 }, layout: { kind: 'star', center: 'switch' }, ipClass: 'C', requireCabling: true, rules: [rule({ id: 'v', policy: 'voip', kind: 'all' })] });
  assert.deepEqual(validateSpec(s).list, []);
  const solved = buildReferenceSolution(s);
  assert.equal(evaluateScenario(compileScenario(s), solved).passed, true);
  assert.ok(solved.nodes.every((n) => n.ip), 'the switch got an address from the reference solution');
  assert.equal(solved.edges.every((e) => e.cable === 'straight'), true, 'PC to switch is straight-through');

  // take the policy off the switch only: the "every device" rule must notice
  const missing = run(createState(solved), { type: 'togglePolicy', ids: [solved.nodes.find((n) => n.type === 'switch').id], policy: 'voip', on: false });
  const r = evaluateScenario(compileScenario(s), missing.doc);
  assert.equal(r.checks.find((c) => c.id === 'rule-v').ok, false);
  assert.match(r.checks.find((c) => c.id === 'rule-v').detail, /Switch 1/);
  // and removing its address fails the address check
  const noIp = run(createState(solved), { type: 'setIp', id: solved.nodes.find((n) => n.type === 'switch').id, ip: '' });
  assert.match(evaluateScenario(compileScenario(s), noIp.doc).checks.find((c) => c.id === 'ips').detail, /Switch 1 still needs an IP/);
});

test('custom scenarios: switches can be counted, targeted by rules, and used as a star center', () => {
  const s = spec({ devices: { ...emptySpec().devices, switch: 2, pc: 3 }, rules: [rule({ id: 'a', policy: 'ssh', kind: 'only', types: ['switch'] })] });
  assert.deepEqual(validateSpec(s).list, []);
  assert.equal(normalizeSpec(s).rules[0].types[0], 'switch', 'a switch survives cleaning as a rule type');
  assert.match(compileScenario(s).checks[0].label, /Place 2 switches and 3 PCs\./);
  assert.equal(ruleLabel(normalizeSpec(s), s.rules[0]), 'Turn on SSH access for all 2 switches only. No other device should have it.');
  assert.equal(evaluateScenario(compileScenario(s), buildReferenceSolution(s)).passed, true);

  const twoCenters = spec({ devices: { ...emptySpec().devices, switch: 2, pc: 3 }, layout: { kind: 'star', center: 'switch' } });
  assert.match(validateSpec(twoCenters).errors.layout, /exactly one switch/);
});

test('hubs are still refused as a rule type while switches are not', () => {
  const s = spec({ devices: { ...emptySpec().devices, switch: 1, hub: 1, pc: 2 }, rules: [rule({ id: 'a', policy: 'ssh', kind: 'ofTypes', types: ['switch', 'hub'] })] });
  assert.deepEqual(normalizeSpec(s).rules[0].types, ['switch']);
});

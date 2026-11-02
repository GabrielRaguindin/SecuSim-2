import test from 'node:test';
import assert from 'node:assert/strict';
import { DEVICE_ORDER, DEVICE_TYPES, canHaveIp, canHavePolicies, isLayer1 } from '../lib/devices.js';
import { createState, networkReducer, normalizeDoc, validateIp, hasPolicy } from '../lib/networkReducer.js';
import { SCENARIOS, getScenario, evaluateScenario } from '../lib/scenarios.js';
import { emptySpec, normalizeSpec, validateSpec, compileScenario, buildReferenceSolution, parseScenarioFile, serializeScenario, FILE_FORMAT } from '../lib/customScenarios.js';
import { canBeEndpoint, traceRoute } from '../lib/packets.js';
import { saveTopology, loadTopology } from '../lib/storage.js';
import { solveVideoStreaming, solveVoipMesh } from './fixtures.js';
import { addNodes, run, fakeStore } from './helpers.js';

const verdict = (id, state) => evaluateScenario(getScenario(id), state.doc);
const failing = (r) => r.checks.filter((c) => !c.ok).map((c) => c.id);

test('Layer 1: the hub is the one and only device that can’t hold an address or a policy', () => {
  const layer1 = DEVICE_ORDER.filter((t) => isLayer1(t));
  assert.deepEqual(layer1, ['hub']);
  for (const t of DEVICE_ORDER) {
    assert.equal(canHaveIp(t), t !== 'hub', `${t} address`);
    assert.equal(canHavePolicies(t), t !== 'hub', `${t} policies`);
  }
  assert.equal(canHaveIp('toaster'), false);
  assert.match(DEVICE_TYPES.hub.blurb, /Layer 1/);
  assert.equal(canBeEndpoint('hub'), false, 'and a hub can’t send or receive a packet');
  assert.ok(['router', 'pc', 'server', 'modem'].every(canBeEndpoint));
});

test('Layer 1: a hub refuses an IP address, with the reason', () => {
  const { state, ids } = addNodes(createState(), ['hub', 'pc']);
  assert.match(validateIp(state.doc, ids[0], '192.168.1.5'), /Hub 1 is a hub.*Layer 1.*no IP address/);
  assert.equal(validateIp(state.doc, ids[1], '192.168.1.5'), null, 'a PC takes the same address');
  assert.equal(run(state, { type: 'setIp', id: ids[0], ip: '192.168.1.5' }), state, 'and nothing is saved');
  assert.equal(validateIp(state.doc, ids[0], ''), null, 'clearing is always allowed');
});

test('Layer 1: a hub refuses a policy, and a mixed selection applies it to the rest', () => {
  const { state, ids } = addNodes(createState(), ['hub', 'pc', 'router']);
  assert.equal(run(state, { type: 'togglePolicy', ids: [ids[0]], policy: 'allowWeb', on: true }), state, 'only a hub: no change, no history');
  const s = run(state, { type: 'togglePolicy', ids, policy: 'allowWeb', on: true });
  assert.equal(hasPolicy(s.doc, ids[0], 'allowWeb'), false);
  assert.equal(hasPolicy(s.doc, ids[1], 'allowWeb'), true);
  assert.equal(hasPolicy(s.doc, ids[2], 'allowWeb'), true);
  assert.equal(s.doc.policies[ids[0]], undefined, 'no entry at all for the hub');
});

test('Layer 1: auto-assign skips hubs and still gives everyone else an address', () => {
  const { state, ids } = addNodes(createState(), ['hub', 'pc', 'hub', 'server']);
  const s = run(state, { type: 'autoIps', ipClass: 'B' });
  assert.deepEqual(s.doc.nodes.map((n) => n.ip), ['', '172.16.0.1', '', '172.16.0.2']);
  assert.equal(ids.length, 4);
});

test('Layer 1: an older save with an address or policies on a hub is cleaned when it loads', () => {
  const doc = normalizeDoc({
    nodes: [{ id: 'n1', type: 'hub', x: 1, y: 1, ip: '10.0.0.5' }, { id: 'n2', type: 'pc', x: 2, y: 2, ip: '10.0.0.6' }],
    policies: { n1: ['voip', 'allowWeb'], n2: ['voip'] },
  });
  assert.deepEqual(doc.nodes.map((n) => n.ip), ['', '10.0.0.6']);
  assert.deepEqual(doc.policies, { n2: ['voip'] });
  const store = fakeStore();
  store.setItem('secusim:v2:topologies', JSON.stringify({ Old: { doc: { nodes: [{ id: 'n1', type: 'hub', x: 1, y: 1, ip: '10.0.0.5' }], policies: { n1: ['ssh'] } }, updatedAt: 1 } }));
  const loaded = loadTopology('Old', store);
  assert.equal(loaded.nodes[0].ip, '');
  assert.deepEqual(loaded.policies, {});
  assert.equal(saveTopology('New', loaded, store).ok, true);
});

/** A custom scenario that does place hubs: they are left out of every address and policy requirement. */
const hubLab = () => ({ ...emptySpec(), title: 'Hub lab', devices: { router: 1, hub: 2, pc: 3, server: 0, modem: 0 }, layout: { kind: 'connected', center: 'router' },
  ipClass: 'C', sameNetwork: true,
  rules: [
    { id: 'v', policy: 'voip', kind: 'all', types: [], count: 1, requires: '' },
    { id: 's', policy: 'ssh', kind: 'only', types: ['router'], count: 1, requires: '' },
  ] });

test('Layer 1: no address or policy requirement ever counts a hub', () => {
  const spec = hubLab();
  assert.deepEqual(validateSpec(spec).list, []);
  const compiled = compileScenario(spec);
  const solved = buildReferenceSolution(spec);
  const hubs = solved.nodes.filter((n) => n.type === 'hub');
  assert.equal(hubs.length, 2);
  assert.ok(hubs.every((h) => h.ip === '' && !solved.policies[h.id]), 'the solution gives the hubs nothing');
  assert.deepEqual(failing(evaluateScenario(compiled, solved)), [], 'and passes without touching them');

  // Trying to configure a hub changes nothing, so it can't help or hurt.
  const tried = run(createState(solved), { type: 'setIp', id: hubs[0].id, ip: '192.168.1.99' }, { type: 'togglePolicy', ids: hubs.map((h) => h.id), policy: 'ssh', on: true });
  assert.equal(tried.doc.nodes.find((n) => n.id === hubs[0].id).ip, '');
  assert.deepEqual(failing(evaluateScenario(compiled, tried.doc)), [], 'still passes');
});

test('Layer 1: the address checks say the hubs are left out, and name the devices that do need one', () => {
  const spec = hubLab();
  const compiled = compileScenario(spec);
  const solved = buildReferenceSolution(spec);
  const ips = evaluateScenario(compiled, solved).checks.find((c) => c.id === 'ips');
  assert.match(ips.detail, /All 4 devices have their own address\. The 2 hubs are left out: hubs work at Layer 1\./);
  const pc = solved.nodes.find((n) => n.type === 'pc');
  const missing = run(createState(solved), { type: 'setIp', id: pc.id, ip: '' });
  const r = evaluateScenario(compiled, missing.doc).checks.find((c) => c.id === 'ips');
  assert.equal(r.ok, false);
  assert.match(r.detail, /PC 1 still needs an IP/, 'it asks for the PC');
  assert.doesNotMatch(r.detail, /Hub/, 'and never for a hub');
});

test('Layer 1: a network of only hubs can’t satisfy an address or policy requirement', () => {
  const { state } = addNodes(createState(), ['hub', 'hub']);
  const ring = SCENARIOS[0];
  assert.match(evaluateScenario(ring, state.doc).checks.find((c) => c.id === 'ips').detail, /Hubs work at Layer 1/);
});

test('Layer 1: scenarios 2 and 3 give each device a job, and say which devices a requirement is about', () => {
  const labels = (id) => Object.fromEntries(getScenario(id).checks.map((c) => [c.id, c.label]));
  const star = labels('video-streaming');
  assert.equal(star.devices, 'Place 6 PCs, 1 server, 1 modem and 1 router.');
  assert.equal(star.streaming, 'Turn on Prioritize streaming for the server and all 6 PCs.');
  assert.equal(star.web, 'Turn on Allow web traffic for the router, the server and all 6 PCs.');
  assert.equal(star.untrusted, 'Turn on Block untrusted IP for the router only. No other device should have it.');
  assert.ok(!('outbound' in star), 'the old every-device rule is gone');
  const mesh = labels('voip-mesh');
  assert.equal(mesh.devices, 'Place 3 PCs, 1 server, 1 modem and 1 router.');
  assert.equal(mesh.voip, 'Turn on VoIP for the router, the server and all 3 PCs.');
  assert.equal(mesh.encrypt, 'Turn on Encrypt VoIP for the server and all 3 PCs.');
  assert.equal(mesh.ssh, 'Turn on SSH access for the router and the server only. No PC or modem should have it.');
  for (const id of ['video-streaming', 'voip-mesh']) {
    const text = Object.values(labels(id)).join(' ');
    assert.doesNotMatch(text, /hub/i, `${id}: no built-in scenario needs a hub`);
    assert.doesNotMatch(text, /Remote desktop/, `${id}: no remote desktop on infrastructure`);
  }
});

test('Layer 1: custom scenarios never name a hub in a policy rule', () => {
  const spec = { ...emptySpec(), title: 'Hubs', devices: { router: 1, hub: 2, pc: 2, server: 0, modem: 0 }, layout: { kind: 'connected', center: 'router' },
    rules: [{ id: 'a', policy: 'ssh', kind: 'only', types: ['router', 'hub'], count: 1, requires: '' }] };
  const n = normalizeSpec(spec);
  assert.deepEqual(n.rules[0].types, ['router'], 'the hub is dropped from the rule');
  const v = validateSpec(spec);
  assert.deepEqual(v.list, []);
  const solved = buildReferenceSolution(spec);
  const result = evaluateScenario(compileScenario(spec), solved);
  assert.equal(result.passed, true);
  assert.ok(solved.nodes.filter((x) => x.type === 'hub').every((h) => !h.ip && !solved.policies[h.id]));
  // a rule that can only name hubs has nothing left to name
  const onlyHubs = { ...spec, rules: [{ id: 'a', policy: 'ssh', kind: 'ofTypes', types: ['hub'], count: 1, requires: '' }] };
  assert.match(validateSpec(onlyHubs).errors.rules.a, /at least one device type/);
});

test('Layer 1: custom scenarios with hubs say so, and an all-hub scenario is refused', () => {
  const spec = { ...emptySpec(), title: 'Hub lab', devices: { router: 1, hub: 1, pc: 2, server: 0, modem: 0 }, layout: { kind: 'star', center: 'router' }, ipClass: 'C', sameNetwork: true,
    rules: [{ id: 'a', policy: 'voip', kind: 'all', types: [], count: 1, requires: '' }] };
  const c = compileScenario(spec);
  const label = (id) => c.checks.find((x) => x.id === id).label;
  assert.equal(label('ips'), 'Give every device except the hubs its own IP address.');
  assert.equal(label('class'), 'Use Class C addresses (beginning 192 to 223) for every device except the hubs.');
  assert.equal(label('network'), 'Put every device except the hubs on the same network.');
  assert.equal(label('rule-a'), 'Turn on VoIP for every device except the hubs.');
  assert.deepEqual(validateSpec(spec).list, []);
  assert.equal(evaluateScenario(c, buildReferenceSolution(spec)).passed, true);

  const noHubs = compileScenario({ ...spec, devices: { ...spec.devices, hub: 0 } });
  assert.equal(noHubs.checks.find((x) => x.id === 'ips').label, 'Give every device its own IP address.');

  const hubsOnly = { ...spec, devices: { router: 0, hub: 3, pc: 0, server: 0, modem: 0 }, layout: { kind: 'any', center: 'router' }, rules: [] };
  assert.match(validateSpec(hubsOnly).errors.devices, /Hubs work at Layer 1/);
  assert.equal(validateSpec({ ...hubsOnly, requireIps: false, ipClass: 'any' }).errors.devices, undefined, 'unless addresses are off');
});

test('Layer 1: an imported file that names a hub in a rule is cleaned, not trusted', () => {
  const text = JSON.stringify({ format: FILE_FORMAT, version: 1, scenario: { title: 'Imported', devices: { router: 1, pc: 2, hub: 1 }, layout: { kind: 'connected' }, rules: [{ id: 'x', policy: 'ssh', kind: 'only', types: ['router', 'hub'] }] } });
  const parsed = parseScenarioFile(text);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.spec.rules[0].types, ['router']);
  assert.deepEqual(JSON.parse(serializeScenario(parsed.spec)).scenario.rules[0].types, ['router']);
});

test('Layer 1: a hub still carries a packet, it just can’t be one end of it', () => {
  const { state, ids } = addNodes(createState(), ['pc', 'hub', 'pc']);
  let s = run(state, { type: 'connect', a: ids[0], b: ids[1], cable: 'straight' }, { type: 'connect', a: ids[1], b: ids[2], cable: 'straight' }, { type: 'autoIps' });
  const r = traceRoute(s.doc, ids[0], ids[2], 'ping');
  assert.equal(r.ok, true);
  assert.deepEqual(r.path, [ids[0], ids[1], ids[2]]);
  assert.equal(traceRoute(s.doc, ids[0], ids[1], 'ping').failure.code, 'bad-endpoint');
  assert.match(traceRoute(s.doc, ids[0], ids[1], 'ping').failure.detail, /Layer 1/);
});

test('Layer 1: a star with a hub at the center works, for scenarios and for packets', () => {
  // A custom scenario whose star is centered on a hub.
  const spec = { ...emptySpec(), title: 'Hub star', devices: { router: 0, hub: 1, pc: 4, server: 0, modem: 0 },
    layout: { kind: 'star', center: 'hub' }, ipClass: 'C', sameNetwork: true, requireCabling: true,
    rules: [{ id: 'a', policy: 'allowWeb', kind: 'all', types: [], count: 1, requires: '' }] };
  const v = validateSpec(spec);
  assert.deepEqual(v.list, [], 'a hub is an allowed center');
  const compiled = compileScenario(spec);
  assert.equal(compiled.checks.find((c) => c.id === 'layout').label, 'Link the hub to every other device, with no other links, to form a star.');

  const solved = buildReferenceSolution(spec);
  const hub = solved.nodes.find((n) => n.type === 'hub');
  const pcs = solved.nodes.filter((n) => n.type === 'pc');
  assert.equal(solved.edges.length, 4, 'one link from the hub to each PC');
  assert.ok(solved.edges.every((e) => e.a === hub.id || e.b === hub.id), 'and nothing else is linked');
  assert.ok(solved.edges.every((e) => e.cable === 'straight'), 'PC to hub is straight-through');
  assert.equal(hub.ip, '', 'the hub at the center has no address');
  assert.ok(pcs.every((p) => p.ip), 'every PC does');
  assert.ok(pcs.every((p) => (solved.policies[p.id] ?? []).includes('allowWeb')) && !solved.policies[hub.id], 'policies go on the PCs, never the hub');
  const result = evaluateScenario(compiled, solved);
  assert.deepEqual(failing(result), [], 'every requirement is met');

  // More than one hub, or none, is not a star around a hub.
  assert.match(validateSpec({ ...spec, devices: { ...spec.devices, hub: 2 } }).errors.layout, /exactly one hub at its center/);
  assert.ok(validateSpec({ ...spec, devices: { ...spec.devices, hub: 0, router: 1 } }).errors.layout);

  // Extra links that skip the hub are named.
  const bypass = run(createState(solved), { type: 'connect', a: pcs[0].id, b: pcs[1].id, cable: 'crossover' });
  assert.match(evaluateScenario(compiled, bypass.doc).checks.find((c) => c.id === 'layout').detail, /Remove links that skip the hub: PC 1 to PC 2/);

  // And a packet crosses the hub from one PC to another.
  const r = traceRoute(solved, pcs[0].id, pcs[3].id, 'web');
  assert.equal(r.ok, true);
  assert.deepEqual(r.path, [pcs[0].id, hub.id, pcs[3].id]);
  assert.match(r.log[1].text, /Hub 1 repeats it out of every other port, to PC 2, PC 3 and PC 4/);
});

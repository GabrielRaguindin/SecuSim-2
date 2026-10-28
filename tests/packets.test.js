import test from 'node:test';
import assert from 'node:assert/strict';
import { traceRoute, canBeEndpoint, PACKET_KINDS, PACKET_ORDER } from '../lib/packets.js';
import { requiredCable } from '../lib/cabling.js';
import { networkOf } from '../lib/ip.js';
import { createState, networkReducer } from '../lib/networkReducer.js';
import { addNodes, run } from './helpers.js';

/**
 * Builds a network from a short description:
 *   types: device types in order, links: [[i, j, cable?]] (cable defaults to the right one),
 *   ips: address per device ('' for none), policies: { index: [policy ids] }
 */
function net({ types, links = [], ips = [], policies = {} }) {
  const { state, ids } = addNodes(createState(), types);
  let s = state;
  links.forEach(([i, j, cable]) => {
    s = run(s, { type: 'connect', a: ids[i], b: ids[j], cable: cable ?? requiredCable(types[i], types[j]) });
  });
  ips.forEach((ip, i) => { if (ip) s = run(s, { type: 'setIp', id: ids[i], ip }); });
  for (const [i, list] of Object.entries(policies)) for (const p of list) s = run(s, { type: 'togglePolicy', ids: [ids[i]], policy: p, on: true });
  return { doc: s.doc, ids, state: s };
}
const send = (n, i, j, kind = 'ping') => traceRoute(n.doc, n.ids[i], n.ids[j], kind);
const names = (n, r) => r.path.map((id) => n.doc.nodes.find((x) => x.id === id).name);

test('a packet crosses a hub between two PCs on the same network', () => {
  const n = net({ types: ['pc', 'hub', 'pc'], links: [[0, 1], [1, 2]], ips: ['192.168.1.1', '', '192.168.1.2'] });
  const r = send(n, 0, 2);
  assert.equal(r.ok, true);
  assert.equal(r.failure, null);
  assert.deepEqual(names(n, r), ['PC 1', 'Hub 1', 'PC 2']);
  assert.equal(r.summary, 'Delivered in 2 hops');
  assert.deepEqual(r.log.map((l) => l.ok), [true, true, true]);
  assert.match(r.log[0].text, /PC 1 sends a ping to 192\.168\.1\.2/);
  assert.match(r.log[1].text, /Hub 1 repeats it/);
  assert.match(r.log[2].text, /PC 2 receives it/);
});

test('two PCs joined directly work with a crossover cable and fail with a straight-through one', () => {
  const good = net({ types: ['pc', 'pc'], links: [[0, 1, 'crossover']], ips: ['192.168.1.1', '192.168.1.2'] });
  assert.equal(send(good, 0, 1).ok, true);

  const bad = net({ types: ['pc', 'pc'], links: [[0, 1, 'straight']], ips: ['192.168.1.1', '192.168.1.2'] });
  const r = send(bad, 0, 1);
  assert.equal(r.ok, false);
  assert.equal(r.failure.code, 'wrong-cable');
  assert.equal(r.failure.edgeId, bad.doc.edges[0].id);
  assert.deepEqual(names(bad, r), ['PC 1'], 'it never left the sender');
  assert.match(r.failure.detail, /straight-through cable.*needs a crossover/);
  assert.match(r.failure.detail, /both transmit on pins 1 and 2/);
  assert.match(r.failure.detail, /couldn’t leave PC 1/);
  assert.match(r.failure.fix, /change its cable/);
  // the fix works
  const fixed = run(bad.state, { type: 'setCable', id: bad.doc.edges[0].id, cable: 'crossover' });
  assert.equal(traceRoute(fixed.doc, bad.ids[0], bad.ids[1]).ok, true);
});

test('the packet stops at the device before a bad link, partway along the route', () => {
  // PC 1 - Hub (fine), Hub - PC 2 wrong
  const n = net({ types: ['pc', 'hub', 'pc'], links: [[0, 1], [1, 2, 'crossover']], ips: ['192.168.1.1', '', '192.168.1.2'] });
  const r = send(n, 0, 2);
  assert.equal(r.failure.code, 'wrong-cable');
  assert.deepEqual(names(n, r), ['PC 1', 'Hub 1']);
  assert.equal(r.failure.nodeId, n.ids[1]);
  assert.match(r.failure.detail, /stopped at Hub 1/);
  assert.deepEqual(r.log.map((l) => l.ok), [true, false]);
});

test('traffic reroutes around a broken link when another route works', () => {
  // PC 1 - PC 2 direct (wrong cable) and PC 1 - Hub - PC 2 (fine)
  const n = net({ types: ['pc', 'pc', 'hub'], links: [[0, 1, 'straight'], [0, 2], [2, 1]], ips: ['192.168.1.1', '192.168.1.2', ''] });
  const r = send(n, 0, 1);
  assert.equal(r.ok, true);
  assert.deepEqual(names(n, r), ['PC 1', 'Hub 1', 'PC 2']);
});

test('the shortest working route is used', () => {
  const n = net({ types: ['pc', 'hub', 'hub', 'pc'], links: [[0, 1], [1, 2, 'crossover'], [2, 3], [1, 3]], ips: ['192.168.1.1', '', '', '192.168.1.2'] });
  assert.deepEqual(names(n, send(n, 0, 3)), ['PC 1', 'Hub 1', 'PC 2']);
});

test('both devices need an address, and the message names who is missing', () => {
  const n = net({ types: ['pc', 'pc'], links: [[0, 1, 'crossover']], ips: ['192.168.1.1', ''] });
  const one = send(n, 0, 1);
  assert.equal(one.failure.code, 'no-address');
  assert.match(one.failure.title, /PC 2 has no IP address/);
  const none = net({ types: ['pc', 'pc'], links: [[0, 1, 'crossover']] });
  assert.match(send(none, 0, 1).failure.title, /PC 1 and PC 2 have no IP address/);
  assert.match(send(none, 0, 1).failure.fix, /lightning button/);
});

test('no links means no route, and says what the sender can reach', () => {
  const n = net({ types: ['pc', 'pc', 'server'], links: [[0, 2]], ips: ['192.168.1.1', '192.168.1.2', '192.168.1.3'] });
  const r = send(n, 0, 1);
  assert.equal(r.failure.code, 'no-route');
  assert.match(r.failure.detail, /PC 1 can reach Server 1/);
  assert.deepEqual(names(n, r), ['PC 1']);
  const alone = net({ types: ['pc', 'pc'], ips: ['192.168.1.1', '192.168.1.2'] });
  assert.match(send(alone, 0, 1).failure.detail, /can reach nothing yet/);
});

test('devices on different networks need a router between them', () => {
  const hubOnly = net({ types: ['pc', 'hub', 'pc'], links: [[0, 1], [1, 2]], ips: ['192.168.1.1', '', '10.0.0.5'] });
  const r = send(hubOnly, 0, 2);
  assert.equal(r.failure.code, 'no-router');
  assert.match(r.failure.detail, /192\.168\.1\.0.*10\.0\.0\.0.*router/);
  assert.match(r.failure.fix, /same network/);

  const viaRouter = net({ types: ['pc', 'router', 'pc'], links: [[0, 1], [1, 2]], ips: ['192.168.1.1', '', '10.0.0.5'] });
  const ok = send(viaRouter, 0, 2);
  assert.equal(ok.ok, true);
  assert.match(ok.log[1].text, /Router 1 routes it across to the other network/);
});

test('a router elsewhere in the network does not help unless the route goes through it', () => {
  const n = net({ types: ['pc', 'pc', 'router'], links: [[0, 1, 'crossover'], [1, 2]], ips: ['192.168.1.1', '10.0.0.5', ''] });
  assert.equal(send(n, 0, 1).failure.code, 'no-router', 'PC 1 to PC 2 is direct, with no router on the way');
});

test('a router can sit on a hub and still route between two networks', () => {
  // PC 1 and PC 2 hang off one hub, the router also hangs off it: the route goes up to the router and back.
  const n = net({ types: ['pc', 'hub', 'pc', 'router'], links: [[0, 1], [1, 2], [1, 3]], ips: ['192.168.1.1', '', '10.0.0.5', ''] });
  const r = send(n, 0, 2);
  assert.equal(r.ok, true);
  assert.deepEqual(names(n, r), ['PC 1', 'Hub 1', 'Router 1', 'Hub 1', 'PC 2']);
});

test('a router that can only be reached over a wrong cable reports the cable, not a missing router', () => {
  const n = net({ types: ['pc', 'router', 'pc'], links: [[0, 1, 'straight'], [1, 2]], ips: ['192.168.1.1', '', '10.0.0.5'] });
  const r = send(n, 0, 2);
  assert.equal(r.failure.code, 'wrong-cable');
  assert.match(r.failure.title, /PC 1 to Router 1/);
});

test('a router as the sender or receiver counts as the router on the route', () => {
  const n = net({ types: ['router', 'pc'], links: [[0, 1]], ips: ['10.0.0.1', '192.168.1.5'] });
  assert.equal(send(n, 0, 1).ok, true);
  assert.equal(send(n, 1, 0).ok, true);
});

test('the same network means the same class mask, not just the same class', () => {
  assert.equal(networkOf('10.0.0.1'), networkOf('10.200.3.4'), 'one Class A network');
  const a = net({ types: ['pc', 'hub', 'pc'], links: [[0, 1], [1, 2]], ips: ['10.0.0.1', '', '10.200.3.4'] });
  assert.equal(send(a, 0, 2).ok, true);
  const c = net({ types: ['pc', 'hub', 'pc'], links: [[0, 1], [1, 2]], ips: ['192.168.1.1', '', '192.168.2.1'] });
  assert.equal(send(c, 0, 2).failure.code, 'no-router', 'two different Class C networks');
});

test('endpoints: a hub can’t send or receive, nor can a device send to itself', () => {
  const n = net({ types: ['pc', 'hub'], links: [[0, 1]], ips: ['192.168.1.1', ''] });
  assert.equal(send(n, 0, 1).failure.code, 'bad-endpoint');
  assert.equal(send(n, 1, 0).failure.code, 'bad-endpoint');
  assert.equal(send(n, 0, 0).failure.code, 'same-device');
  assert.equal(traceRoute(n.doc, 'ghost', n.ids[0]).failure.code, 'missing');
  assert.equal(traceRoute(n.doc, n.ids[0], 'ghost').failure.code, 'missing');
  assert.equal(canBeEndpoint('hub'), false);
  for (const t of ['pc', 'server', 'router', 'modem']) assert.equal(canBeEndpoint(t), true, t);
});

test('servers and modems can be endpoints', () => {
  const n = net({ types: ['server', 'hub', 'modem'], links: [[0, 1], [1, 2, 'crossover']], ips: ['192.168.1.1', '', '192.168.1.2'] });
  assert.equal(send(n, 0, 2).ok, true);
});

test('ping: Block ping requests on the receiver drops it, on arrival', () => {
  const n = net({ types: ['pc', 'hub', 'pc'], links: [[0, 1], [1, 2]], ips: ['192.168.1.1', '', '192.168.1.2'], policies: { 2: ['blockPing'] } });
  const r = send(n, 0, 2, 'ping');
  assert.equal(r.ok, false);
  assert.equal(r.failure.code, 'receiver-blocked');
  assert.equal(r.failure.nodeId, n.ids[2]);
  assert.deepEqual(names(n, r), ['PC 1', 'Hub 1', 'PC 2'], 'it travelled all the way, then was dropped');
  assert.match(r.failure.detail, /Block ping requests is on for PC 2/);
  assert.equal(send(n, 0, 2, 'web').failure.code, 'sender-policy', 'blockPing only affects pings');
  const web = net({ types: ['pc', 'hub', 'pc'], links: [[0, 1], [1, 2]], ips: ['192.168.1.1', '', '192.168.1.2'], policies: { 0: ['allowWeb'], 1: [], 2: ['blockPing', 'allowWeb'] } });
  assert.equal(send(web, 0, 2, 'web').ok, true, 'a web request is not a ping');
  assert.equal(send(web, 2, 0, 'ping').ok, true, 'and blocking pings only protects the device that has the policy');
});

test('web and file packets need the matching policy at both ends', () => {
  const mk = (p0, p2) => net({ types: ['pc', 'hub', 'server'], links: [[0, 1], [1, 2]], ips: ['192.168.1.1', '', '192.168.1.2'], policies: { 0: p0, 2: p2 } });
  for (const [kind, policy, label] of [['web', 'allowWeb', 'Allow web traffic'], ['file', 'fileTransfer', 'File transfer access']]) {
    const neither = send(mk([], []), 0, 2, kind);
    assert.equal(neither.failure.code, 'sender-policy');
    assert.equal(neither.failure.nodeId, mk([], []).ids[0]);
    assert.match(neither.failure.fix, new RegExp(`Turn on ${label} for PC 1`));
    const senderOnly = send(mk([policy], []), 0, 2, kind);
    assert.equal(senderOnly.failure.code, 'receiver-blocked');
    assert.match(senderOnly.failure.fix, new RegExp(`Turn on ${label} for Server 1`));
    assert.equal(send(mk([policy], [policy]), 0, 2, kind).ok, true, `${kind} with both`);
  }
  assert.equal(send(mk([], []), 0, 2, 'ping').ok, true, 'a ping needs no policy');
});

test('Restrict outbound traffic only stops packets leaving for another network', () => {
  const across = net({ types: ['pc', 'router', 'pc'], links: [[0, 1], [1, 2]], ips: ['192.168.1.1', '', '10.0.0.5'], policies: { 0: ['restrictOutbound'] } });
  const r = send(across, 0, 2);
  assert.equal(r.failure.code, 'outbound-blocked');
  assert.deepEqual(names(across, r), ['PC 1'], 'blocked at the sender');
  assert.match(r.failure.detail, /192\.168\.1\.0.*10\.0\.0\.0/);
  const inside = net({ types: ['pc', 'hub', 'pc'], links: [[0, 1], [1, 2]], ips: ['192.168.1.1', '', '192.168.1.2'], policies: { 0: ['restrictOutbound'] } });
  assert.equal(send(inside, 0, 2).ok, true, 'same network is not outbound');
});

test('Block untrusted IP only drops packets from another network', () => {
  const across = net({ types: ['pc', 'router', 'pc'], links: [[0, 1], [1, 2]], ips: ['192.168.1.1', '', '10.0.0.5'], policies: { 2: ['blockUntrusted'] } });
  const r = send(across, 0, 2);
  assert.equal(r.failure.code, 'receiver-blocked');
  assert.match(r.failure.detail, /192\.168\.1\.1 isn’t on PC 2’s network \(10\.0\.0\.0\)/);
  assert.deepEqual(names(across, r), ['PC 1', 'Router 1', 'PC 2']);
  const inside = net({ types: ['pc', 'hub', 'pc'], links: [[0, 1], [1, 2]], ips: ['192.168.1.1', '', '192.168.1.2'], policies: { 2: ['blockUntrusted'] } });
  assert.equal(send(inside, 0, 2).ok, true);
});

test('problems are found in a sensible order: the sender’s own firewall before the route', () => {
  const n = net({ types: ['pc', 'pc'], ips: ['192.168.1.1', '10.0.0.5'], policies: { 0: ['restrictOutbound'] } });
  assert.equal(send(n, 0, 1).failure.code, 'outbound-blocked', 'before no-route');
  const m = net({ types: ['pc', 'pc'], ips: ['', '10.0.0.5'] });
  assert.equal(send(m, 0, 1).failure.code, 'no-address', 'before anything else about the route');
});

test('every packet kind has a name, a help line and a place in the picker', () => {
  assert.deepEqual(PACKET_ORDER, ['ping', 'web', 'file']);
  for (const id of PACKET_ORDER) assert.ok(PACKET_KINDS[id].label && PACKET_KINDS[id].noun && PACKET_KINDS[id].help.length > 10);
  const n = net({ types: ['pc', 'pc'], links: [[0, 1, 'crossover']], ips: ['192.168.1.1', '192.168.1.2'] });
  assert.equal(traceRoute(n.doc, n.ids[0], n.ids[1], 'nonsense').kind, 'ping', 'unknown kinds fall back to ping');
});

test('tracing never changes the network', () => {
  const n = net({ types: ['pc', 'hub', 'pc'], links: [[0, 1], [1, 2, 'crossover']], ips: ['192.168.1.1', '', '192.168.1.2'] });
  const before = JSON.stringify(n.doc);
  send(n, 0, 2); send(n, 2, 0, 'web'); send(n, 0, 1);
  assert.equal(JSON.stringify(n.doc), before);
});

test('property: a delivered packet always had a real route, the right cables and addressed endpoints', () => {
  // A small seeded random generator, so a failure is reproducible.
  let seed = 20260101;
  const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const TYPES = ['pc', 'pc', 'server', 'hub', 'router', 'modem'];
  const POLICIES = ['allowWeb', 'fileTransfer', 'blockPing', 'blockUntrusted', 'restrictOutbound'];
  let delivered = 0;
  let blocked = 0;

  for (let round = 0; round < 600; round += 1) {
    const count = 2 + Math.floor(rand() * 5);
    const types = Array.from({ length: count }, () => pick(TYPES));
    const links = [];
    for (let i = 0; i < count; i += 1) for (let j = i + 1; j < count; j += 1) {
      if (rand() < 0.6) links.push([i, j, rand() < 0.85 ? undefined : pick(['straight', 'crossover'])]);
    }
    // Mostly one shared network, some strays, the odd missing address; every address is unique.
    const unique = types.map((t, i) => {
      if (t === 'hub' || rand() < 0.06) return '';
      return rand() < 0.75 ? `192.168.1.${10 + i}` : `10.0.0.${10 + i}`;
    });
    const policies = {};
    types.forEach((_, i) => { if (rand() < 0.15) policies[i] = [pick(POLICIES)]; });
    const n = net({ types, links, ips: unique, policies });
    const i = Math.floor(rand() * count);
    let j = Math.floor(rand() * count);
    if (j === i) j = (j + 1) % count;
    const kind = pick(PACKET_ORDER);
    const r = send(n, i, j, kind);
    const byId = new Map(n.doc.nodes.map((x) => [x.id, x]));

    assert.equal(r.path[0], n.ids[i], 'the path starts at the sender');
    if (r.ok) {
      delivered += 1;
      assert.equal(r.failure, null);
      assert.equal(r.path[r.path.length - 1], n.ids[j], 'and ends at the receiver');
      assert.ok(byId.get(n.ids[i]).ip && byId.get(n.ids[j]).ip, 'both endpoints are addressed');
      for (let k = 0; k < r.path.length - 1; k += 1) {
        const edge = n.doc.edges.find((e) => (e.a === r.path[k] && e.b === r.path[k + 1]) || (e.b === r.path[k] && e.a === r.path[k + 1]));
        assert.ok(edge, 'every hop is a real link');
        assert.equal(edge.cable, requiredCable(byId.get(edge.a).type, byId.get(edge.b).type), 'with the right cable');
      }
      if (networkOf(byId.get(n.ids[i]).ip) !== networkOf(byId.get(n.ids[j]).ip)) {
        assert.ok(r.path.some((id) => byId.get(id).type === 'router'), 'crossing networks went through a router');
      }
    } else {
      blocked += 1;
      assert.ok(r.failure && r.failure.code && r.failure.title && r.failure.detail !== undefined && r.failure.fix, 'a failure always explains itself');
      assert.equal(r.log[r.log.length - 1].ok, false, 'the log ends on the failure');
      assert.ok(r.path.length >= 1 || r.failure.code === 'missing');
    }
  }
  assert.ok(delivered > 40 && blocked > 40, `the random networks exercise both outcomes (${delivered} delivered, ${blocked} blocked)`);
});

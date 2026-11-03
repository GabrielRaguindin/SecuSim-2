import test from 'node:test';
import assert from 'node:assert/strict';
import { traceRoute, PACKET_KINDS } from '../lib/packets.js';
import { requiredCable } from '../lib/cabling.js';
import { networkOf } from '../lib/ip.js';
import { createState } from '../lib/networkReducer.js';
import { addNodes, run } from './helpers.js';

/** types in order; links [[i, j, cable?]] (the right cable unless given); ips per device; policies { index: [ids] } */
function net({ types, links = [], ips = [], policies = {} }) {
  const { state, ids } = addNodes(createState(), types);
  let s = state;
  links.forEach(([i, j, cable]) => { s = run(s, { type: 'connect', a: ids[i], b: ids[j], cable: cable ?? requiredCable(types[i], types[j]) }); });
  ips.forEach((ip, i) => { if (ip) s = run(s, { type: 'setIp', id: ids[i], ip }); });
  for (const [i, list] of Object.entries(policies)) for (const p of list) s = run(s, { type: 'togglePolicy', ids: [ids[i]], policy: p, on: true });
  return { doc: s.doc, ids, state: s };
}
const nameOf = (n, id) => n.doc.nodes.find((x) => x.id === id).name;
const names = (n, list) => list.map((id) => nameOf(n, id));
const send = (n, i, j, kind = 'ping') => traceRoute(n.doc, n.ids[i], n.ids[j], kind);

// PC 1 (192.168.1.1) - Router 1 - PC 2, on the same network or another one
const viaRouter = (pc2Ip, policies = {}, routerIp = '') => net({
  types: ['pc', 'router', 'pc'], links: [[0, 1], [1, 2]], ips: ['192.168.1.1', routerIp, pc2Ip], policies,
});

test('a ping is answered: the receiver replies back along the route the request took', () => {
  const n = net({ types: ['pc', 'hub', 'pc'], links: [[0, 1], [1, 2]], ips: ['192.168.1.1', '', '192.168.1.2'] });
  const r = send(n, 0, 2);
  assert.equal(r.ok, true);
  assert.equal(r.status, 'answered');
  assert.equal(r.summary, 'Answered in 2 hops each way');
  assert.deepEqual(names(n, r.path), ['PC 1', 'Hub 1', 'PC 2'], '`path` is still the way the request went');
  assert.deepEqual(names(n, r.reply.path), ['PC 2', 'Hub 1', 'PC 1'], 'and the reply goes back the same way');
  assert.equal(r.reply.ok, true);
  assert.equal(r.failure, null);
  assert.deepEqual(r.log.map((l) => l.text), [
    'PC 1 sends a ping to 192.168.1.2.',
    'Hub 1 repeats it out of every other port, to PC 2.',
    'PC 2 receives it.',
    'PC 2 sends a ping reply to 192.168.1.1.',
    'Hub 1 repeats it out of every other port, to PC 1.',
    'PC 1 receives the reply.',
  ]);
});

test('one hop reads in the singular', () => {
  const n = net({ types: ['pc', 'pc'], links: [[0, 1, 'crossover']], ips: ['192.168.1.1', '192.168.1.2'] });
  assert.equal(send(n, 0, 1).summary, 'Answered in 1 hop each way');
});

test('only a ping is answered: a web request or a file transfer has no reply', () => {
  const n = net({ types: ['pc', 'pc'], links: [[0, 1, 'crossover']], ips: ['192.168.1.1', '192.168.1.2'], policies: { 0: ['allowWeb', 'fileTransfer'], 1: ['allowWeb', 'fileTransfer'] } });
  for (const kind of ['web', 'file']) {
    const r = send(n, 0, 1, kind);
    assert.equal(r.status, 'delivered', kind);
    assert.equal(r.reply, null, kind);
    assert.match(r.summary, /^Delivered in 1 hop$/);
  }
});

test('a ping that never arrives has no reply, and is simply blocked', () => {
  const n = net({ types: ['pc', 'pc'], ips: ['192.168.1.1', '192.168.1.2'] });
  const r = send(n, 0, 1);
  assert.equal(r.status, 'blocked');
  assert.equal(r.reply, null);
  assert.equal(r.failure.code, 'no-route');
  const ignored = net({ types: ['pc', 'pc'], links: [[0, 1, 'crossover']], ips: ['192.168.1.1', '192.168.1.2'], policies: { 1: ['blockPing'] } });
  const i = send(ignored, 0, 1);
  assert.equal(i.status, 'blocked', 'a receiver that ignores pings never answers');
  assert.equal(i.failure.code, 'receiver-blocked');
  assert.equal(i.reply, null);
});

test('Block ping requests stops a request, but not a reply: a sender with it still gets its answer', () => {
  const n = net({ types: ['pc', 'pc'], links: [[0, 1, 'crossover']], ips: ['192.168.1.1', '192.168.1.2'], policies: { 0: ['blockPing'] } });
  assert.equal(send(n, 0, 1).status, 'answered');
  // and a router in the middle with it stops the request, so there is never a reply to stop
  const mid = viaRouter('192.168.1.2', { 1: ['blockPing'] });
  assert.equal(send(mid, 0, 2).failure.code, 'transit-blocked');
});

test('a receiver that can’t send to another network gets the ping but can’t answer it', () => {
  const n = viaRouter('10.0.0.5', { 2: ['restrictOutbound'] });
  const r = send(n, 0, 2);
  assert.equal(r.ok, false);
  assert.equal(r.status, 'unanswered');
  assert.equal(r.failure.code, 'reply-blocked');
  assert.equal(r.failure.reply, true);
  assert.equal(r.failure.title, 'PC 2’s firewall blocked the reply');
  assert.match(r.failure.detail, /^The ping reached PC 2, but the reply didn’t make it back\. Restrict outbound traffic is on for PC 2, so it can’t send the reply to another network\. PC 2 is on 10\.0\.0\.0 and PC 1 is on 192\.168\.1\.0\.$/);
  assert.equal(r.failure.fix, 'Turn Restrict outbound traffic off for PC 2.');
  assert.deepEqual(names(n, r.path), ['PC 1', 'Router 1', 'PC 2'], 'the request did arrive');
  assert.deepEqual(names(n, r.reply.path), ['PC 2'], 'the reply never left PC 2');
  assert.equal(r.reply.ok, false);
  assert.equal(r.failure.nodeId, n.ids[2]);
  assert.deepEqual(r.log.map((l) => l.ok), [true, true, true, true, false], 'the request, then the reply that stops at once');
  assert.equal(r.log[2].text, 'PC 2 receives it.');
  assert.equal(r.log[3].text, 'PC 2 sends a ping reply to 192.168.1.1.');
  assert.equal(r.log[4].text, 'PC 2’s firewall blocked the reply');
  assert.equal(send(viaRouter('192.168.1.2', { 2: ['restrictOutbound'] }), 0, 2).status, 'answered', 'on its own network it can answer');
});

test('a sender with Block untrusted IP drops the reply that comes from another network', () => {
  const n = viaRouter('10.0.0.5', { 0: ['blockUntrusted'] });
  const r = send(n, 0, 2);
  assert.equal(r.status, 'unanswered');
  assert.equal(r.failure.code, 'reply-blocked');
  assert.equal(r.failure.title, 'PC 1’s firewall dropped the reply');
  assert.match(r.failure.detail, /^The ping reached PC 2, but the reply didn’t make it back\. Block untrusted IP is on for PC 1, and 10\.0\.0\.5 isn’t on PC 1’s network \(192\.168\.1\.0\), so the reply was dropped on arrival\.$/);
  assert.equal(r.failure.fix, 'Turn Block untrusted IP off for PC 1, or ping a device on 192.168.1.0.');
  assert.deepEqual(names(n, r.reply.path), ['PC 2', 'Router 1', 'PC 1'], 'the reply got all the way back before it was dropped');
  assert.equal(r.failure.nodeId, n.ids[0]);
  assert.equal(send(viaRouter('192.168.1.2', { 0: ['blockUntrusted'] }), 0, 2).status, 'answered', 'a reply from the same network is trusted');
});

test('a router on the way back can drop the reply: addressed on the sender’s network it lets the request in and the answer out only if it trusts them', () => {
  const n = viaRouter('10.0.0.5', { 1: ['blockUntrusted'] }, '192.168.1.254');
  const r = send(n, 0, 2);
  assert.equal(r.status, 'unanswered');
  assert.equal(r.failure.title, 'The reply was blocked at Router 1');
  assert.match(r.failure.detail, /^The ping reached PC 2, but the reply didn’t make it back\. Block untrusted IP is on for Router 1, and 10\.0\.0\.5 isn’t on Router 1’s network \(192\.168\.1\.0\)/);
  assert.match(r.failure.fix, /or ping a device on 192\.168\.1\.0/);
  assert.deepEqual(names(n, r.reply.path), ['PC 2', 'Router 1'], 'it stops at the router');
  assert.equal(r.failure.nodeId, n.ids[1]);
});

test('a router that can’t forward to another network already stopped the request, so there is nothing to answer', () => {
  const r = send(viaRouter('10.0.0.5', { 1: ['restrictOutbound'] }), 0, 2);
  assert.equal(r.status, 'blocked');
  assert.equal(r.failure.code, 'transit-blocked');
});

test('the reply meets the hubs again: their copies are drawn and listed for the way back too', () => {
  // PC 1 - Hub 1 - PC 2, with PC 3 also on the hub
  const n = net({ types: ['pc', 'hub', 'pc', 'pc'], links: [[0, 1], [1, 2], [1, 3]], ips: ['192.168.1.1', '', '192.168.1.2', '192.168.1.3'] });
  const r = send(n, 0, 2);
  assert.equal(r.status, 'answered');
  assert.deepEqual(names(n, r.broadcasts[0].heard), ['PC 3'], 'the request’s copies');
  assert.deepEqual(names(n, r.reply.broadcasts[0].heard), ['PC 3'], 'and the reply’s');
  assert.equal(r.log.filter((l) => /^Heard by PC 3/.test(l.text)).length, 2, 'PC 3 hears both and ignores both');
});

test('a reply that is stopped after a hub still reports what the hub copied on the way', () => {
  // PC 1 - Router 1 (addressed on PC 1's network, Block untrusted IP) - Hub 1 - PC 2 (another network), PC 3 also on the hub.
  // The request passes the router; the reply crosses the hub first and is dropped at the router.
  const n = net({ types: ['pc', 'router', 'hub', 'pc', 'pc'], links: [[0, 1], [1, 2], [2, 3], [2, 4]], ips: ['192.168.1.1', '192.168.1.254', '', '10.0.0.5', '10.0.0.6'], policies: { 1: ['blockUntrusted'] } });
  const r = send(n, 0, 3);
  assert.equal(r.status, 'unanswered');
  assert.deepEqual(names(n, r.reply.path), ['PC 2', 'Hub 1', 'Router 1']);
  assert.equal(r.failure.nodeId, n.ids[1]);
  assert.deepEqual(names(n, r.reply.broadcasts[0].heard), ['PC 3'], 'the hub copied the reply before the router dropped it');
  assert.equal(r.log.filter((l) => /^Hub 1 repeats it/.test(l.text)).length, 2, 'once for the request, once for the reply');
});

test('a ping answered across a router retraces the same devices both ways', () => {
  const n = viaRouter('10.0.0.5');
  const r = send(n, 0, 2);
  assert.equal(r.status, 'answered');
  assert.deepEqual(r.reply.path, [...r.path].reverse());
  assert.equal(r.summary, 'Answered in 2 hops each way');
});

test('the packet kinds still describe themselves, and the ping help mentions the answer', () => {
  assert.match(PACKET_KINDS.ping.help, /receiver answers/);
});

test('tracing never changes the network, replies included', () => {
  const n = viaRouter('10.0.0.5', { 2: ['restrictOutbound'] });
  const before = JSON.stringify(n.doc);
  send(n, 0, 2); send(n, 2, 0);
  assert.equal(JSON.stringify(n.doc), before);
});

test('property: a ping’s status agrees with its reply, and a failed reply stops at the first device that objects', () => {
  let seed = 777001;
  const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const TYPES = ['pc', 'pc', 'server', 'switch', 'router', 'modem', 'hub'];
  const POLICIES = ['restrictOutbound', 'blockUntrusted', 'blockPing', 'voip', 'restrictOutbound', 'blockUntrusted'];
  const seen = { answered: 0, unanswered: 0, blocked: 0 };

  for (let round = 0; round < 3000; round += 1) {
    const count = 2 + Math.floor(rand() * 5);
    const types = Array.from({ length: count }, () => pick(TYPES));
    const links = [];
    for (let i = 0; i < count; i += 1) for (let j = i + 1; j < count; j += 1) if (rand() < 0.5) links.push([i, j]);
    const ips = types.map((t, i) => (t === 'hub' || rand() < 0.08 ? '' : rand() < 0.5 ? `192.168.1.${10 + i}` : `10.0.0.${10 + i}`));
    const policies = {};
    types.forEach((_, i) => { if (rand() < 0.4) policies[i] = [pick(POLICIES), pick(POLICIES)]; });
    const n = net({ types, links, ips, policies });
    const i = Math.floor(rand() * count);
    let j = Math.floor(rand() * count);
    if (j === i) j = (j + 1) % count;
    const r = send(n, i, j, 'ping');
    const byId = new Map(n.doc.nodes.map((x) => [x.id, x]));
    const has = (id, p) => (n.doc.policies[id] ?? []).includes(p);
    seen[r.status] = (seen[r.status] ?? 0) + 1;

    assert.equal(r.ok, r.status === 'answered', 'ok means answered');
    assert.equal(r.path[0], n.ids[i], 'the request path starts at the sender');
    if (r.status === 'blocked') { assert.equal(r.reply, null); continue; }
    if (r.failure?.code === 'broadcast-storm') continue;

    // the request arrived
    assert.equal(r.path[r.path.length - 1], n.ids[j]);
    assert.ok(r.reply && r.reply.path[0] === n.ids[j], 'the reply starts at the receiver');

    // an independent statement of the rules a reply meets
    const from = byId.get(n.ids[j]);
    const to = byId.get(n.ids[i]);
    const fromNet = networkOf(from.ip);
    const toNet = networkOf(to.ip);
    const cross = fromNet !== toNet;
    const back = [...r.path].reverse();
    const objects = (index) => {
      const node = byId.get(back[index]);
      if (index === 0) return cross && has(node.id, 'restrictOutbound');
      if (index === back.length - 1) return cross && has(node.id, 'blockUntrusted');
      if (node.type === 'hub') return false;
      if (cross && has(node.id, 'restrictOutbound')) return true;
      return has(node.id, 'blockUntrusted') && fromNet !== (node.ip ? networkOf(node.ip) : toNet);
    };
    const first = back.findIndex((_, index) => objects(index));

    if (r.status === 'answered') {
      assert.equal(first, -1, 'nothing on the way back objected');
      assert.deepEqual(r.reply.path, back, 'the reply retraced the route');
      assert.equal(r.reply.ok, true);
    } else {
      assert.equal(r.status, 'unanswered');
      assert.equal(r.failure.code, 'reply-blocked');
      assert.ok(first >= 0, 'something really did object');
      assert.equal(r.failure.nodeId, back[first], 'the first one that objects is where it stopped');
      assert.equal(r.reply.path[r.reply.path.length - 1], back[first]);
      assert.equal(r.reply.ok, false);
    }
    assert.equal(r.log[r.log.length - 1].ok, r.status === 'answered');
  }
  assert.ok(seen.answered > 100 && seen.unanswered > 15 && seen.blocked > 100, JSON.stringify(seen));
});

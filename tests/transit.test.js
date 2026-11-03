import test from 'node:test';
import assert from 'node:assert/strict';
import { traceRoute, PACKET_ORDER } from '../lib/packets.js';
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
const send = (n, i, j, kind = 'ping') => traceRoute(n.doc, n.ids[i], n.ids[j], kind);
const pathNames = (n, r) => r.path.map((id) => nameOf(n, id));

// PC 1 (192.168.1.1) - Router 1 - PC 2, where PC 2 is on the same network or another one
const viaRouter = (pc2Ip, routerPolicies = [], routerIp = '') => net({
  types: ['pc', 'router', 'pc'], links: [[0, 1], [1, 2]],
  ips: ['192.168.1.1', routerIp, pc2Ip], policies: { 1: routerPolicies },
});

test('Restrict outbound traffic on a router in the middle stops a packet leaving for another network', () => {
  const n = viaRouter('10.0.0.5', ['restrictOutbound']);
  const r = send(n, 0, 2);
  assert.equal(r.ok, false);
  assert.equal(r.failure.code, 'transit-blocked');
  assert.equal(r.failure.title, 'Router 1’s firewall blocked it');
  assert.match(r.failure.detail, /won’t forward a packet to another network.*192\.168\.1\.0 to 10\.0\.0\.0/);
  assert.match(r.failure.fix, /Turn Restrict outbound traffic off for Router 1/);
  assert.deepEqual(pathNames(n, r), ['PC 1', 'Router 1'], 'it got as far as the router, and no further');
  assert.equal(r.failure.nodeId, n.ids[1]);
  assert.equal(r.failure.edgeId, null);
  assert.equal(r.log[r.log.length - 1].ok, false);
});

test('and it lets a packet stay on its own network', () => {
  assert.equal(send(viaRouter('192.168.1.7', ['restrictOutbound']), 0, 2).ok, true);
});

test('Block untrusted IP on a router with no address guards the network the packet is heading for', () => {
  const across = viaRouter('10.0.0.5', ['blockUntrusted']);
  const r = send(across, 0, 2);
  assert.equal(r.failure.code, 'transit-blocked');
  assert.match(r.failure.detail, /no address of its own, so it guards the network the packet is heading for \(10\.0\.0\.0\), and 192\.168\.1\.1 isn’t on it/);
  assert.match(r.failure.fix, /send from a device on 10\.0\.0\.0/);
  assert.equal(send(viaRouter('192.168.1.7', ['blockUntrusted']), 0, 2).ok, true, 'traffic inside the network passes');
});

test('Block untrusted IP on a router with an address trusts that address’s network', () => {
  const inOnly = send(viaRouter('10.0.0.5', ['blockUntrusted'], '192.168.1.254'), 0, 2);
  assert.equal(inOnly.status, 'unanswered', 'the ping gets in, because the sender is on the router’s network, but the reply comes from outside it');
  assert.equal(inOnly.failure.code, 'reply-blocked');
  const r = send(viaRouter('10.0.0.5', ['blockUntrusted'], '10.0.0.254'), 0, 2);
  assert.equal(r.failure.code, 'transit-blocked');
  assert.match(r.failure.detail, /192\.168\.1\.1 isn’t on Router 1’s network \(10\.0\.0\.0\), so it dropped the packet on the way through/);
});

test('Block ping requests drops a ping passing through, and only a ping', () => {
  const n = net({ types: ['pc', 'switch', 'pc'], links: [[0, 1], [1, 2]], ips: ['192.168.1.1', '', '192.168.1.2'], policies: { 0: ['allowWeb', 'fileTransfer'], 1: ['blockPing', 'allowWeb', 'fileTransfer'], 2: ['allowWeb', 'fileTransfer'] } });
  const ping = send(n, 0, 2, 'ping');
  assert.equal(ping.failure.code, 'transit-blocked');
  assert.equal(ping.failure.title, 'Switch 1 dropped the ping');
  assert.deepEqual(pathNames(n, ping), ['PC 1', 'Switch 1']);
  assert.equal(send(n, 0, 2, 'web').ok, true);
  assert.equal(send(n, 0, 2, 'file').ok, true);
});

test('every device that can hold policies filters: a router, switch, modem, server or PC on the way', () => {
  for (const type of ['router', 'switch', 'modem', 'server', 'pc']) {
    const n = net({ types: ['pc', type, 'pc'], links: [[0, 1], [1, 2]], ips: ['192.168.1.1', '', '192.168.1.2'], policies: { 1: ['blockPing'] } });
    const r = send(n, 0, 2);
    assert.equal(r.failure?.code, 'transit-blocked', type);
    assert.equal(r.failure.nodeId, n.ids[1], type);
  }
});

test('the first device the packet meets is the one that stops it', () => {
  const n = net({ types: ['pc', 'switch', 'router', 'pc'], links: [[0, 1], [1, 2], [2, 3]], ips: ['192.168.1.1', '', '', '192.168.1.2'], policies: { 1: ['blockPing'], 2: ['blockPing'] } });
  const r = send(n, 0, 3);
  assert.equal(r.failure.nodeId, n.ids[1]);
  assert.deepEqual(pathNames(n, r), ['PC 1', 'Switch 1']);
  const fixed = run(n.state, { type: 'togglePolicy', ids: [n.ids[1]], policy: 'blockPing', on: false });
  const next = traceRoute(fixed.doc, n.ids[0], n.ids[3], 'ping');
  assert.equal(next.failure.nodeId, n.ids[2], 'then the next one');
});

test('a middle device is checked before the receiver’s own firewall', () => {
  const n = net({ types: ['pc', 'router', 'pc'], links: [[0, 1], [1, 2]], ips: ['192.168.1.1', '', '192.168.1.2'], policies: { 1: ['blockPing'], 2: ['blockPing'] } });
  const r = send(n, 0, 2);
  assert.equal(r.failure.code, 'transit-blocked');
  assert.equal(r.failure.nodeId, n.ids[1]);
  const clear = run(n.state, { type: 'togglePolicy', ids: [n.ids[1]], policy: 'blockPing', on: false });
  assert.equal(traceRoute(clear.doc, n.ids[0], n.ids[2], 'ping').failure.code, 'receiver-blocked', 'with the router fixed, the receiver’s rule is next');
});

test('hubs and filters happen in the order the packet meets them', () => {
  // PC 1 - Hub 1 - Router 1 (Block ping) - PC 2: the hub copies it first, then the router drops it
  const afterHub = net({ types: ['pc', 'hub', 'router', 'pc', 'pc'], links: [[0, 1], [1, 2], [2, 3], [1, 4]], ips: ['192.168.1.1', '', '', '192.168.1.2', '192.168.1.3'], policies: { 2: ['blockPing'] } });
  const a = send(afterHub, 0, 3);
  assert.equal(a.failure.code, 'transit-blocked');
  assert.equal(a.broadcasts.length, 1, 'the hub had already copied it');
  assert.deepEqual(a.broadcasts[0].heard.map((id) => nameOf(afterHub, id)), ['PC 3']);
  assert.match(a.log[1].text, /Hub 1 repeats it out of every other port/);

  // PC 1 - Router 1 (Block ping) - Hub 1 - PC 2: the router drops it before it ever reaches the hub
  const beforeHub = net({ types: ['pc', 'router', 'hub', 'pc', 'pc'], links: [[0, 1], [1, 2], [2, 3], [2, 4]], ips: ['192.168.1.1', '', '', '192.168.1.2', '192.168.1.3'], policies: { 1: ['blockPing'] } });
  const b = send(beforeHub, 0, 3);
  assert.equal(b.failure.code, 'transit-blocked');
  assert.deepEqual(b.broadcasts, [], 'it never reached the hub, so nothing was copied');
});

test('a filter in front of a hub loop wins; a loop in front of a filter is a storm', () => {
  // Loop of three hubs on one side, and a router with Block ping on the other
  const types = ['pc', 'hub', 'hub', 'hub', 'router', 'pc'];
  const ring = [[1, 2], [2, 3], [3, 1]];
  const hubFirst = net({ types, links: [[0, 1], ...ring, [1, 4], [4, 5]], ips: ['192.168.1.1', '', '', '', '', '192.168.1.2'], policies: { 4: ['blockPing'] } });
  assert.equal(send(hubFirst, 0, 5).failure.code, 'broadcast-storm');
  const routerFirst = net({ types: ['pc', 'router', 'hub', 'hub', 'hub', 'pc'], links: [[0, 1], [1, 2], ...[[2, 3], [3, 4], [4, 2]], [2, 5]], ips: ['192.168.1.1', '', '', '', '', '192.168.1.2'], policies: { 1: ['blockPing'] } });
  assert.equal(send(routerFirst, 0, 5).failure.code, 'transit-blocked');
});

// PC 1 - middle device - PC 2, everyone on one network, the ends already permitted
const permitted = (middle, middlePolicies = []) => net({
  types: ['pc', middle, 'pc'], links: [[0, 1], [1, 2]], ips: ['192.168.1.1', '', '192.168.1.2'],
  policies: { 0: ['allowWeb', 'fileTransfer'], 1: middlePolicies, 2: ['allowWeb', 'fileTransfer'] },
});

test('a web request needs Allow web traffic on every device it passes through, not just the ends', () => {
  const n = permitted('router');
  const r = send(n, 0, 2, 'web');
  assert.equal(r.ok, false);
  assert.equal(r.failure.code, 'transit-policy');
  assert.equal(r.failure.title, 'Router 1 didn’t let it through');
  assert.match(r.failure.detail, /Allow web traffic is off for Router 1, so it won’t carry a web request on the way\. Every device a web request passes through needs it/);
  assert.equal(r.failure.fix, 'Turn on Allow web traffic for Router 1.');
  assert.deepEqual(pathNames(n, r), ['PC 1', 'Router 1'], 'it stops at the router');
  assert.equal(r.failure.nodeId, n.ids[1]);
  const fixed = run(n.state, { type: 'togglePolicy', ids: [n.ids[1]], policy: 'allowWeb', on: true });
  assert.equal(traceRoute(fixed.doc, n.ids[0], n.ids[2], 'web').ok, true);
});

test('a file transfer needs File transfer access on every device it passes through', () => {
  const n = permitted('switch');
  const r = send(n, 0, 2, 'file');
  assert.equal(r.failure.code, 'transit-policy');
  assert.equal(r.failure.fix, 'Turn on File transfer access for Switch 1.');
  const fixed = run(n.state, { type: 'togglePolicy', ids: [n.ids[1]], policy: 'fileTransfer', on: true });
  assert.equal(traceRoute(fixed.doc, n.ids[0], n.ids[2], 'file').ok, true);
});

test('each permission belongs to its own kind of packet, and a ping needs neither', () => {
  const n = permitted('router', ['allowWeb']);
  assert.equal(send(n, 0, 2, 'web').ok, true);
  assert.equal(send(n, 0, 2, 'file').failure.code, 'transit-policy', 'Allow web traffic doesn’t carry a file transfer');
  assert.equal(send(n, 0, 2, 'ping').ok, true, 'a ping needs no permission anywhere');
});

test('every device that can hold policies needs the permission: router, switch, modem, server and PC', () => {
  for (const type of ['router', 'switch', 'modem', 'server', 'pc']) {
    const n = permitted(type);
    assert.equal(send(n, 0, 2, 'web').failure?.code, 'transit-policy', type);
    assert.equal(send(n, 0, 2, 'web').failure.nodeId, n.ids[1], type);
  }
});

test('a hub can’t hold a policy, so it never needs one', () => {
  const n = permitted('hub');
  for (const kind of PACKET_ORDER) assert.equal(send(n, 0, 2, kind).ok, true, `${kind} crosses a hub`);
});

test('the permission is asked of every device on the way, and the first one without it stops the packet', () => {
  const n = net({ types: ['pc', 'switch', 'router', 'pc'], links: [[0, 1], [1, 2], [2, 3]], ips: ['192.168.1.1', '', '', '192.168.1.2'], policies: { 0: ['allowWeb'], 3: ['allowWeb'] } });
  assert.equal(send(n, 0, 3, 'web').failure.nodeId, n.ids[1], 'the switch first');
  const one = run(n.state, { type: 'togglePolicy', ids: [n.ids[1]], policy: 'allowWeb', on: true });
  assert.equal(traceRoute(one.doc, n.ids[0], n.ids[3], 'web').failure.nodeId, n.ids[2], 'then the router');
  const both = run(one, { type: 'togglePolicy', ids: [n.ids[2]], policy: 'allowWeb', on: true });
  assert.equal(traceRoute(both.doc, n.ids[0], n.ids[3], 'web').ok, true);
});

test('the order: the sender’s own policy, then the middle, then the receiver’s', () => {
  const noSender = net({ types: ['pc', 'router', 'pc'], links: [[0, 1], [1, 2]], ips: ['192.168.1.1', '', '192.168.1.2'] });
  assert.equal(send(noSender, 0, 2, 'web').failure.code, 'sender-policy');
  const senderOk = run(noSender.state, { type: 'togglePolicy', ids: [noSender.ids[0]], policy: 'allowWeb', on: true });
  assert.equal(traceRoute(senderOk.doc, noSender.ids[0], noSender.ids[2], 'web').failure.code, 'transit-policy', 'the router is asked before the receiver');
  const routerOk = run(senderOk, { type: 'togglePolicy', ids: [noSender.ids[1]], policy: 'allowWeb', on: true });
  assert.equal(traceRoute(routerOk.doc, noSender.ids[0], noSender.ids[2], 'web').failure.code, 'receiver-blocked');
});

test('a blocking rule is reported before a missing permission on the same device', () => {
  const across = net({ types: ['pc', 'router', 'pc'], links: [[0, 1], [1, 2]], ips: ['192.168.1.1', '', '10.0.0.5'], policies: { 0: ['allowWeb'], 1: ['restrictOutbound'], 2: ['allowWeb'] } });
  assert.equal(send(across, 0, 2, 'web').failure.code, 'transit-blocked', 'Restrict outbound traffic is reported, not the missing permission');
});

test('a hub sitting between devices that are permitted is still fine, and its copies don’t need permission', () => {
  // PC 1 - Hub 1 - Router 1 (permitted) - PC 2, plus a bystander PC 3 with no policies at all
  const n = net({ types: ['pc', 'hub', 'router', 'pc', 'pc'], links: [[0, 1], [1, 2], [2, 3], [1, 4]], ips: ['192.168.1.1', '', '', '192.168.1.2', '192.168.1.3'], policies: { 0: ['allowWeb'], 2: ['allowWeb'], 3: ['allowWeb'] } });
  const r = send(n, 0, 3, 'web');
  assert.equal(r.ok, true, r.summary);
  assert.deepEqual(r.broadcasts[0].heard.map((id) => nameOf(n, id)), ['PC 3'], 'the bystander only hears a copy and ignores it');
});

test('quality of service, encryption and access control still never stop a packet', () => {
  const n = permitted('router', ['allowWeb', 'fileTransfer', 'voip', 'limitP2P', 'throttleBulk', 'prioritizeStreaming', 'dataEncryption', 'encryptedSharing', 'endToEnd', 'encryptVoip', 'ssh', 'adminPrivilege', 'remoteDesktop']);
  for (const kind of PACKET_ORDER) assert.equal(send(n, 0, 2, kind).ok, true, kind);
});

test('a firewall drop does not make the packet take another route', () => {
  // PC 1 - Router 1 - PC 2 (short), and PC 1 - Switch 1 - Switch 2 - PC 2 (long)
  const n = net({ types: ['pc', 'pc', 'router', 'switch', 'switch'], links: [[0, 2], [2, 1], [0, 3], [3, 4], [4, 1]], ips: ['192.168.1.1', '192.168.1.2'], policies: { 2: ['blockPing'] } });
  const r = send(n, 0, 1);
  assert.equal(r.failure.code, 'transit-blocked', 'routing doesn’t know about firewall rules, so it still picks the router');
  const fixed = run(n.state, { type: 'removeEdge', id: n.doc.edges.find((e) => e.a === n.ids[2] || e.b === n.ids[2]).id });
  assert.equal(traceRoute(fixed.doc, n.ids[0], n.ids[1]).ok, true, 'cutting the router’s link is a routing change, and the other route is used');
});

test('the sender’s own checks still come first, then the route, then the middle', () => {
  const n = viaRouter('10.0.0.5', ['restrictOutbound']);
  const noAddress = run(n.state, { type: 'setIp', id: n.ids[0], ip: '' });
  assert.equal(traceRoute(noAddress.doc, n.ids[0], n.ids[2]).failure.code, 'no-address');
  const cut = run(n.state, { type: 'removeEdge', id: n.doc.edges[0].id });
  assert.equal(traceRoute(cut.doc, n.ids[0], n.ids[2]).failure.code, 'no-route');
  const wrongCable = run(n.state, { type: 'setCable', id: n.doc.edges[0].id, cable: 'straight' });
  assert.equal(traceRoute(wrongCable.doc, n.ids[0], n.ids[2]).failure.code, 'wrong-cable');
});

test('property: a delivered packet passed every device on the way, and a block in the middle is the first device that objects', () => {
  let seed = 424242;
  const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const TYPES = ['pc', 'pc', 'server', 'switch', 'router', 'modem', 'hub'];
  const POLICIES = ['blockPing', 'blockPing', 'blockUntrusted', 'restrictOutbound', 'allowWeb', 'fileTransfer', 'voip'];
  let delivered = 0, transit = 0;

  for (let round = 0; round < 2000; round += 1) {
    const count = 3 + Math.floor(rand() * 5);
    const types = Array.from({ length: count }, () => pick(TYPES));
    const links = [];
    for (let i = 0; i < count; i += 1) for (let j = i + 1; j < count; j += 1) if (rand() < 0.5) links.push([i, j]);
    const ips = types.map((t, i) => (t === 'hub' || rand() < 0.1 ? '' : rand() < 0.7 ? `192.168.1.${10 + i}` : `10.0.0.${10 + i}`));
    const policies = {};
    types.forEach((_, i) => { if (rand() < 0.5) policies[i] = [pick(POLICIES), pick(POLICIES)]; });
    const n = net({ types, links, ips, policies });
    const i = Math.floor(rand() * count);
    let j = Math.floor(rand() * count);
    if (j === i) j = (j + 1) % count;
    const kind = pick(PACKET_ORDER);
    const r = send(n, i, j, kind);
    const byId = new Map(n.doc.nodes.map((x) => [x.id, x]));
    const has = (id, p) => (n.doc.policies[id] ?? []).includes(p);

    // an independent statement of the three rules
    const objects = (id) => {
      const node = byId.get(id);
      if (node.type === 'hub') return false;
      const from = byId.get(n.ids[i]);
      const to = byId.get(n.ids[j]);
      const fromNet = networkOf(from.ip);
      const toNet = networkOf(to.ip);
      if (fromNet !== toNet && has(id, 'restrictOutbound')) return true;
      if (has(id, 'blockUntrusted') && fromNet !== (node.ip ? networkOf(node.ip) : toNet)) return true;
      if (kind === 'ping' && has(id, 'blockPing')) return true;
      return (kind === 'web' && !has(id, 'allowWeb')) || (kind === 'file' && !has(id, 'fileTransfer'));
    };

    if (r.ok) {
      delivered += 1;
      for (const id of r.path.slice(1, -1)) assert.equal(objects(id), false, `${byId.get(id).name} would have dropped it`);
    } else if (['transit-blocked', 'transit-policy'].includes(r.failure.code)) {
      transit += 1;
      const at = r.path.length - 1;
      assert.equal(r.path[at], r.failure.nodeId, 'the packet stops at the device that blocked it');
      assert.ok(at >= 1 && objects(r.failure.nodeId), 'and that device really does object');
      for (const id of r.path.slice(1, at)) assert.equal(objects(id), false, 'nothing before it objected');
    }
  }
  assert.ok(delivered > 30 && transit > 30, `both outcomes are exercised (${delivered} delivered, ${transit} blocked in the middle)`);
});

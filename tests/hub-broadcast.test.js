import test from 'node:test';
import assert from 'node:assert/strict';
import { traceRoute, PACKET_ORDER } from '../lib/packets.js';
import { requiredCable } from '../lib/cabling.js';
import { createState } from '../lib/networkReducer.js';
import { addNodes, run } from './helpers.js';

/** types in order; links [[i, j, cable?]] (the right cable unless given); ips per device. */
function net({ types, links = [], ips = [] }) {
  const { state, ids } = addNodes(createState(), types);
  let s = state;
  links.forEach(([i, j, cable]) => { s = run(s, { type: 'connect', a: ids[i], b: ids[j], cable: cable ?? requiredCable(types[i], types[j]) }); });
  ips.forEach((ip, i) => { if (ip) s = run(s, { type: 'setIp', id: ids[i], ip }); });
  return { doc: s.doc, ids, state: s };
}
const nameOf = (n, id) => n.doc.nodes.find((x) => x.id === id).name;
const send = (n, i, j, kind = 'ping') => traceRoute(n.doc, n.ids[i], n.ids[j], kind);

// PC 1, PC 2, PC 3 and a router on one hub (index 4)
const hubStar = () => net({ types: ['pc', 'pc', 'pc', 'router', 'hub'], links: [[0, 4], [1, 4], [2, 4], [3, 4]], ips: ['192.168.1.1', '192.168.1.2', '192.168.1.3', '192.168.1.4'] });

test('a hub copies the packet to every other device, and the ones it wasn’t for ignore it', () => {
  const n = hubStar();
  const r = send(n, 0, 1);
  assert.equal(r.ok, true);
  assert.deepEqual(r.path.map((id) => nameOf(n, id)), ['PC 1', 'Hub 1', 'PC 2']);
  assert.match(r.log[1].text, /^Hub 1 repeats it out of every other port, to PC 2, PC 3 and Router 1\.$/);
  assert.match(r.log[2].text, /^Heard by PC 3 and Router 1, which ignore it because it isn’t addressed to them\.$/);
  assert.match(r.log[3].text, /PC 2 receives it/);
  assert.equal(r.broadcasts.length, 1);
  assert.equal(r.broadcasts[0].hubId, n.ids[4]);
  assert.deepEqual(r.broadcasts[0].heard.map((id) => nameOf(n, id)), ['PC 3', 'Router 1']);
  assert.equal(r.broadcasts[0].edges.length, 3, 'copies went out of the three ports other than the one it came in on');
});

test('one bystander reads naturally, and no bystanders adds no line', () => {
  const one = net({ types: ['pc', 'pc', 'pc', 'hub'], links: [[0, 3], [1, 3], [2, 3]], ips: ['192.168.1.1', '192.168.1.2', '192.168.1.3'] });
  assert.match(send(one, 0, 1).log[2].text, /^Heard by PC 3, which ignores it because it isn’t addressed to it\.$/);
  const none = net({ types: ['pc', 'hub', 'pc'], links: [[0, 1], [1, 2]], ips: ['192.168.1.1', '', '192.168.1.2'] });
  const r = send(none, 0, 2);
  assert.ok(r.log.every((l) => l.ok));
  assert.ok(!r.log.some((l) => /Heard by/.test(l.text)), 'no bystanders, so no line about them');
  assert.deepEqual(r.broadcasts[0].heard, []);
});

test('hubs chained together form one segment: every device on every hub hears it', () => {
  // PC 1 - Hub 1 - Hub 2 - PC 2, with PC 3 on Hub 1 and PC 4 on Hub 2
  const n = net({ types: ['pc', 'hub', 'hub', 'pc', 'pc', 'pc'], links: [[0, 1], [1, 2], [2, 3], [1, 4], [2, 5]], ips: ['192.168.1.1', '', '', '192.168.1.2', '192.168.1.3', '192.168.1.4'] });
  const r = send(n, 0, 3);
  assert.equal(r.ok, true);
  assert.equal(r.broadcasts.length, 1, 'the second hub is part of the same flood, not a second one');
  assert.deepEqual(r.broadcasts[0].heard.map((id) => nameOf(n, id)).sort(), ['PC 3', 'PC 4']);
  assert.match(r.log[2].text, /^Heard by PC 3 and PC 4/);
  assert.match(r.log[3].text, /^Hub 2 repeats it out of every other port\.$/);
});

test('only hubs repeat blindly: a switch, a router or a PC is where a copy stops', () => {
  // PC 1 - Hub 1 - Switch 1 - PC 3, and PC 2 on the hub. The copy reaching the switch is not spread further.
  const n = net({ types: ['pc', 'pc', 'hub', 'switch', 'pc', 'pc'], links: [[0, 2], [1, 2], [2, 3], [3, 4], [3, 5]], ips: ['192.168.1.1', '192.168.1.2', '', '192.168.1.3', '192.168.1.4', '192.168.1.5'] });
  const r = send(n, 0, 4);
  assert.equal(r.ok, true);
  assert.deepEqual(r.broadcasts[0].heard.map((id) => nameOf(n, id)), ['PC 2'], 'PC 5 sits behind the switch and never hears it');
});

test('a switch still just passes the packet along, with no copies', () => {
  const n = net({ types: ['pc', 'switch', 'pc', 'pc'], links: [[0, 1], [1, 2], [1, 3]], ips: ['192.168.1.1', '192.168.1.2', '192.168.1.3', '192.168.1.4'] });
  const r = send(n, 0, 2);
  assert.equal(r.ok, true);
  assert.deepEqual(r.broadcasts, []);
  assert.ok(r.log.every((l) => l.ok));
  assert.match(r.log[1].text, /Switch 1 forwards it on/);
});

test('three hubs in a loop are a broadcast storm, and the result names the loop', () => {
  // PC 1 on Hub 1, PC 2 on Hub 2, and Hub 1 - Hub 2 - Hub 3 - Hub 1
  const n = net({ types: ['pc', 'pc', 'hub', 'hub', 'hub'], links: [[0, 2], [1, 3], [2, 3], [3, 4], [4, 2]], ips: ['192.168.1.1', '192.168.1.2'] });
  const r = send(n, 0, 1);
  assert.equal(r.ok, false);
  assert.equal(r.failure.code, 'broadcast-storm');
  assert.match(r.failure.title, /^Broadcast storm: Hub \d, Hub \d and Hub \d form a loop$/);
  for (const hub of ['Hub 1', 'Hub 2', 'Hub 3']) assert.ok(r.failure.title.includes(hub), `${hub} is named`);
  assert.equal(r.failure.loop.length, 3);
  assert.match(r.failure.detail, /can’t tell it has seen one before/);
  assert.match(r.failure.fix, /Remove one link in the loop, for example Hub \d to Hub \d/);
  assert.deepEqual(r.path.map((id) => nameOf(n, id)), ['PC 1', 'Hub 1'], 'the packet got as far as the first hub');
  assert.equal(r.failure.nodeId, n.ids[2]);
  const closing = n.doc.edges.find((e) => e.id === r.failure.edgeId);
  assert.ok(closing && [closing.a, closing.b].every((id) => r.failure.loop.includes(id)), 'the marked link is one of the loop’s own links');
  assert.equal(r.log[r.log.length - 1].ok, false);
  assert.deepEqual(r.broadcasts, []);
});

test('the suggested fix works: removing a link in the loop lets the packet through', () => {
  const n = net({ types: ['pc', 'pc', 'hub', 'hub', 'hub'], links: [[0, 2], [1, 3], [2, 3], [3, 4], [4, 2]], ips: ['192.168.1.1', '192.168.1.2'] });
  const r = send(n, 0, 1);
  const fixed = run(n.state, { type: 'removeEdge', id: r.failure.edgeId });
  const again = traceRoute(fixed.doc, n.ids[0], n.ids[1], 'ping');
  assert.equal(again.ok, true, again.summary);
});

test('a bigger loop of four hubs names all four', () => {
  const n = net({ types: ['pc', 'pc', 'hub', 'hub', 'hub', 'hub'], links: [[0, 2], [1, 4], [2, 3], [3, 4], [4, 5], [5, 2]], ips: ['192.168.1.1', '192.168.1.2'] });
  const r = send(n, 0, 1);
  assert.equal(r.failure.code, 'broadcast-storm');
  assert.equal(r.failure.loop.length, 4);
  assert.match(r.failure.title, /Hub \d, Hub \d, Hub \d and Hub \d form a loop/);
});

test('a link with the wrong cable is down, so it can’t close a loop', () => {
  const looped = net({ types: ['pc', 'pc', 'hub', 'hub', 'hub'], links: [[0, 2], [1, 3], [2, 3], [3, 4], [4, 2, 'straight']], ips: ['192.168.1.1', '192.168.1.2'] });
  const r = send(looped, 0, 1);
  assert.equal(r.ok, true, 'hub to hub needs a crossover, so the straight-through link carries nothing');
});

test('a loop the packet never enters does no harm', () => {
  // PC 1 and PC 2 are joined directly; a hub triangle sits elsewhere on the canvas.
  const n = net({ types: ['pc', 'pc', 'hub', 'hub', 'hub'], links: [[0, 1, 'crossover'], [2, 3], [3, 4], [4, 2]], ips: ['192.168.1.1', '192.168.1.2'] });
  assert.equal(send(n, 0, 1).ok, true);
});

test('a cycle that runs through a router, switch or PC is not a hub loop', () => {
  // Hub 1 and Hub 2 are linked, and both are also linked to a router: the copy stops at the router.
  const n = net({ types: ['pc', 'pc', 'hub', 'hub', 'router'], links: [[0, 2], [1, 3], [2, 3], [2, 4], [3, 4]], ips: ['192.168.1.1', '192.168.1.2', '', '', ''] });
  const r = send(n, 0, 1);
  assert.equal(r.ok, true, r.summary);
});

test('a storm is found no matter which kind of packet is sent, and before the receiver’s firewall', () => {
  const n = net({ types: ['pc', 'pc', 'hub', 'hub', 'hub'], links: [[0, 2], [1, 3], [2, 3], [3, 4], [4, 2]], ips: ['192.168.1.1', '192.168.1.2'] });
  let s = run(n.state, { type: 'togglePolicy', ids: [n.ids[0], n.ids[1]], policy: 'allowWeb', on: true }, { type: 'togglePolicy', ids: [n.ids[0], n.ids[1]], policy: 'fileTransfer', on: true }, { type: 'togglePolicy', ids: [n.ids[1]], policy: 'blockPing', on: true });
  for (const kind of PACKET_ORDER) assert.equal(traceRoute(s.doc, n.ids[0], n.ids[1], kind).failure.code, 'broadcast-storm', kind);
});

test('the sender’s own problems still come before the flood', () => {
  const n = net({ types: ['pc', 'pc', 'hub', 'hub', 'hub'], links: [[0, 2], [1, 3], [2, 3], [3, 4], [4, 2]], ips: ['192.168.1.1', ''] });
  assert.equal(send(n, 0, 1).failure.code, 'no-address');
  const web = net({ types: ['pc', 'pc', 'hub', 'hub', 'hub'], links: [[0, 2], [1, 3], [2, 3], [3, 4], [4, 2]], ips: ['192.168.1.1', '192.168.1.2'] });
  assert.equal(send(web, 0, 1, 'web').failure.code, 'sender-policy');
});

test('tracing with hubs never changes the network', () => {
  const n = hubStar();
  const before = JSON.stringify(n.doc);
  send(n, 0, 1); send(n, 1, 3, 'web');
  assert.equal(JSON.stringify(n.doc), before);
});

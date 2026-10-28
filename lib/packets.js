/**
 * Sending a packet across the network you built.
 *
 * `traceRoute` is a pure function of the document: it finds the route, checks every rule that could
 * stop the packet, and says exactly where and why it stopped. It never changes the document.
 *
 * What can stop a packet, in the order it is checked:
 *   1. the endpoints: two different, addressable devices (a hub has no address)
 *   2. addresses: both devices need an IP address
 *   3. the sender's firewall: Restrict outbound traffic (to another network), and the policy the
 *      packet type needs (Allow web traffic, File transfer access)
 *   4. the route: links must connect the devices, and every link on the way needs the right cable
 *   5. networks: devices on different networks only reach each other through a router
 *   6. the receiver's firewall: Block untrusted IP (from another network), Block ping requests,
 *      and the policy the packet type needs
 */

import { networkOf } from './ip.js';
import { cableLabel, explainCable, requiredCable } from './cabling.js';
import { joinList } from './format.js';

export const PACKET_KINDS = {
  ping: { id: 'ping', label: 'Ping', noun: 'ping', help: 'A quick “are you there?”. The receiver can ignore it with Block ping requests.' },
  web: { id: 'web', label: 'Web', noun: 'web request', help: 'A web request. Both devices need Allow web traffic.' },
  file: { id: 'file', label: 'File', noun: 'file transfer', help: 'A file transfer. Both devices need File transfer access.' },
};
export const PACKET_ORDER = ['ping', 'web', 'file'];

/** A hub only repeats signals and has no address, so it can't send or receive a packet. */
export const canBeEndpoint = (type) => type !== 'hub';

/* ---------- Route finding ---------- */

function buildGraph(doc) {
  const byId = new Map(doc.nodes.map((n) => [n.id, n]));
  const map = new Map(doc.nodes.map((n) => [n.id, []]));
  for (const e of doc.edges) {
    if (e.a === e.b || !byId.has(e.a) || !byId.has(e.b)) continue;
    map.get(e.a).push({ to: e.b, edge: e });
    map.get(e.b).push({ to: e.a, edge: e });
  }
  return { byId, map };
}

const cableWorks = (edge, byId) => (edge.cable ?? 'straight') === requiredCable(byId.get(edge.a).type, byId.get(edge.b).type);

/**
 * Shortest route from one device to another, as { nodes, edges }, or null.
 * `goodOnly` ignores links with the wrong cable. `needRouter` demands a router somewhere on the route
 * (a route may pass the same hub twice to reach a router and come back).
 * A route never runs through the sender again, and it ends the moment it reaches the receiver:
 * a packet can't use the device it is being delivered to as a stepping stone.
 */
function findPath(graph, from, to, { goodOnly = false, needRouter = false } = {}) {
  const { byId, map } = graph;
  const key = (id, flag) => `${id}|${flag ? 1 : 0}`;
  const startFlag = byId.get(from).type === 'router';
  const prev = new Map([[key(from, startFlag), null]]);
  const queue = [[from, startFlag]];

  while (queue.length) {
    const [id, flag] = queue.shift();
    if (id === to && (!needRouter || flag)) {
      const nodes = [id];
      const edges = [];
      let k = key(id, flag);
      while (prev.get(k)) {
        const step = prev.get(k);
        edges.unshift(step.edge);
        nodes.unshift(step.id);
        k = step.fromKey;
      }
      return { nodes, edges };
    }
    if (id === to) continue; // arrived (without a router, when one was needed): can't carry on through it
    for (const { to: next, edge } of map.get(id)) {
      if (next === from) continue;
      if (goodOnly && !cableWorks(edge, byId)) continue;
      const nextFlag = flag || byId.get(next).type === 'router';
      const nextKey = key(next, nextFlag);
      if (prev.has(nextKey)) continue;
      prev.set(nextKey, { id, edge, fromKey: key(id, flag) });
      queue.push([next, nextFlag]);
    }
  }
  return null;
}

function reachableFrom(graph, from) {
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length) {
    const id = queue.shift();
    for (const { to } of graph.map.get(id)) {
      if (!seen.has(to)) {
        seen.add(to);
        queue.push(to);
      }
    }
  }
  seen.delete(from);
  return [...seen].map((id) => graph.byId.get(id));
}

/* ---------- The trace ---------- */

const hasPolicy = (doc, id, policy) => (doc.policies[id] ?? []).includes(policy);

function describePath(nodes, byId, cross, noun, to) {
  const lines = [{ ok: true, text: `${byId.get(nodes[0]).name} sends a ${noun} to ${to.ip}.` }];
  for (let i = 1; i < nodes.length - 1; i += 1) {
    const n = byId.get(nodes[i]);
    const text =
      n.type === 'hub' ? `${n.name} repeats it to every device on its ports.`
      : n.type === 'router' ? `${n.name} routes it${cross ? ' across to the other network' : ' onward'}.`
      : `${n.name} passes it on.`;
    lines.push({ ok: true, text });
  }
  return lines;
}

/**
 * Sends a packet from one device to another.
 * Returns { ok, kind, fromId, toId, path, failure, log, summary }.
 *  - `path` is the devices the packet reached, in order (it ends where the packet stopped)
 *  - `failure` is null when delivered, otherwise { code, title, detail, fix, nodeId, edgeId }
 *  - `log` is a line per hop, ending in the line that says what happened
 */
export function traceRoute(doc, fromId, toId, kind = 'ping') {
  const graph = buildGraph(doc);
  const { byId } = graph;
  const from = byId.get(fromId);
  const to = byId.get(toId);
  const spec = PACKET_KINDS[kind] ?? PACKET_KINDS.ping;
  const base = { kind: spec.id, fromId, toId };

  const stop = (path, failure, lines = []) => ({
    ok: false,
    ...base,
    path,
    failure,
    log: [...lines, { ok: false, text: failure.title }],
    summary: failure.title,
  });
  const atSource = (failure) => stop([fromId], { nodeId: fromId, edgeId: null, ...failure }, [
    { ok: true, text: `${from.name} tries to send a ${spec.noun}${to?.ip ? ` to ${to.ip}` : ''}.` },
  ]);

  /* 1. The endpoints */
  if (!from || !to) {
    return stop(from ? [fromId] : [], { code: 'missing', title: 'Choose two devices', detail: 'The packet needs a sender and a receiver that are both on the canvas.', fix: 'Pick a device in each list.', nodeId: null, edgeId: null });
  }
  if (fromId === toId) {
    return atSource({ code: 'same-device', title: 'Pick two different devices', detail: 'A device can’t send a packet to itself across the network.', fix: 'Choose a different receiver.' });
  }
  const hub = [from, to].find((n) => !canBeEndpoint(n.type));
  if (hub) {
    return atSource({ code: 'bad-endpoint', title: 'A hub can’t send or receive', detail: `${hub.name} only repeats signals and has no address, so it can’t be the sender or the receiver of a packet.`, fix: 'Choose a PC, server, router or modem.' });
  }

  /* 2. Addresses */
  const unaddressed = [from, to].filter((n) => !n.ip);
  if (unaddressed.length) {
    const names = joinList(unaddressed.map((n) => n.name), 3);
    return atSource({
      code: 'no-address',
      title: `${names} ${unaddressed.length === 1 ? 'has' : 'have'} no IP address`,
      detail: `A packet is addressed to an IP address, and ${names} ${unaddressed.length === 1 ? 'doesn’t' : 'don’t'} have one yet.`,
      fix: 'Give each device an address in the inspector, or use the lightning button to assign addresses by class.',
    });
  }

  const fromNet = networkOf(from.ip);
  const toNet = networkOf(to.ip);
  const cross = fromNet !== toNet;

  /* 3. The sender's firewall */
  if (cross && hasPolicy(doc, from.id, 'restrictOutbound')) {
    return atSource({
      code: 'outbound-blocked',
      title: `${from.name}’s firewall blocked it`,
      detail: `Restrict outbound traffic is on for ${from.name}, so it can’t send to another network. ${from.name} is on ${fromNet} and ${to.name} is on ${toNet}.`,
      fix: `Turn Restrict outbound traffic off for ${from.name}, or send to a device on ${fromNet}.`,
    });
  }
  const needs = { web: ['allowWeb', 'Allow web traffic'], file: ['fileTransfer', 'File transfer access'] }[spec.id];
  if (needs && !hasPolicy(doc, from.id, needs[0])) {
    return atSource({
      code: 'sender-policy',
      title: `${from.name} isn’t set up for it`,
      detail: `${needs[1]} is off for ${from.name}, so it won’t send a ${spec.noun}.`,
      fix: `Turn on ${needs[1]} for ${from.name}.`,
    });
  }

  /* 4 and 5. The route, the cables and the networks */
  let route = findPath(graph, fromId, toId, { goodOnly: true, needRouter: cross });
  if (!route) {
    const anyRoute = findPath(graph, fromId, toId);
    if (!anyRoute) {
      const reachable = reachableFrom(graph, fromId);
      return atSource({
        code: 'no-route',
        title: 'No route to the receiver',
        detail: `${from.name} and ${to.name} aren’t joined by any links. ${from.name} can reach ${reachable.length ? joinList(reachable.map((n) => n.name), 4) : 'nothing yet'}.`,
        fix: 'Link the devices, directly or through hubs and routers.',
      });
    }
    // Crossing networks, the route that matters is the one through a router.
    const diagnosed = cross ? findPath(graph, fromId, toId, { needRouter: true }) : anyRoute;
    if (!diagnosed) {
      return atSource({
        code: 'no-router',
        title: 'Different networks, and no router between them',
        detail: `${from.name} is on ${fromNet} and ${to.name} is on ${toNet}. A packet only crosses from one network to another through a router, and no router sits on the way.`,
        fix: 'Give both devices addresses on the same network, or link them through a router.',
      });
    }
    // A route exists, but only over a link with the wrong cable.
    const wrongEdges = diagnosed.edges.filter((e) => !cableWorks(e, byId));
    const bad = wrongEdges[0];
    const index = diagnosed.edges.indexOf(bad);
    const a = byId.get(bad.a);
    const b = byId.get(bad.b);
    const stopAt = byId.get(diagnosed.nodes[index]);
    const reached = diagnosed.nodes.slice(0, index + 1);
    const lines = describePath(reached, byId, cross, spec.noun, to);
    return stop(reached, {
      code: 'wrong-cable',
      title: `A link isn’t working: ${a.name} to ${b.name}`,
      detail: `That link uses a ${cableLabel(bad.cable ?? 'straight').toLowerCase()} cable, and it needs a ${cableLabel(requiredCable(a.type, b.type)).toLowerCase()} one. ${explainCable(a.type, b.type)} ${index === 0 ? `The packet couldn’t leave ${stopAt.name}.` : `The packet stopped at ${stopAt.name}.`}`,
      fix: 'Select the link and change its cable.',
      nodeId: stopAt.id,
      edgeId: bad.id,
    }, lines);
  }

  /* 6. The receiver's firewall */
  const dropped = (code, title, detail, fix) =>
    stop(route.nodes, { code, title, detail, fix, nodeId: toId, edgeId: null }, describePath(route.nodes, byId, cross, spec.noun, to));

  if (cross && hasPolicy(doc, to.id, 'blockUntrusted')) {
    return dropped('receiver-blocked', `${to.name}’s firewall dropped it`,
      `Block untrusted IP is on for ${to.name}, and ${from.ip} isn’t on ${to.name}’s network (${toNet}), so the packet was dropped on arrival.`,
      `Turn Block untrusted IP off for ${to.name}, or send from a device on ${toNet}.`);
  }
  if (spec.id === 'ping' && hasPolicy(doc, to.id, 'blockPing')) {
    return dropped('receiver-blocked', `${to.name} ignored the ping`,
      `Block ping requests is on for ${to.name}, so it doesn’t answer pings.`,
      `Turn Block ping requests off for ${to.name} to see it answer.`);
  }
  if (needs && !hasPolicy(doc, to.id, needs[0])) {
    return dropped('receiver-blocked', `${to.name} didn’t accept it`,
      `${needs[1]} is off for ${to.name}, so it doesn’t accept a ${spec.noun}.`,
      `Turn on ${needs[1]} for ${to.name}.`);
  }

  /* Delivered */
  const hops = route.nodes.length - 1;
  const lines = describePath(route.nodes, byId, cross, spec.noun, to);
  lines.push({ ok: true, text: `${to.name} receives it.` });
  return {
    ok: true,
    ...base,
    path: route.nodes,
    failure: null,
    log: lines,
    summary: `Delivered in ${hops} ${hops === 1 ? 'hop' : 'hops'}`,
  };
}

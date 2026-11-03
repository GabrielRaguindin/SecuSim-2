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
 *   8. a ping is answered: the receiver sends a reply back the way the request came. The reply meets
 *      the same devices again, with the rules that apply to a reply (see `walkRoute`)
 *   5b. the devices on the way, in the order the packet meets them:
 *      - a hub copies the packet out of every other port. If those copies reach a hub they have
 *        already reached, the packet is stuck in a loop: a broadcast storm
 *      - any other device can drop it: with a blocking rule of its own (Restrict outbound traffic,
 *        Block untrusted IP, Block ping requests), or because it hasn't been given the permission
 *        the packet needs (Allow web traffic, File transfer access). Every device on the route
 *        filters, not only the ends. Hubs can't hold policies, so they never do.
 *   6. the receiver's firewall: Block untrusted IP (from another network), Block ping requests,
 *      and the policy the packet type needs
 */

import { networkOf } from './ip.js';
import { cableLabel, explainCable, requiredCable } from './cabling.js';
import { canHaveIp, canHavePolicies } from './devices.js';
import { joinList } from './format.js';

export const PACKET_KINDS = {
  ping: { id: 'ping', label: 'Ping', noun: 'ping', help: 'A quick “are you there?”. The receiver answers, and the ping only counts once the answer is back. Any device on the way can drop the request with Block ping requests.' },
  web: { id: 'web', label: 'Web', noun: 'web request', help: 'A web request. Every device it passes through needs Allow web traffic, hubs aside.' },
  file: { id: 'file', label: 'File', noun: 'file transfer', help: 'A file transfer. Every device it passes through needs File transfer access, hubs aside.' },
};
export const PACKET_ORDER = ['ping', 'web', 'file'];

/** A hub works at Layer 1: it only repeats signals and has no address, so it can't send or receive a packet. */
export const canBeEndpoint = (type) => canHaveIp(type);

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

/* ---------- Hubs repeat everything ---------- */

/**
 * What a hub does with a packet it receives: it copies it out of every other port. Copies keep
 * spreading through further hubs, and stop at any other device, because only a hub repeats blindly.
 * Only links with the right cable carry a copy.
 *
 * `entryId` is the first hub the packet reaches and `receivedFrom` the device it came from.
 * Returns { hubs, copies: [{ from, to, edge }], heard, storm }:
 *  - `hubs`: every hub the copies reached, `heard`: every other device that got a copy
 *  - `storm` is null, or { at, meets, edge, cycle } when a copy reached a hub that already had one.
 *    `cycle` lists the hubs around the loop.
 */
function spread(graph, entryId, receivedFrom) {
  const { byId, map } = graph;
  const parent = new Map([[entryId, receivedFrom]]);
  const hubs = [entryId];
  const copies = [];
  const heard = new Set();
  const queue = [entryId];

  const chain = (id) => {
    const list = [id];
    while (parent.has(list[list.length - 1]) && byId.get(parent.get(list[list.length - 1]))?.type === 'hub') {
      list.push(parent.get(list[list.length - 1]));
    }
    return list;
  };

  while (queue.length) {
    const id = queue.shift();
    for (const { to, edge } of map.get(id)) {
      if (to === parent.get(id)) continue; // the port it came in on
      if (!cableWorks(edge, byId)) continue; // a link with the wrong cable is down
      if (byId.get(to).type !== 'hub') {
        heard.add(to);
        copies.push({ from: id, to, edge: edge.id });
        continue;
      }
      if (parent.has(to)) {
        const up = chain(id);
        const other = chain(to);
        const join = up.find((h) => other.includes(h));
        const cycle = [...up.slice(0, up.indexOf(join) + 1), ...other.slice(0, other.indexOf(join)).reverse()];
        return { hubs, copies, heard: [...heard], storm: { at: id, meets: to, edge, cycle } };
      }
      parent.set(to, id);
      hubs.push(to);
      copies.push({ from: id, to, edge: edge.id });
      queue.push(to);
    }
  }
  return { hubs, copies, heard: [...heard], storm: null };
}

/** "PC 3", "PC 3 and Router 1": who ignored a copy that wasn't addressed to them. */
function bystanderLine(names) {
  const many = names.length > 1;
  return `Heard by ${joinList(names, 5)}, which ${many ? 'ignore it because it isn’t' : 'ignores it because it isn’t'} addressed to ${many ? 'them' : 'it'}.`;
}

/* The permission each packet type needs, switched on at the sender, the receiver and every device on the way. */
const NEEDS = { web: ['allowWeb', 'Allow web traffic'], file: ['fileTransfer', 'File transfer access'] };

/* ---------- Devices on the way can filter too ---------- */

/**
 * Whether a device the packet passes through drops it. Two kinds of rule do this:
 *
 *  blocking rules, when they are on:
 *  - Restrict outbound traffic: won't forward a packet to another network
 *  - Block untrusted IP: drops a packet from outside the network it guards. That is the device's own
 *    network when it has an address, and otherwise the network the packet is heading for
 *  - Block ping requests: drops pings
 *
 *  permissions, which must be on: a web request needs Allow web traffic and a file transfer needs
 *  File transfer access on every device it passes through. A device that hasn't been given the
 *  permission won't carry that kind of packet (default deny).
 *
 * Returns a failure ({ code, title, detail, fix }) or null. A hub never gets here: it has no policies.
 */
function transitBlock(doc, node, { from, fromNet, toNet, cross, kind, noun }) {
  if (!canHavePolicies(node.type)) return null;
  const reply = kind === 'reply';
  const has = (policy) => (doc.policies[node.id] ?? []).includes(policy);
  if (cross && has('restrictOutbound')) {
    return {
      code: 'transit-blocked',
      title: `${node.name}’s firewall blocked it`,
      detail: `Restrict outbound traffic is on for ${node.name}, so it won’t forward ${reply ? 'the reply' : 'a packet'} to another network. ${reply ? 'The reply is' : 'This one is'} going from ${fromNet} to ${toNet}.`,
      fix: reply ? `Turn Restrict outbound traffic off for ${node.name}.` : `Turn Restrict outbound traffic off for ${node.name}, or send to a device on ${fromNet}.`,
    };
  }
  if (has('blockUntrusted')) {
    const trusted = node.ip ? networkOf(node.ip) : toNet;
    if (fromNet !== trusted) {
      return {
        code: 'transit-blocked',
        title: `${node.name}’s firewall dropped it`,
        detail: node.ip
          ? `Block untrusted IP is on for ${node.name}, and ${from.ip} isn’t on ${node.name}’s network (${trusted}), so it dropped the packet on the way through.`
          : `Block untrusted IP is on for ${node.name}. It has no address of its own, so it guards the network the packet is heading for (${trusted}), and ${from.ip} isn’t on it.`,
        fix: reply ? `Turn Block untrusted IP off for ${node.name}, or ping a device on ${trusted}.` : `Turn Block untrusted IP off for ${node.name}, or send from a device on ${trusted}.`,
      };
    }
  }
  if (kind === 'ping' && has('blockPing')) {
    return {
      code: 'transit-blocked',
      title: `${node.name} dropped the ping`,
      detail: `Block ping requests is on for ${node.name}, so a ping can’t get through it on the way.`,
      fix: `Turn Block ping requests off for ${node.name}.`,
    };
  }
  const need = NEEDS[kind];
  if (need && !has(need[0])) {
    return {
      code: 'transit-policy',
      title: `${node.name} didn’t let it through`,
      detail: `${need[1]} is off for ${node.name}, so it won’t carry a ${noun} on the way. Every device a ${noun} passes through needs it, not just the two ends.`,
      fix: `Turn on ${need[1]} for ${node.name}.`,
    };
  }
  return null;
}

/**
 * Walks a route and meets the devices on the way, in order: a hub copies the packet out of every
 * other port, and any other device can drop it. Returns { floods, broadcasts, stop }, where `stop` is
 * null or { reached, failure }: the part of the route the packet got along, and why it stopped.
 */
function walkRoute(doc, graph, nodes, ctx) {
  const { byId } = graph;
  const floods = new Map();
  const flooded = new Set();
  const onRoute = new Set(nodes);
  let broadcasts = [];

  for (let i = 1; i < nodes.length - 1; i += 1) {
    const hub = byId.get(nodes[i]);
    if (hub.type !== 'hub') {
      // A router, switch, modem, PC or server on the way can drop the packet with its own firewall rules.
      const block = transitBlock(doc, hub, ctx);
      if (block) return { floods, broadcasts, stop: { reached: nodes.slice(0, i + 1), failure: { ...block, nodeId: hub.id, edgeId: null } } };
      continue;
    }
    if (flooded.has(hub.id)) continue;
    const result = spread(graph, hub.id, nodes[i - 1]);
    if (result.storm) {
      const { at, meets, edge, cycle } = result.storm;
      const loop = cycle.map((id) => byId.get(id).name);
      return {
        floods,
        broadcasts,
        stop: {
          reached: nodes.slice(0, i + 1),
          failure: {
            code: 'broadcast-storm',
            title: `Broadcast storm: ${joinList(loop, 6)} form a loop`,
            detail: `${byId.get(at).name} sent a copy to ${byId.get(meets).name}, which already had one. A hub repeats every packet out of all its other ports and can’t tell it has seen one before, so the copies would circle ${joinList(loop, 6)} forever and flood the network.`,
            fix: `Remove one link in the loop, for example ${byId.get(at).name} to ${byId.get(meets).name}.`,
            nodeId: hub.id,
            edgeId: edge.id,
            loop: cycle,
          },
        },
      };
    }
    result.hubs.forEach((id) => flooded.add(id));
    const heard = result.heard.filter((id) => !onRoute.has(id));
    floods.set(hub.id, {
      reached: result.heard.map((id) => byId.get(id).name),
      bystanders: heard.map((id) => byId.get(id).name),
    });
    broadcasts = [...broadcasts, { hubId: hub.id, edges: result.copies.map((c) => c.edge), heard }];
  }
  return { floods, broadcasts, stop: null };
}

/* ---------- The trace ---------- */

const hasPolicy = (doc, id, policy) => (doc.policies[id] ?? []).includes(policy);

function describePath(nodes, byId, cross, noun, to, floods = new Map()) {
  const lines = [{ ok: true, text: `${byId.get(nodes[0]).name} sends a ${noun} to ${to.ip}.` }];
  for (let i = 1; i < nodes.length - 1; i += 1) {
    const n = byId.get(nodes[i]);
    const flood = floods.get(n.id);
    const text =
      n.type === 'hub' ? `${n.name} repeats it out of every other port${flood && flood.reached.length ? `, to ${joinList(flood.reached, 5)}` : ''}.`
      : n.type === 'switch' ? `${n.name} forwards it on.`
      : n.type === 'router' ? `${n.name} routes it${cross ? ' across to the other network' : ' onward'}.`
      : `${n.name} passes it on.`;
    lines.push({ ok: true, text });
    if (flood && flood.bystanders.length) lines.push({ ok: true, text: bystanderLine(flood.bystanders) });
  }
  return lines;
}

/**
 * Sends a packet from one device to another.
 * Returns { ok, status, kind, fromId, toId, path, failure, log, summary, broadcasts, reply }.
 *  - `status` is 'answered' (a ping whose reply came back), 'delivered' (any other packet that arrived),
 *    'unanswered' (a ping that arrived but whose reply was stopped) or 'blocked' (it never arrived)
 *  - `path` is always the way the request went. For a ping, `reply` is { path, ok, broadcasts }: the way the
 *    reply went back, ending where it stopped when it didn't make it (null for other packets, and for a
 *    ping that never arrived)
 *  - `path` is the devices the packet reached, in order (it ends where the packet stopped)
 *  - `failure` is null when delivered, otherwise { code, title, detail, fix, nodeId, edgeId }
 *  - `log` is a line per hop, ending in the line that says what happened
 *  - `broadcasts` is one entry per hub segment the packet crossed: { hubId, edges, heard }, where
 *    `edges` are the links that carried a copy and `heard` the devices off the route that got one
 *    (a storm failure also carries `failure.loop`, the hubs around the loop)
 */
export function traceRoute(doc, fromId, toId, kind = 'ping') {
  const graph = buildGraph(doc);
  const { byId } = graph;
  const from = byId.get(fromId);
  const to = byId.get(toId);
  const spec = PACKET_KINDS[kind] ?? PACKET_KINDS.ping;
  const base = { kind: spec.id, fromId, toId };
  let broadcasts = [];

  const stop = (path, failure, lines = []) => ({
    ok: false,
    status: 'blocked',
    ...base,
    path,
    failure,
    log: [...lines, { ok: false, text: failure.title }],
    summary: failure.title,
    broadcasts,
    reply: null,
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
    return atSource({ code: 'bad-endpoint', title: 'A hub can’t send or receive', detail: `${hub.name} works at Layer 1: it only repeats signals and has no address, so it can’t be the sender or the receiver of a packet.`, fix: 'Choose a PC, server, router or modem.' });
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
  const needs = NEEDS[spec.id];
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
        fix: 'Link the devices, directly or through hubs, switches and routers.',
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

  /* 5b. The devices on the way, in the order the packet meets them */
  const walked = walkRoute(doc, graph, route.nodes, { from, fromNet, toNet, cross, kind: spec.id, noun: spec.noun });
  broadcasts = walked.broadcasts;
  if (walked.stop) {
    const { reached, failure } = walked.stop;
    return stop(reached, failure, describePath(reached, byId, cross, spec.noun, to, walked.floods));
  }
  const floods = walked.floods;

  /* 6. The receiver's firewall */
  const dropped = (code, title, detail, fix) =>
    stop(route.nodes, { code, title, detail, fix, nodeId: toId, edgeId: null }, describePath(route.nodes, byId, cross, spec.noun, to, floods));

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
  const lines = describePath(route.nodes, byId, cross, spec.noun, to, floods);
  lines.push({ ok: true, text: `${to.name} receives it.` });
  if (spec.id !== 'ping') {
    return {
      ok: true,
      status: 'delivered',
      ...base,
      path: route.nodes,
      failure: null,
      log: lines,
      summary: `Delivered in ${hops} ${hops === 1 ? 'hop' : 'hops'}`,
      broadcasts,
      reply: null,
    };
  }

  /* 8. A ping is answered: the receiver sends a reply back, the way the request came */
  const back = [...route.nodes].reverse();
  const replyNoun = 'ping reply';
  const unanswered = (reached, failure, replyFloods, replyBroadcasts) => ({
    ok: false,
    status: 'unanswered',
    ...base,
    path: route.nodes,
    failure: { ...failure, reply: true },
    log: [...lines, ...describePath(reached, byId, cross, replyNoun, from, replyFloods), { ok: false, text: failure.title }],
    summary: failure.title,
    broadcasts,
    reply: { path: reached, ok: false, broadcasts: replyBroadcasts },
  });
  const arrived = `The ping reached ${to.name}, but the reply didn’t make it back.`;

  // The receiver's own firewall: Restrict outbound traffic stops it sending an answer to another network.
  if (cross && hasPolicy(doc, to.id, 'restrictOutbound')) {
    return unanswered([to.id], {
      code: 'reply-blocked',
      title: `${to.name}’s firewall blocked the reply`,
      detail: `${arrived} Restrict outbound traffic is on for ${to.name}, so it can’t send the reply to another network. ${to.name} is on ${toNet} and ${from.name} is on ${fromNet}.`,
      fix: `Turn Restrict outbound traffic off for ${to.name}.`,
      nodeId: to.id,
      edgeId: null,
    }, new Map(), []);
  }

  // The devices on the way back. A hub copies the reply too, and any other device can drop it.
  const returned = walkRoute(doc, graph, back, { from: to, fromNet: toNet, toNet: fromNet, cross, kind: 'reply', noun: replyNoun });
  if (returned.stop) {
    const { reached, failure } = returned.stop;
    const blocked = failure.code === 'broadcast-storm' ? failure : { ...failure, code: 'reply-blocked', title: `The reply was blocked at ${byId.get(failure.nodeId).name}`, detail: `${arrived} ${failure.detail}` };
    return unanswered(reached, blocked, returned.floods, returned.broadcasts);
  }

  // And the original sender's firewall: Block untrusted IP drops a reply from another network.
  if (cross && hasPolicy(doc, from.id, 'blockUntrusted')) {
    return unanswered(back, {
      code: 'reply-blocked',
      title: `${from.name}’s firewall dropped the reply`,
      detail: `${arrived} Block untrusted IP is on for ${from.name}, and ${to.ip} isn’t on ${from.name}’s network (${fromNet}), so the reply was dropped on arrival.`,
      fix: `Turn Block untrusted IP off for ${from.name}, or ping a device on ${fromNet}.`,
      nodeId: from.id,
      edgeId: null,
    }, returned.floods, returned.broadcasts);
  }

  const answer = [...lines, ...describePath(back, byId, cross, replyNoun, from, returned.floods), { ok: true, text: `${from.name} receives the reply.` }];
  return {
    ok: true,
    status: 'answered',
    ...base,
    path: route.nodes,
    failure: null,
    log: answer,
    summary: `Answered in ${hops} ${hops === 1 ? 'hop' : 'hops'} each way`,
    broadcasts,
    reply: { path: back, ok: true, broadcasts: returned.broadcasts },
  };
}

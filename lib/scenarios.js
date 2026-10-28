/**
 * Scenario definitions and the checks that grade a network.
 *
 * Every check is a pure function of the document, so it can be unit tested without a browser.
 * A check returns { ok, detail }. `detail` always says what to do next when `ok` is false.
 */

import { adjacency, countByType, isConnected } from './network.js';
import { deviceCountText, deviceTypesText, DEVICE_TYPES } from './devices.js';
import { joinList } from './format.js';
import { policyLabel } from './policies.js';

const pass = (detail) => ({ ok: true, detail });
const fail = (detail) => ({ ok: false, detail });
const PLACE_FIRST = 'Place some devices first.';

function context(doc) {
  const adj = adjacency(doc.nodes, doc.edges);
  const byId = new Map(doc.nodes.map((n) => [n.id, n]));
  return {
    nodes: doc.nodes,
    edges: doc.edges,
    adj,
    byId,
    degree: (n) => adj.get(n.id)?.size ?? 0,
    ofType: (...types) => doc.nodes.filter((n) => types.includes(n.type)),
    has: (n, policy) => (doc.policies[n.id] ?? []).includes(policy),
  };
}

const names = (nodes, max = 3) => joinList(nodes.map((n) => n.name), max);

/** "3 PCs, 2 hubs and 1 router", always in the same order so "needs" and "have" line up. */
function countsText(counts, order) {
  const parts = order
    .filter((type) => (counts[type] ?? 0) > 0)
    .map((type) => deviceCountText(type, counts[type]));
  return parts.length ? joinList(parts, 6) : 'none yet';
}

/* ---------- Reusable checks ---------- */

export const checks = {
  counts: (required) => (c) => {
    const have = countByType(c.nodes);
    const order = [...new Set([...Object.keys(required), ...Object.keys(have)])];
    const ok = order.every((t) => (have[t] ?? 0) === (required[t] ?? 0));
    if (ok) return pass(`Placed ${countsText(required, order)}.`);
    return fail(`Needs ${countsText(required, order)}. You have ${countsText(have, order)}.`);
  },

  ips: () => (c) => {
    if (c.nodes.length === 0) return fail(PLACE_FIRST);
    const missing = c.nodes.filter((n) => !n.ip);
    if (missing.length) {
      return fail(`${names(missing)} still ${missing.length === 1 ? 'needs' : 'need'} an IP address.`);
    }
    const counts = new Map();
    for (const n of c.nodes) counts.set(n.ip, [...(counts.get(n.ip) ?? []), n]);
    const dupe = [...counts.values()].find((list) => list.length > 1);
    if (dupe) return fail(`${names(dupe)} share the address ${dupe[0].ip}. Each device needs its own.`);
    return pass(`All ${c.nodes.length} devices have their own address.`);
  },

  ring: () => (c) => {
    const n = c.nodes.length;
    if (n < 3) return fail('Place at least three devices, then link them in a loop.');
    if (c.edges.length === 0) return fail('No links yet. Link each device to the next to form a loop.');
    const off = c.nodes.filter((x) => c.degree(x) !== 2);
    if (off.length) return fail(`In a ring every device has exactly two links. Check ${names(off)}.`);
    if (!isConnected(c.nodes, c.edges)) return fail('The links form separate loops. Join them into one ring.');
    return pass(`All ${n} devices form a single ring.`);
  },

  star: (centerType) => (c) => {
    const noun = DEVICE_TYPES[centerType].noun;
    const centers = c.ofType(centerType);
    if (centers.length !== 1) return fail(`A star needs exactly one ${noun} at its center.`);
    const center = centers[0];
    const others = c.nodes.filter((n) => n !== center);
    if (others.length === 0) return fail(`Place the other devices around the ${noun}.`);
    const unlinked = others.filter((o) => !c.adj.get(center.id).has(o.id));
    if (unlinked.length) return fail(`${center.name} isn’t linked to ${names(unlinked)} yet.`);
    const bypass = c.edges.filter((e) => e.a !== center.id && e.b !== center.id);
    if (bypass.length) {
      const e = bypass[0];
      const more = bypass.length > 1 ? ` and ${bypass.length - 1} more` : '';
      return fail(`Remove links that skip the ${noun}: ${c.byId.get(e.a).name} to ${c.byId.get(e.b).name}${more}.`);
    }
    return pass(`${center.name} sits at the center, linked to all ${others.length} other devices.`);
  },

  mesh: () => (c) => {
    const n = c.nodes.length;
    if (n < 2) return fail('Place the devices, then link every one to every other.');
    const missing = [];
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        if (!c.adj.get(c.nodes[i].id).has(c.nodes[j].id)) missing.push([c.nodes[i], c.nodes[j]]);
      }
    }
    if (missing.length) {
      const [a, b] = missing[0];
      return fail(`${missing.length} ${missing.length === 1 ? 'link is' : 'links are'} missing, for example ${a.name} to ${b.name}.`);
    }
    return pass(`Every device links to every other (${(n * (n - 1)) / 2} links).`);
  },

  /** Every device can reach every other device, by any route. */
  connected: () => (c) => {
    const n = c.nodes.length;
    if (n < 2) return fail('Place the devices, then link them so they can all reach each other.');
    const seen = new Set([c.nodes[0].id]);
    const queue = [c.nodes[0].id];
    while (queue.length) {
      const current = queue.shift();
      for (const next of c.adj.get(current)) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    const lost = c.nodes.filter((x) => !seen.has(x.id));
    if (lost.length) return fail(`${names(lost)} can’t reach the rest of the network yet. Link ${lost.length === 1 ? 'it' : 'them'} in.`);
    return pass(`All ${n} devices can reach each other.`);
  },

  /** Every device of the given types has the policy turned off. */
  offOnTypes: (policy, types) => (c) => {
    if (c.nodes.length === 0) return fail(PLACE_FIRST);
    const bad = c.ofType(...types).filter((n) => c.has(n, policy));
    if (bad.length) return fail(`Turn ${policyLabel(policy)} off for ${names(bad)}.`);
    return pass(`Off for ${deviceTypesText(types)}.`);
  },

  /** Every device, of any type, has the policy. */
  everyDevice: (policy) => (c) => {
    if (c.nodes.length === 0) return fail(PLACE_FIRST);
    const missing = c.nodes.filter((n) => !c.has(n, policy));
    if (missing.length) return fail(`${policyLabel(policy)} is still off for ${names(missing)}.`);
    return pass(`On for all ${c.nodes.length} devices.`);
  },

  /** Every device of the given types has the policy. */
  everyOfType: (policy, types) => (c) => {
    const pool = c.ofType(...types);
    if (pool.length === 0) return fail(PLACE_FIRST);
    const missing = pool.filter((n) => !c.has(n, policy));
    if (missing.length) return fail(`${policyLabel(policy)} is still off for ${names(missing)}.`);
    return pass(`On for all ${pool.length} ${deviceTypesText(types)}.`);
  },

  /** Exactly `count` devices of the given types have the policy, and nothing else does. */
  exactlyOnTypes: (policy, types, count) => (c) => {
    const word = deviceTypesText(types);
    const stray = c.nodes.filter((n) => !types.includes(n.type) && c.has(n, policy));
    if (stray.length) return fail(`${names(stray)} shouldn’t have ${policyLabel(policy)}. Only ${word} should.`);
    const withIt = c.ofType(...types).filter((n) => c.has(n, policy));
    if (withIt.length < count) return fail(`${withIt.length} of ${count} ${word} have ${policyLabel(policy)} so far.`);
    if (withIt.length > count) return fail(`${withIt.length} ${word} have ${policyLabel(policy)}, but only ${count} should.`);
    return pass(`${count} ${word} have it.`);
  },

  /** Every device that has `selector` must also have `policy`. */
  everyWithPolicy: (policy, selector) => (c) => {
    const selected = c.nodes.filter((n) => c.has(n, selector));
    if (selected.length === 0) return fail(`Turn on ${policyLabel(selector)} for the right devices first.`);
    const missing = selected.filter((n) => !c.has(n, policy));
    if (missing.length) return fail(`${policyLabel(policy)} is still off for ${names(missing)}.`);
    return pass(`On for all ${selected.length} of those devices.`);
  },

  /** Devices of the given types all have the policy, and no other device does. */
  onlyOnTypes: (policy, types) => (c) => {
    const pool = c.ofType(...types);
    if (pool.length === 0) return fail(PLACE_FIRST);
    const missing = pool.filter((n) => !c.has(n, policy));
    if (missing.length) return fail(`${policyLabel(policy)} is still off for ${names(missing)}.`);
    const stray = c.nodes.filter((n) => !types.includes(n.type) && c.has(n, policy));
    if (stray.length) return fail(`Turn ${policyLabel(policy)} off for ${names(stray)}.`);
    return pass(`On for ${deviceTypesText(types)} only.`);
  },
};

/* ---------- Scenarios ---------- */

export const SCENARIOS = [
  {
    id: 'file-sharing',
    number: 1,
    topology: 'ring',
    title: 'File sharing in a secure ring network',
    short: 'File sharing in a secure ring',
    story:
      'A local company needs a network administrator to set up a ring network for secure file sharing, and they need it done within a set time.',
    goal: 'Build a ring of 10 PCs and 2 routers where only five PCs can transfer files, and they do it securely.',
    timeLimit: 480,
    checks: [
      { id: 'devices', label: 'Place 10 PCs and 2 routers.', run: checks.counts({ pc: 10, router: 2 }) },
      { id: 'ips', label: 'Give every device its own IP address.', run: checks.ips() },
      { id: 'topology', label: 'Link all 12 devices into a single ring.', run: checks.ring() },
      { id: 'transfer', label: 'Turn on File transfer access for exactly 5 PCs. No router or other PC should have it.', run: checks.exactlyOnTypes('fileTransfer', ['pc'], 5) },
      { id: 'untrusted', label: 'Turn on Block untrusted IP for those 5 file-sharing PCs.', run: checks.everyWithPolicy('blockUntrusted', 'fileTransfer') },
      { id: 'web', label: 'Turn on Allow web traffic for every device.', run: checks.everyDevice('allowWeb') },
    ],
  },
  {
    id: 'video-streaming',
    number: 2,
    topology: 'star',
    title: 'Optimized video streaming in a star network',
    short: 'Video streaming in a star',
    story:
      'Professor X wants smoother video streaming across a star network and has asked an IT professional to sort it out.',
    goal: 'Build a star network of 9 devices tuned for video streaming.',
    timeLimit: 420,
    checks: [
      { id: 'devices', label: 'Place 6 PCs, 2 hubs and 1 router.', run: checks.counts({ pc: 6, hub: 2, router: 1 }) },
      { id: 'ips', label: 'Give every device its own IP address.', run: checks.ips() },
      { id: 'topology', label: 'Link the router to every other device, with no other links, to form a star.', run: checks.star('router') },
      { id: 'streaming', label: 'Turn on Prioritize streaming for all 6 PCs.', run: checks.everyOfType('prioritizeStreaming', ['pc']) },
      { id: 'throttle', label: 'Turn on Throttle bulk data for exactly 3 PCs.', run: checks.exactlyOnTypes('throttleBulk', ['pc'], 3) },
      { id: 'web', label: 'Turn on Allow web traffic for every device.', run: checks.everyDevice('allowWeb') },
      { id: 'outbound', label: 'Turn on Restrict outbound traffic for every device.', run: checks.everyDevice('restrictOutbound') },
    ],
  },
  {
    id: 'voip-mesh',
    number: 3,
    topology: 'mesh',
    title: 'VoIP communication in a mesh network',
    short: 'VoIP calls in a mesh',
    story:
      'A local internet café wants a mesh network for VoIP calls, and the owner expects it finished within a set time.',
    goal: 'Build a six-device mesh that supports smooth VoIP calls between every device.',
    timeLimit: 360,
    checks: [
      { id: 'devices', label: 'Place 3 PCs, 2 hubs and 1 router.', run: checks.counts({ pc: 3, hub: 2, router: 1 }) },
      { id: 'ips', label: 'Give every device its own IP address.', run: checks.ips() },
      { id: 'topology', label: 'Link every device to every other device to form a full mesh.', run: checks.mesh() },
      { id: 'voip', label: 'Turn on VoIP for every device.', run: checks.everyDevice('voip') },
      { id: 'web', label: 'Turn on Allow web traffic for every device.', run: checks.everyDevice('allowWeb') },
      { id: 'p2p', label: 'Turn on Limit P2P for every device.', run: checks.everyDevice('limitP2P') },
      { id: 'remote', label: 'Turn on Remote desktop access for the router and both hubs only.', run: checks.onlyOnTypes('remoteDesktop', ['router', 'hub']) },
    ],
  },
];

export const getScenario = (id) => SCENARIOS.find((s) => s.id === id) ?? null;

/** "Scenario 2" for the built-ins, "Custom scenario" for ones people make. */
export const scenarioLabel = (scenario) => (scenario.number ? `Scenario ${scenario.number}` : 'Custom scenario');

/** Grade a document against a scenario. */
export function evaluateScenario(scenario, doc) {
  const c = context(doc);
  const results = scenario.checks.map(({ id, label, run }) => {
    const { ok, detail } = run(c);
    return { id, label, ok, detail };
  });
  const met = results.filter((r) => r.ok).length;
  return {
    passed: met === results.length,
    met,
    total: results.length,
    checks: results,
  };
}

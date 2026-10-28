import { createState, networkReducer } from '../lib/networkReducer.js';
import { requiredCable } from '../lib/cabling.js';

const apply = (s, a) => networkReducer(s, a);

function place(types) {
  let s = createState();
  const ids = [];
  types.forEach((t, i) => {
    ids.push(`n${s.doc.seq}`);
    s = apply(s, { type: 'add', nodeType: t, x: 120 + (i % 6) * 110, y: 120 + Math.floor(i / 6) * 110 });
  });
  return { s, ids };
}

const typeOf = (s, id) => s.doc.nodes.find((n) => n.id === id).type;
/** Links two devices with the cable their types call for. */
const link = (s, a, b) => apply(s, { type: 'connect', a, b, cable: requiredCable(typeOf(s, a), typeOf(s, b)) });
const allIds = (s) => s.doc.nodes.map((n) => n.id);
const turnOn = (s, ids, ...policies) => policies.reduce((acc, p) => apply(acc, { type: 'togglePolicy', ids, policy: p, on: true }), s);

export { link };

/** A complete, correct solution to scenario 1 (ring). */
export function solveFileSharing() {
  let { s, ids } = place([...Array(10).fill('pc'), 'router', 'router']);
  for (let i = 0; i < ids.length; i += 1) s = link(s, ids[i], ids[(i + 1) % ids.length]);
  s = apply(s, { type: 'autoIps', ipClass: 'B' });
  const sharers = ids.slice(0, 5);
  s = turnOn(s, sharers, 'fileTransfer', 'blockUntrusted');
  s = turnOn(s, allIds(s), 'allowWeb');
  return { state: s, ids };
}

/** A complete, correct solution to scenario 2 (star). */
export function solveVideoStreaming() {
  let { s, ids } = place(['router', 'hub', 'hub', ...Array(6).fill('pc')]);
  const [router, ...rest] = ids;
  for (const id of rest) s = link(s, router, id);
  s = apply(s, { type: 'autoIps', ipClass: 'C' });
  const pcs = ids.slice(3);
  s = turnOn(s, pcs, 'prioritizeStreaming');
  s = turnOn(s, pcs.slice(0, 3), 'throttleBulk');
  s = turnOn(s, allIds(s), 'allowWeb', 'restrictOutbound');
  return { state: s, ids };
}

/** A complete, correct solution to scenario 3 (mesh). */
export function solveVoipMesh() {
  let { s, ids } = place(['router', 'hub', 'hub', 'pc', 'pc', 'pc']);
  for (let i = 0; i < ids.length; i += 1) for (let j = i + 1; j < ids.length; j += 1) s = link(s, ids[i], ids[j]);
  s = apply(s, { type: 'autoIps', ipClass: 'C' });
  s = turnOn(s, allIds(s), 'voip', 'allowWeb', 'limitP2P');
  s = turnOn(s, ids.slice(0, 3), 'remoteDesktop');
  return { state: s, ids };
}

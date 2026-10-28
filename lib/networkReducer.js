/**
 * The network document and its undo history.
 *
 * Document shape:
 *   { nodes: [{ id, type, name, x, y, ip }],
 *     edges: [{ id, a, b }],            // id = edgeId(a, b), so a pair can only be linked once
 *     policies: { [nodeId]: [policyId] },
 *     seq: number }                     // next node id counter
 *
 * Policies are keyed by the stable node id (never by IP), so changing an IP or
 * deleting a device can never orphan or resurrect a device's policies.
 */

import { isDeviceType, DEVICE_TYPES } from './devices.js';
import { isPolicyId } from './policies.js';
import { isValidIPv4, normalizeIp } from './ip.js';
import { edgeId, nextName } from './network.js';

export const HISTORY_LIMIT = 100;

export function emptyDoc() {
  return { nodes: [], edges: [], policies: {}, seq: 1 };
}

/** Accepts anything (saved JSON, older documents) and returns a clean, consistent document. */
export function normalizeDoc(raw) {
  const doc = emptyDoc();
  if (!raw || typeof raw !== 'object') return doc;

  const seen = new Set();
  let maxSeq = 0;
  for (const n of Array.isArray(raw.nodes) ? raw.nodes : []) {
    if (!n || typeof n.id !== 'string' || seen.has(n.id) || !isDeviceType(n.type)) continue;
    if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) continue;
    seen.add(n.id);
    const m = /^n(\d+)$/.exec(n.id);
    if (m) maxSeq = Math.max(maxSeq, Number(m[1]));
    const ip = normalizeIp(n.ip);
    doc.nodes.push({
      id: n.id,
      type: n.type,
      name: typeof n.name === 'string' && n.name ? n.name : nextName(doc.nodes, n.type),
      x: n.x,
      y: n.y,
      ip: isValidIPv4(ip) ? ip : '',
    });
  }

  const edgeIds = new Set();
  for (const e of Array.isArray(raw.edges) ? raw.edges : []) {
    if (!e || !seen.has(e.a) || !seen.has(e.b) || e.a === e.b) continue;
    const id = edgeId(e.a, e.b);
    if (edgeIds.has(id)) continue;
    edgeIds.add(id);
    doc.edges.push({ id, a: e.a < e.b ? e.a : e.b, b: e.a < e.b ? e.b : e.a });
  }

  const rawPolicies = raw.policies && typeof raw.policies === 'object' ? raw.policies : {};
  for (const id of seen) {
    const list = Array.isArray(rawPolicies[id]) ? rawPolicies[id].filter(isPolicyId) : [];
    if (list.length) doc.policies[id] = [...new Set(list)];
  }

  doc.seq = Math.max(Number.isFinite(raw.seq) ? raw.seq : 1, maxSeq + 1);
  return doc;
}

/* ---------- Queries ---------- */

export function hasPolicy(doc, nodeId, policyId) {
  return (doc.policies[nodeId] ?? []).includes(policyId);
}

/** Returns a message the user can act on, or null when the IP can be used. Empty clears the IP. */
export function validateIp(doc, nodeId, value) {
  const ip = normalizeIp(value);
  if (ip === '') return null;
  if (!isValidIPv4(ip)) return 'Use four numbers from 0 to 255, like 192.168.1.10.';
  const owner = doc.nodes.find((n) => n.ip === ip && n.id !== nodeId);
  if (owner) return `${ip} is already used by ${owner.name}.`;
  return null;
}

export function canConnect(doc, a, b) {
  if (a === b) return { ok: false, reason: 'A device can’t link to itself.' };
  const ids = new Set(doc.nodes.map((n) => n.id));
  if (!ids.has(a) || !ids.has(b)) return { ok: false, reason: 'Both devices must exist.' };
  if (doc.edges.some((e) => e.id === edgeId(a, b))) return { ok: false, reason: 'Those devices are already linked.' };
  return { ok: true, reason: null };
}

/* ---------- State and reducer ---------- */

export function createState(doc) {
  return { doc: normalizeDoc(doc), past: [], future: [] };
}

function commit(state, nextDoc) {
  if (nextDoc === state.doc) return state;
  return {
    doc: nextDoc,
    past: [...state.past, state.doc].slice(-HISTORY_LIMIT),
    future: [],
  };
}

function nextFreeIp(doc, prefix) {
  const used = new Set(doc.nodes.map((n) => n.ip).filter(Boolean));
  for (let i = 1; i < 255; i += 1) {
    const candidate = `${prefix}${i}`;
    if (!used.has(candidate)) return candidate;
  }
  return '';
}

export function networkReducer(state, action) {
  const { doc } = state;
  switch (action.type) {
    case 'add': {
      if (!isDeviceType(action.nodeType)) return state;
      const node = {
        id: `n${doc.seq}`,
        type: action.nodeType,
        name: nextName(doc.nodes, action.nodeType),
        x: action.x,
        y: action.y,
        ip: '',
      };
      return commit(state, { ...doc, nodes: [...doc.nodes, node], seq: doc.seq + 1 });
    }

    case 'checkpoint':
      return { ...state, past: [...state.past, doc].slice(-HISTORY_LIMIT), future: [] };

    case 'preview': {
      const positions = action.positions ?? {};
      let changed = false;
      const nodes = doc.nodes.map((n) => {
        const p = positions[n.id];
        if (!p || (p.x === n.x && p.y === n.y)) return n;
        changed = true;
        return { ...n, x: p.x, y: p.y };
      });
      return changed ? { ...state, doc: { ...doc, nodes } } : state;
    }

    case 'remove': {
      const ids = new Set(action.ids ?? []);
      if (!doc.nodes.some((n) => ids.has(n.id))) return state;
      const policies = { ...doc.policies };
      for (const id of ids) delete policies[id];
      return commit(state, {
        ...doc,
        nodes: doc.nodes.filter((n) => !ids.has(n.id)),
        edges: doc.edges.filter((e) => !ids.has(e.a) && !ids.has(e.b)),
        policies,
      });
    }

    case 'removeEdge': {
      if (!doc.edges.some((e) => e.id === action.id)) return state;
      return commit(state, { ...doc, edges: doc.edges.filter((e) => e.id !== action.id) });
    }

    case 'connect': {
      if (!canConnect(doc, action.a, action.b).ok) return state;
      const [a, b] = action.a < action.b ? [action.a, action.b] : [action.b, action.a];
      return commit(state, { ...doc, edges: [...doc.edges, { id: edgeId(a, b), a, b }] });
    }

    case 'setIp': {
      if (validateIp(doc, action.id, action.ip) !== null) return state;
      const ip = normalizeIp(action.ip);
      const target = doc.nodes.find((n) => n.id === action.id);
      if (!target || target.ip === ip) return state;
      return commit(state, {
        ...doc,
        nodes: doc.nodes.map((n) => (n.id === action.id ? { ...n, ip } : n)),
      });
    }

    case 'autoIps': {
      const prefix = action.prefix ?? '192.168.1.';
      let working = doc;
      for (const n of doc.nodes) {
        if (n.ip) continue;
        const ip = nextFreeIp(working, prefix);
        if (!ip) break;
        working = { ...working, nodes: working.nodes.map((m) => (m.id === n.id ? { ...m, ip } : m)) };
      }
      return commit(state, working);
    }

    case 'togglePolicy': {
      if (!isPolicyId(action.policy)) return state;
      const ids = (action.ids ?? []).filter((id) => doc.nodes.some((n) => n.id === id));
      if (ids.length === 0) return state;
      const everyHas = ids.every((id) => hasPolicy(doc, id, action.policy));
      const turnOn = typeof action.on === 'boolean' ? action.on : !everyHas;
      const policies = { ...doc.policies };
      for (const id of ids) {
        const current = policies[id] ?? [];
        const without = current.filter((p) => p !== action.policy);
        const next = turnOn ? [...without, action.policy] : without;
        if (next.length) policies[id] = next;
        else delete policies[id];
      }
      return commit(state, { ...doc, policies });
    }

    case 'clear':
      if (doc.nodes.length === 0) return state;
      return commit(state, { ...emptyDoc(), seq: doc.seq });

    case 'load':
      return createState(action.doc);

    case 'undo': {
      if (state.past.length === 0) return state;
      return {
        doc: state.past[state.past.length - 1],
        past: state.past.slice(0, -1),
        future: [doc, ...state.future],
      };
    }

    case 'redo': {
      if (state.future.length === 0) return state;
      return {
        doc: state.future[0],
        past: [...state.past, doc],
        future: state.future.slice(1),
      };
    }

    default:
      return state;
  }
}

export const DEVICE_LABELS = Object.fromEntries(Object.entries(DEVICE_TYPES).map(([k, v]) => [k, v.label]));

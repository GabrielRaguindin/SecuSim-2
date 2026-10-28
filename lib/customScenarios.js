/**
 * Custom scenarios.
 *
 * A custom scenario is stored as plain data (a "spec"), never as code, so it can be saved in the
 * browser, exported to a file, and imported again without ever running anything from the file.
 * `compileScenario` turns a spec into the same shape the built-in scenarios have, so the simulator
 * runs both the same way.
 *
 * Spec shape:
 *   { id, title, story, goal, timeLimit,            // timeLimit in seconds
 *     devices: { router, hub, pc, modem },          // exact counts
 *     layout: { kind, center },                     // kind: any | connected | ring | star | mesh
 *     requireIps: boolean,
 *     ipClass: 'any' | 'A' | 'B' | 'C',            // needs requireIps
 *     sameNetwork: boolean,                        // needs requireIps
 *     requireCabling: boolean,                     // needs a layout, so there are links to cable
 *     rules: [{ id, policy, kind, types, count, requires }],
 *     createdAt, updatedAt }
 *
 * Every saved spec is proven completable: `validateSpec` builds a reference solution and grades it
 * with the compiled checks, so a contradictory scenario can never be saved.
 */

import { DEVICE_ORDER, DEVICE_TYPES, deviceCountText, deviceTypesText, isDeviceType } from './devices.js';
import { isPolicyId, policyLabel } from './policies.js';
import { CABLING_LABEL, SAME_NETWORK_LABEL, checks, evaluateScenario, ipClassLabel } from './scenarios.js';
import { IP_CLASS_IDS } from './ip.js';
import { requiredCable } from './cabling.js';
import { createState, networkReducer } from './networkReducer.js';
import { joinList } from './format.js';

export const LIMITS = {
  titleMin: 3,
  titleMax: 80,
  storyMax: 400,
  goalMax: 200,
  timeMin: 60,
  timeMax: 3600,
  perType: 12,
  devices: 20,
  rules: 12,
  meshDevices: 8,
  saved: 50,
  fileChars: 60000,
};

export const LAYOUTS = [
  { id: 'any', label: 'Any', help: 'No rule about how devices are linked.' },
  { id: 'connected', label: 'Connected', help: 'Every device can reach every other, by any route.' },
  { id: 'ring', label: 'Ring', help: 'One closed loop. Every device has exactly two links.' },
  { id: 'star', label: 'Star', help: 'One device in the middle, linked to all the others and nothing else.' },
  { id: 'mesh', label: 'Mesh', help: 'Every device linked directly to every other.' },
];

export const RULE_KINDS = [
  { id: 'all', label: 'Every device', needsTypes: false },
  { id: 'ofTypes', label: 'Every device of a type', needsTypes: true },
  { id: 'only', label: 'Only certain types', needsTypes: true },
  { id: 'exactly', label: 'An exact number', needsTypes: true, needsCount: true },
  { id: 'off', label: 'Keep it off', needsTypes: true },
  { id: 'dependent', label: 'Whenever another policy is on', needsRequires: true },
];

const kindInfo = (id) => RULE_KINDS.find((k) => k.id === id);

export function emptySpec() {
  return {
    id: null,
    title: '',
    story: '',
    goal: '',
    timeLimit: 480,
    devices: Object.fromEntries(DEVICE_ORDER.map((t) => [t, 0])),
    layout: { kind: 'any', center: 'router' },
    requireIps: true,
    ipClass: 'any',
    sameNetwork: false,
    requireCabling: false,
    rules: [],
    createdAt: null,
    updatedAt: null,
  };
}

/* ---------- Cleaning ---------- */

const clampInt = (value, min, max, fallback) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const cleanText = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** Accepts anything (saved JSON, an imported file, a half-filled form) and returns a clean spec. */
export function normalizeSpec(raw) {
  if (!raw || typeof raw !== 'object') return emptySpec();

  const devices = {};
  for (const type of DEVICE_ORDER) devices[type] = clampInt(raw.devices?.[type], 0, LIMITS.perType, 0);

  const kind = LAYOUTS.some((l) => l.id === raw.layout?.kind) ? raw.layout.kind : 'any';
  const center = isDeviceType(raw.layout?.center) ? raw.layout.center : 'router';

  const rules = [];
  const usedIds = new Set();
  for (const r of Array.isArray(raw.rules) ? raw.rules : []) {
    if (rules.length >= LIMITS.rules) break;
    if (!r || !isPolicyId(r.policy) || !kindInfo(r.kind)) continue;
    let id = typeof r.id === 'string' && r.id ? r.id.slice(0, 20) : `r${rules.length + 1}`;
    while (usedIds.has(id)) id = `${id}x`;
    usedIds.add(id);
    rules.push({
      id,
      policy: r.policy,
      kind: r.kind,
      types: [...new Set((Array.isArray(r.types) ? r.types : []).filter(isDeviceType))],
      count: clampInt(r.count, 1, LIMITS.devices, 1),
      requires: isPolicyId(r.requires) ? r.requires : '',
    });
  }

  const requireIps = raw.requireIps !== false;

  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : null,
    title: cleanText(raw.title, LIMITS.titleMax),
    story: cleanText(raw.story, LIMITS.storyMax),
    goal: cleanText(raw.goal, LIMITS.goalMax),
    timeLimit: clampInt(raw.timeLimit, LIMITS.timeMin, LIMITS.timeMax, 480),
    devices,
    layout: { kind, center },
    requireIps,
    ipClass: requireIps && IP_CLASS_IDS.includes(raw.ipClass) ? raw.ipClass : 'any',
    sameNetwork: requireIps && raw.sameNetwork === true,
    requireCabling: raw.requireCabling === true,
    rules,
    createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : null,
    updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : null,
  };
}

export const totalDevices = (spec) => DEVICE_ORDER.reduce((sum, t) => sum + (spec.devices[t] ?? 0), 0);

/* ---------- Wording ---------- */

/** "all 6 PCs", "the router", "every router and hub". */
function whoPhrase(spec, types) {
  if (types.length === 1) {
    const t = types[0];
    const n = spec.devices[t] ?? 0;
    return n === 1 ? `the ${DEVICE_TYPES[t].noun}` : `all ${n} ${DEVICE_TYPES[t].plural}`;
  }
  return `every ${joinList(types.map((t) => DEVICE_TYPES[t].noun), 6)}`;
}

export function ruleLabel(spec, rule) {
  const policy = policyLabel(rule.policy);
  const types = rule.types.filter(isDeviceType);
  const who = types.length ? whoPhrase(spec, types) : 'the chosen devices';
  switch (rule.kind) {
    case 'all':
      return `Turn on ${policy} for every device.`;
    case 'ofTypes':
      return `Turn on ${policy} for ${who}.`;
    case 'only':
      return `Turn on ${policy} for ${who} only. No other device should have it.`;
    case 'exactly': {
      const amount = types.length === 1 ? deviceCountText(types[0], rule.count) : `${rule.count} of the ${deviceTypesText(types) || 'chosen devices'}`;
      return `Turn on ${policy} for exactly ${amount}. No other device should have it.`;
    }
    case 'off':
      return `Keep ${policy} off for ${who}.`;
    case 'dependent':
      return `Turn on ${policy} for every device that has ${rule.requires ? policyLabel(rule.requires) : 'the other policy'}.`;
    default:
      return policy;
  }
}

function layoutLabel(spec, total) {
  switch (spec.layout.kind) {
    case 'ring':
      return `Link all ${total} devices into a single ring.`;
    case 'star':
      return `Link the ${DEVICE_TYPES[spec.layout.center].noun} to every other device, with no other links, to form a star.`;
    case 'mesh':
      return 'Link every device to every other device to form a full mesh.';
    default:
      return 'Link the devices so every device can reach every other.';
  }
}

function devicesLabel(spec) {
  const parts = DEVICE_ORDER.filter((t) => spec.devices[t] > 0).map((t) => deviceCountText(t, spec.devices[t]));
  return parts.length ? `Place ${joinList(parts, 6)}.` : 'Choose which devices to place.';
}

function autoGoal(spec, total) {
  const shape = { ring: 'a ring', star: 'a star network', mesh: 'a full mesh', connected: 'a connected network' }[spec.layout.kind];
  const base = shape ? `Build ${shape} of ${total} devices` : `Build a network of ${total} devices`;
  return `${base} that meets every requirement before the clock runs out.`;
}

/* ---------- Compiling ---------- */

function ruleCheck(rule) {
  switch (rule.kind) {
    case 'all': return checks.everyDevice(rule.policy);
    case 'ofTypes': return checks.everyOfType(rule.policy, rule.types);
    case 'only': return checks.onlyOnTypes(rule.policy, rule.types);
    case 'exactly': return checks.exactlyOnTypes(rule.policy, rule.types, rule.count);
    case 'off': return checks.offOnTypes(rule.policy, rule.types);
    case 'dependent': return checks.everyWithPolicy(rule.policy, rule.requires);
    default: return () => ({ ok: false, detail: 'This rule isn’t recognised.' });
  }
}

/** Turns a spec into the same shape as the built-in scenarios, ready for the simulator. */
export function compileScenario(rawSpec) {
  const spec = normalizeSpec(rawSpec);
  const total = totalDevices(spec);
  const list = [];

  list.push({ id: 'devices', label: devicesLabel(spec), run: checks.counts(Object.fromEntries(DEVICE_ORDER.filter((t) => spec.devices[t] > 0).map((t) => [t, spec.devices[t]]))) });
  if (spec.requireIps) list.push({ id: 'ips', label: 'Give every device its own IP address.', run: checks.ips() });
  if (spec.ipClass !== 'any') list.push({ id: 'class', label: ipClassLabel(spec.ipClass), run: checks.ipClass(spec.ipClass) });
  if (spec.sameNetwork) list.push({ id: 'network', label: SAME_NETWORK_LABEL, run: checks.sameNetwork() });
  if (spec.layout.kind !== 'any') {
    const run = { ring: checks.ring(), star: checks.star(spec.layout.center), mesh: checks.mesh(), connected: checks.connected() }[spec.layout.kind];
    list.push({ id: 'layout', label: layoutLabel(spec, total), run });
  }
  if (spec.requireCabling) list.push({ id: 'cables', label: CABLING_LABEL, run: checks.cabling() });
  for (const rule of spec.rules) list.push({ id: `rule-${rule.id}`, label: ruleLabel(spec, rule), run: ruleCheck(rule) });

  return {
    id: spec.id ?? 'draft',
    number: null,
    custom: true,
    topology: spec.layout.kind,
    title: spec.title || 'Untitled scenario',
    short: spec.title || 'Untitled scenario',
    story: spec.story || 'Build the network below before the clock runs out.',
    goal: spec.goal || autoGoal(spec, total),
    timeLimit: spec.timeLimit,
    checks: list,
  };
}

/* ---------- Reference solution ---------- */

/** Builds a network that follows the spec to the letter. Used to prove the spec can be completed. */
export function buildReferenceSolution(rawSpec) {
  const spec = normalizeSpec(rawSpec);
  let state = createState();
  const apply = (action) => { state = networkReducer(state, action); };

  const ids = [];
  let slot = 0;
  for (const type of DEVICE_ORDER) {
    for (let i = 0; i < spec.devices[type]; i += 1) {
      ids.push({ id: `n${state.doc.seq}`, type });
      apply({ type: 'add', nodeType: type, x: 100 + (slot % 6) * 100, y: 100 + Math.floor(slot / 6) * 100 });
      slot += 1;
    }
  }

  const link = (a, b) => apply({ type: 'connect', a: a.id, b: b.id, cable: requiredCable(a.type, b.type) });
  switch (spec.layout.kind) {
    case 'ring':
      ids.forEach((d, i) => link(d, ids[(i + 1) % ids.length]));
      break;
    case 'star': {
      const center = ids.find((d) => d.type === spec.layout.center);
      if (center) ids.filter((d) => d !== center).forEach((d) => link(center, d));
      break;
    }
    case 'mesh':
      for (let i = 0; i < ids.length; i += 1) for (let j = i + 1; j < ids.length; j += 1) link(ids[i], ids[j]);
      break;
    case 'connected':
      for (let i = 0; i < ids.length - 1; i += 1) link(ids[i], ids[i + 1]);
      break;
    default:
      break;
  }

  if (spec.requireIps) apply({ type: 'autoIps', ipClass: spec.ipClass === 'any' ? 'C' : spec.ipClass });

  const on = (list, policy) => list.length && apply({ type: 'togglePolicy', ids: list.map((d) => d.id), policy, on: true });
  const ofTypes = (types) => ids.filter((d) => types.includes(d.type));
  for (const rule of spec.rules) {
    if (rule.kind === 'all') on(ids, rule.policy);
    else if (rule.kind === 'ofTypes' || rule.kind === 'only') on(ofTypes(rule.types), rule.policy);
    else if (rule.kind === 'exactly') on(ofTypes(rule.types).slice(0, rule.count), rule.policy);
  }
  // "Whenever another policy is on" has to wait until the other policies are in place.
  for (const rule of spec.rules) {
    if (rule.kind !== 'dependent') continue;
    const has = (d) => (state.doc.policies[d.id] ?? []).includes(rule.requires);
    on(ids.filter(has), rule.policy);
  }
  return state.doc;
}

/* ---------- Validation ---------- */

/**
 * Checks a spec and returns { ok, errors, list, spec }.
 * `errors` maps a field to a message: title, time, devices, layout, rules[ruleId], solvable.
 * `list` is the same messages in reading order. `spec` is the cleaned spec.
 */
export function validateSpec(raw) {
  const spec = normalizeSpec(raw);
  const errors = { rules: {} };
  const total = totalDevices(spec);

  if (spec.title.length < LIMITS.titleMin) errors.title = `Give the scenario a title of at least ${LIMITS.titleMin} characters.`;

  if (total < 2) errors.devices = 'Add at least two devices.';
  else if (total > LIMITS.devices) errors.devices = `Use at most ${LIMITS.devices} devices.`;

  const kind = spec.layout.kind;
  if (!errors.devices) {
    if ((kind === 'ring' || kind === 'mesh' || kind === 'star') && total < 3) {
      errors.layout = `A ${kind} needs at least three devices.`;
    } else if (kind === 'mesh' && total > LIMITS.meshDevices) {
      errors.layout = `A mesh of ${total} devices needs ${(total * (total - 1)) / 2} links. Use ${LIMITS.meshDevices} devices or fewer.`;
    } else if (kind === 'star' && spec.devices[spec.layout.center] !== 1) {
      const noun = DEVICE_TYPES[spec.layout.center].noun;
      errors.layout = `A star needs exactly one ${noun} at its center. Set the ${noun} count to 1, or choose a different center.`;
    }
  }

  if (spec.requireCabling && kind === 'any' && !errors.layout) {
    errors.layout = 'Cabling is graded link by link, so choose a layout that has links, or turn cabling off.';
  }

  for (const rule of spec.rules) {
    const info = kindInfo(rule.kind);
    if (info.needsTypes) {
      if (rule.types.length === 0) {
        errors.rules[rule.id] = 'Choose at least one device type.';
        continue;
      }
      const missing = rule.types.filter((t) => spec.devices[t] === 0);
      if (missing.length) {
        errors.rules[rule.id] = `This scenario has no ${deviceTypesText(missing)}. Add some, or choose another type.`;
        continue;
      }
    }
    if (info.needsCount) {
      const pool = rule.types.reduce((sum, t) => sum + spec.devices[t], 0);
      if (rule.count > pool) {
        errors.rules[rule.id] = `Only ${pool} ${deviceTypesText(rule.types)} will be placed, so ${rule.count} can’t have it.`;
        continue;
      }
    }
    if (info.needsRequires) {
      if (!rule.requires) errors.rules[rule.id] = 'Choose the policy this depends on.';
      else if (rule.requires === rule.policy) errors.rules[rule.id] = 'A policy can’t depend on itself.';
    }
  }

  // The final proof: a network that follows the spec must pass every check.
  if (!errors.title && !errors.devices && !errors.layout && Object.keys(errors.rules).length === 0) {
    const scenario = compileScenario(spec);
    const result = evaluateScenario(scenario, buildReferenceSolution(spec));
    const failed = result.checks.find((c) => !c.ok);
    if (failed) errors.solvable = `As written, this scenario can’t be completed: “${failed.label}” ${failed.detail}`;
  }

  const list = [
    errors.title,
    errors.devices,
    errors.layout,
    ...spec.rules.map((r) => errors.rules[r.id]),
    errors.solvable,
  ].filter(Boolean);

  return { ok: list.length === 0, errors, list, spec };
}

/* ---------- Files ---------- */

export const FILE_FORMAT = 'secusim-scenario';

export function serializeScenario(rawSpec) {
  const { id, createdAt, updatedAt, ...scenario } = normalizeSpec(rawSpec);
  return JSON.stringify({ format: FILE_FORMAT, version: 1, scenario }, null, 2);
}

export function scenarioFileName(rawSpec) {
  const slug = normalizeSpec(rawSpec).title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return `secusim-${slug || 'scenario'}.json`;
}

/** Reads a scenario file. Nothing in the file is ever executed: it is cleaned and re-validated. */
export function parseScenarioFile(text) {
  if (typeof text !== 'string' || text.length > LIMITS.fileChars) {
    return { ok: false, error: 'That file is too large to be a scenario.' };
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That file isn’t valid JSON.' };
  }
  if (!data || data.format !== FILE_FORMAT || !data.scenario || typeof data.scenario !== 'object') {
    return { ok: false, error: 'That doesn’t look like a SecuSim scenario file.' };
  }
  const check = validateSpec(data.scenario);
  if (!check.ok) return { ok: false, error: check.list[0] };
  return { ok: true, spec: { ...check.spec, id: null, createdAt: null, updatedAt: null } };
}

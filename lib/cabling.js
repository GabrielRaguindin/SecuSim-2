/**
 * Ethernet cabling.
 *
 * Devices fall into two groups by which wire pair they transmit on:
 *   - end devices and routers (PC, Server, Router) transmit on pins 1 and 2
 *   - hubs and modems receive on pins 1 and 2
 * A straight-through cable keeps the pairs lined up, so it joins UNLIKE groups.
 * A crossover cable swaps the pairs, so it joins LIKE groups.
 */

import { DEVICE_ORDER, DEVICE_TYPES } from './devices.js';

export const CABLES = {
  straight: {
    id: 'straight',
    label: 'Straight-through',
    short: 'Straight',
    help: 'Joins unlike devices, such as a PC and a hub.',
  },
  crossover: {
    id: 'crossover',
    label: 'Crossover',
    short: 'Crossover',
    help: 'Joins like devices, such as two PCs or two hubs.',
  },
};

export const CABLE_IDS = ['straight', 'crossover'];
export const DEFAULT_CABLE = 'straight';
export const isCable = (id) => CABLE_IDS.includes(id);
export const cableLabel = (id) => CABLES[id]?.label ?? CABLES[DEFAULT_CABLE].label;

export const CABLE_GROUPS = {
  transmit: { id: 'transmit', label: 'Transmit on pins 1 and 2', types: ['pc', 'server', 'router'] },
  receive: { id: 'receive', label: 'Receive on pins 1 and 2', types: ['hub', 'modem'] },
};

export function cableGroup(type) {
  return CABLE_GROUPS.receive.types.includes(type) ? 'receive' : 'transmit';
}

/** The cable that makes a link between these two kinds of device work. */
export function requiredCable(typeA, typeB) {
  return cableGroup(typeA) === cableGroup(typeB) ? 'crossover' : 'straight';
}

/** One sentence on why, for the inspector and the lessons. */
export function explainCable(typeA, typeB) {
  const a = DEVICE_TYPES[typeA]?.noun ?? typeA;
  const b = DEVICE_TYPES[typeB]?.noun ?? typeB;
  const group = cableGroup(typeA);
  if (group === cableGroup(typeB)) {
    const verb = group === 'transmit' ? 'transmit' : 'receive';
    return `A ${a} and a ${b} both ${verb} on pins 1 and 2, so a crossover cable is needed to swap the pairs.`;
  }
  const [sender, receiver] = group === 'transmit' ? [a, b] : [b, a];
  return `A ${sender} transmits on pins 1 and 2 and a ${receiver} receives on them, so a straight-through cable already lines them up.`;
}

/** Every pair of device types and the cable between them, for the lesson table. */
export function cableMatrix() {
  return DEVICE_ORDER.map((row) => ({
    type: row,
    cells: DEVICE_ORDER.map((col) => ({ type: col, cable: requiredCable(row, col) })),
  }));
}

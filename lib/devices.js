/** The four device types available in the sandbox and simulator. */

export const DEVICE_ORDER = ['router', 'hub', 'pc', 'modem'];

export const DEVICE_TYPES = {
  router: {
    id: 'router',
    label: 'Router',
    noun: 'router',
    plural: 'routers',
    blurb: 'Joins networks together and decides where traffic goes.',
  },
  hub: {
    id: 'hub',
    label: 'Hub',
    noun: 'hub',
    plural: 'hubs',
    blurb: 'Repeats incoming traffic to every connected device.',
  },
  pc: {
    id: 'pc',
    label: 'PC',
    noun: 'PC',
    plural: 'PCs',
    blurb: 'An everyday computer on the network.',
  },
  modem: {
    id: 'modem',
    label: 'Modem',
    noun: 'modem',
    plural: 'modems',
    blurb: 'Connects the network to an internet provider.',
  },
};

export const isDeviceType = (type) => Object.prototype.hasOwnProperty.call(DEVICE_TYPES, type);

export function deviceCountText(type, count) {
  const info = DEVICE_TYPES[type];
  if (!info) return `${count} ${type}`;
  return `${count} ${count === 1 ? info.noun : info.plural}`;
}

export function deviceTypesText(types) {
  const words = types.map((t) => DEVICE_TYPES[t]?.plural ?? t);
  if (words.length <= 1) return words[0] ?? '';
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

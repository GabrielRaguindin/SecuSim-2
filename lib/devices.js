/** The device types available in the sandbox and simulator. */

export const DEVICE_ORDER = ['router', 'hub', 'pc', 'server', 'modem'];

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
    blurb: 'A Layer 1 device: repeats incoming signals to every port. No IP address, no policies.',
    layer1: true,
  },
  pc: {
    id: 'pc',
    label: 'PC',
    noun: 'PC',
    plural: 'PCs',
    blurb: 'An everyday computer on the network.',
  },
  server: {
    id: 'server',
    label: 'Server',
    noun: 'server',
    plural: 'servers',
    blurb: 'Hosts files, websites and services for other devices.',
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

/**
 * Hubs work at Layer 1 (the physical layer). They repeat electrical signals out of every port and
 * never read an address or a rule, so they are the one device type that can't be given an IP
 * address or a security policy. This is the single place that says so.
 */
export const isLayer1 = (type) => DEVICE_TYPES[type]?.layer1 === true;
export const canHaveIp = (type) => isDeviceType(type) && !isLayer1(type);
export const canHavePolicies = (type) => isDeviceType(type) && !isLayer1(type);

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

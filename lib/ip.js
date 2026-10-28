/**
 * IPv4 helpers: syntax, classes, networks and host-address rules.
 * Leading zeros are rejected on purpose ("01.2.3.4" is ambiguous).
 *
 * A device's class is always worked out from its address, never stored next to it,
 * so the two can't drift apart.
 */

const OCTET = /^(0|[1-9]\d{0,2})$/;

export function normalizeIp(value) {
  return String(value ?? '').trim();
}

export function isValidIPv4(value) {
  const parts = normalizeIp(value).split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) => OCTET.test(part) && Number(part) <= 255);
}

/* ---------- Classes ---------- */

export const IP_CLASS_IDS = ['A', 'B', 'C'];

export const IP_CLASSES = {
  A: {
    id: 'A',
    label: 'Class A',
    first: [1, 126],
    mask: '255.0.0.0',
    prefixLength: 8,
    networks: '126',
    hosts: '16,777,214',
    privateRange: '10.0.0.0 to 10.255.255.255',
    autoPrefix: '10.0.0.',
    example: '10.0.0.1',
    use: 'Very large networks',
  },
  B: {
    id: 'B',
    label: 'Class B',
    first: [128, 191],
    mask: '255.255.0.0',
    prefixLength: 16,
    networks: '16,384',
    hosts: '65,534',
    privateRange: '172.16.0.0 to 172.31.255.255',
    autoPrefix: '172.16.0.',
    example: '172.16.0.1',
    use: 'Medium and large organizations',
  },
  C: {
    id: 'C',
    label: 'Class C',
    first: [192, 223],
    mask: '255.255.255.0',
    prefixLength: 24,
    networks: '2,097,152',
    hosts: '254',
    privateRange: '192.168.0.0 to 192.168.255.255',
    autoPrefix: '192.168.1.',
    example: '192.168.1.1',
    use: 'Small networks, like a home or an office',
  },
};

const octets = (ip) => normalizeIp(ip).split('.').map(Number);

/** 'A' | 'B' | 'C' | 'D' | 'E' | 'loopback' | 'reserved' | 'invalid' */
export function ipClassOf(ip) {
  if (!isValidIPv4(ip)) return 'invalid';
  const [a] = octets(ip);
  if (a === 0) return 'reserved';
  if (a === 127) return 'loopback';
  if (a <= 126) return 'A';
  if (a <= 191) return 'B';
  if (a <= 223) return 'C';
  if (a <= 239) return 'D';
  return 'E';
}

export function isPrivateIp(ip) {
  if (!isValidIPv4(ip)) return false;
  const [a, b] = octets(ip);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/** The network and broadcast addresses under the class's default mask, or null for classes D and E. */
function bounds(ip) {
  const cls = ipClassOf(ip);
  if (!IP_CLASSES[cls]) return null;
  const [a, b, c] = octets(ip);
  if (cls === 'A') return { network: `${a}.0.0.0`, broadcast: `${a}.255.255.255` };
  if (cls === 'B') return { network: `${a}.${b}.0.0`, broadcast: `${a}.${b}.255.255` };
  return { network: `${a}.${b}.${c}.0`, broadcast: `${a}.${b}.${c}.255` };
}

export const networkOf = (ip) => bounds(ip)?.network ?? null;
export const broadcastOf = (ip) => bounds(ip)?.broadcast ?? null;

/** Everything a learner might want to know about an address, or null when it isn't class A, B or C. */
export function describeIp(ip) {
  const cls = ipClassOf(ip);
  const info = IP_CLASSES[cls];
  if (!info) return null;
  return {
    class: cls,
    label: info.label,
    private: isPrivateIp(ip),
    network: networkOf(ip),
    broadcast: broadcastOf(ip),
    mask: info.mask,
    prefixLength: info.prefixLength,
  };
}

/**
 * Why this address can't be given to a device, or null when it can.
 * Assumes the address is already valid IPv4 (check `isValidIPv4` first).
 */
export function validateHostIp(ip) {
  const clean = normalizeIp(ip);
  const cls = ipClassOf(clean);
  if (cls === 'reserved') return 'Addresses starting with 0 can’t be used by a device.';
  if (cls === 'loopback') return 'Addresses starting with 127 are loopback addresses: they point back at the device itself. Choose another.';
  if (cls === 'D') return 'Addresses from 224 to 239 are Class D, which is for multicast. A device needs a Class A, B or C address.';
  if (cls === 'E') return 'Addresses from 240 to 255 are Class E, which is reserved. A device needs a Class A, B or C address.';
  if (!IP_CLASSES[cls]) return null;
  if (clean === networkOf(clean)) return `${clean} is the network address of its ${IP_CLASSES[cls].label} network, so it names the network, not a device. Choose a host address.`;
  if (clean === broadcastOf(clean)) return `${clean} is the broadcast address of its ${IP_CLASSES[cls].label} network, which reaches every device at once. Choose a host address.`;
  return null;
}

/** The first free host address in a class's private range, or '' when the range is full. */
export function nextHostIp(used, ipClass = 'C') {
  const prefix = (IP_CLASSES[ipClass] ?? IP_CLASSES.C).autoPrefix;
  const taken = new Set(used);
  for (let i = 1; i < 255; i += 1) {
    const candidate = `${prefix}${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return '';
}

const compareNetworks = (a, b) => {
  const x = octets(a);
  const y = octets(b);
  for (let i = 0; i < 4; i += 1) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
};

/**
 * Devices organised by class and network: { groups: [{ key, class, network, mask, nodes }], unassigned }.
 * Groups run from Class A to C and then by network number. Devices without an address are listed apart.
 */
export function groupByNetwork(nodes) {
  const byKey = new Map();
  const unassigned = [];
  for (const node of nodes) {
    if (!node.ip) {
      unassigned.push(node);
      continue;
    }
    const info = describeIp(node.ip);
    const key = info ? info.network : `other:${ipClassOf(node.ip)}`;
    if (!byKey.has(key)) {
      byKey.set(key, { key, class: info?.class ?? null, network: info?.network ?? null, mask: info?.mask ?? null, nodes: [] });
    }
    byKey.get(key).nodes.push(node);
  }
  const groups = [...byKey.values()].sort((a, b) => {
    if (a.class === b.class && a.network && b.network) return compareNetworks(a.network, b.network);
    return (a.class ?? 'Z').localeCompare(b.class ?? 'Z');
  });
  return { groups, unassigned };
}

/**
 * Policy catalogue. Policies are stored per device as a flat list of ids,
 * for example `policies['n3'] = ['allowWeb', 'blockUntrusted']`.
 */

export const POLICY_CATEGORIES = [
  {
    id: 'accessControl',
    label: 'Access control',
    summary:
      'Decides who can reach a device and what they may do once connected: authenticating credentials and granting only the permissions tied to a user or address.',
    detail:
      'Good access control limits unauthorized physical or logical access to sensitive data. It spells out who can use your data, when, and up to which level.',
    policies: [
      { id: 'remoteDesktop', label: 'Remote desktop access', help: 'Lets an administrator see and control this device from another machine.' },
      { id: 'fileTransfer', label: 'File transfer access', help: 'Allows files to be sent to and from this device.' },
      { id: 'ssh', label: 'SSH access', help: 'Allows encrypted command-line access for administration.' },
      { id: 'adminPrivilege', label: 'Admin privilege', help: 'Grants full administrative rights on this device.' },
    ],
  },
  {
    id: 'qos',
    label: 'Quality of service',
    summary:
      'Shapes network traffic so critical applications keep working well when capacity is limited.',
    detail:
      'It matters most for resource-hungry traffic such as streaming, gaming and voice calls. It lets an organization promise performance to the services that need it.',
    policies: [
      { id: 'voip', label: 'VoIP', help: 'Gives voice-call traffic priority so calls stay clear.' },
      { id: 'limitP2P', label: 'Limit P2P', help: 'Caps peer-to-peer traffic so it cannot crowd out everything else.' },
      { id: 'throttleBulk', label: 'Throttle bulk data', help: 'Slows large background transfers to protect bandwidth for other traffic.' },
      { id: 'prioritizeStreaming', label: 'Prioritize streaming', help: 'Gives video and audio streams priority for smooth playback.' },
    ],
  },
  {
    id: 'firewall',
    label: 'Firewall',
    summary:
      'A set of rules that controls the traffic crossing the border between your network and everything outside it.',
    detail:
      'Firewalls usually guard the edge of a private network or its devices. They are one part of a wider strategy against malicious activity.',
    policies: [
      { id: 'blockUntrusted', label: 'Block untrusted IP', help: 'Drops traffic from addresses that are not on the trusted list.' },
      { id: 'allowWeb', label: 'Allow web traffic', help: 'Permits ordinary web traffic (HTTP and HTTPS).' },
      { id: 'blockPing', label: 'Block ping requests', help: 'Ignores ping requests so the device is harder to discover.' },
      { id: 'restrictOutbound', label: 'Restrict outbound traffic', help: 'Limits what this device can send out to other networks.' },
    ],
  },
  {
    id: 'encryption',
    label: 'Encryption',
    summary:
      'Turns readable data into scrambled cipher text that only someone with the right key can read.',
    detail:
      'A policy names the standards, algorithms and keys to use for data at rest, in transit and in use, and how keys are managed and recovered.',
    policies: [
      { id: 'dataEncryption', label: 'Enable data encryption', help: 'Scrambles stored and transmitted data so only key holders can read it.' },
      { id: 'encryptedSharing', label: 'Require encrypted file sharing', help: 'Only allows file sharing over encrypted connections.' },
      { id: 'endToEnd', label: 'Enable end-to-end encryption', help: 'Keeps messages encrypted all the way between sender and receiver.' },
      { id: 'encryptVoip', label: 'Encrypt VoIP', help: 'Encrypts voice calls so they cannot be overheard.' },
    ],
  },
];

export const ALL_POLICIES = POLICY_CATEGORIES.flatMap((c) =>
  c.policies.map((p) => ({ ...p, category: c.id }))
);

const BY_ID = new Map(ALL_POLICIES.map((p) => [p.id, p]));

export const isPolicyId = (id) => BY_ID.has(id);
export const policyLabel = (id) => BY_ID.get(id)?.label ?? id;

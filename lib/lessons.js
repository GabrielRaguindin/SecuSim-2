/** Teaching copy for the Learn pages. Plain data only: it is passed to client components. */

export const TOPOLOGY_LESSONS = [
  {
    kind: 'ring',
    title: 'Ring',
    summary: 'Devices are connected in a circle, forming a closed loop.',
    body: 'Data travels from one device to the next until it reaches whoever it is meant for. Each device only ever talks to its two neighbors.',
    facts: [
      ['Links per device', 'Exactly two'],
      ['Total links', 'As many as there are devices'],
      ['If a link fails', 'The loop is broken. Traffic can only get through if the ring works in both directions.'],
    ],
    scenarioId: 'file-sharing',
    scenarioNumber: 1,
  },
  {
    kind: 'star',
    title: 'Star',
    summary: 'Every device connects to one device in the middle.',
    body: 'The central device acts like a server and the others act like clients. When it receives a packet from one device, it passes it on to the right one.',
    facts: [
      ['Links per device', 'One, to the center'],
      ['Total links', 'One fewer than the number of devices'],
      ['If the center fails', 'Every device loses its connection to the others.'],
    ],
    scenarioId: 'video-streaming',
    scenarioNumber: 2,
  },
  {
    kind: 'mesh',
    title: 'Mesh',
    summary: 'Every device connects directly to every other device.',
    body: 'With n devices, each one has n − 1 links. Traffic never has to pass through anyone else, and it can usually find another way if a link goes down.',
    facts: [
      ['Links per device', 'n − 1'],
      ['Total links', 'n × (n − 1) ÷ 2'],
      ['The catch', 'Cabling and set-up grow quickly with every device you add.'],
    ],
    scenarioId: 'voip-mesh',
    scenarioNumber: 3,
  },
];

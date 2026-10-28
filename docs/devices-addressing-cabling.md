# Server, IP classes and cabling

## The Server

A fifth device, `server`, in `lib/devices.js`. It appears in the dock, the sandbox, the custom scenario builder (as a device count and as a star center) and the cabling rules. It is an end device: for cabling it behaves like a PC. The built-in scenarios do not use one, so their device counts are unchanged.

## IP classes (`lib/ip.js`)

A device's class is **worked out from its address, never stored**, so the two cannot drift apart.

| Class | Begins | Default mask | Private range | Auto-assign range |
|---|---|---|---|---|
| A | 1 to 126 | 255.0.0.0 (/8) | 10.0.0.0 to 10.255.255.255 | 10.0.0.1 and up |
| B | 128 to 191 | 255.255.0.0 (/16) | 172.16.0.0 to 172.31.255.255 | 172.16.0.1 and up |
| C | 192 to 223 | 255.255.255.0 (/24) | 192.168.0.0 to 192.168.255.255 | 192.168.1.1 and up |

**Addresses a device can no longer have** (with a reason shown): the network address (host bits all 0), the broadcast address (host bits all 1), loopback (127.x.x.x), anything starting with 0, Class D (multicast) and Class E (reserved). Saved networks drop an address like this when they load.

**In the UI**
- Inspector: a class picker (gives the next free address in that class) and the address details (class, public or private, network, mask, broadcast).
- Toolbar: the lightning button is now a menu. Choosing a class gives every device that is not already in it the next free address from that class. Devices already in the class keep their address.
- Sidebar: an **Address plan** panel groups every addressed device by class and network.
- Learn: a new **Addressing** page, generated from the same class table the app uses.

**Grading** (`checks.ipClass`, `checks.sameNetwork` in `lib/scenarios.js`): every device has an address in the required class; every device is on one network under the class's default mask.

## Cabling (`lib/cabling.js`)

Every link now has a `cable`: `'straight'` or `'crossover'` (default `'straight'`).

| Group | Devices | Pins 1 and 2 |
|---|---|---|
| transmit | PC, Server, Router | transmit |
| receive | Hub, Modem | receive |

A link between **unlike** groups needs **straight-through**. A link between **like** groups needs **crossover**. `requiredCable(typeA, typeB)` is the one place this rule lives; the canvas, inspector, grading, custom scenario solver and the Learn page all call it.

**In the UI**
- Toolbar: choose the cable for new links (Straight or Crossover, or press **C**).
- Canvas: crossover links are dashed with an **X**; a link with the wrong cable turns amber with a **!**.
- Inspector: select a link to change its cable. It says whether the cable is right and why.
- Learn: a new **Cabling** page with the full device-by-device table.

**Grading** (`checks.cabling`): every link uses the right cable. With no links it **fails** ("No links yet"), never passes vacuously.

## What changed for the built-in scenarios

| Scenario | New requirements |
|---|---|
| 1. File sharing in a ring | Class B addresses; the right cable on every link (a ring of PCs, so every link is a crossover) |
| 2. Video streaming in a star | Class C addresses; the right cable on every link (router to hubs straight-through, router to PCs crossover) |
| 3. VoIP in a mesh | Class C addresses; the right cable on every link (a mix) |

## Custom scenarios

Three new options, all optional: **address class** (any, A, B or C), **all devices on the same network**, and **right cable on every link**. Cabling needs a layout, so a scenario with layout "Any" and cabling on is refused. The solver builds its reference network with the right cable on every link and addresses from the chosen class, so the proof that a scenario can be completed still holds. Scenarios saved before this change load with cabling off and the class set to Any, so they are not suddenly stricter.

## Behavior changes to be aware of

1. **Saved networks.** Links saved before this change have no cable, so they load as straight-through. Some (PC to PC, say) will show the amber warning until you change them.
2. **Saved results** keep their old requirement lists and still display normally.
3. **Modem** is grouped with Hub for cabling (receives on pins 1 and 2). That is a modelling choice; change `CABLE_GROUPS` in `lib/cabling.js` if you want it with the end devices.
4. **Default cable** is straight-through, so a PC-to-PC link made without choosing is flagged. That is deliberate: choosing is the lesson.
5. **Class boundaries** follow the classful rules above (so 127.x.x.x is loopback, not Class A).

## Not covered

- Subnetting beyond the default class masks, and routing between networks.
- Auto-MDIX (modern devices pick the cable themselves). The Learn page mentions it.
- Fibre, serial or console cables.

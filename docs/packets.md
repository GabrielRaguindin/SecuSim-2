# Sending a packet (sandbox)

The sandbox has a **Send a packet** panel. Pick a sender, a receiver and a packet type, and press Send. The packet travels hop by hop across the canvas and either arrives or stops where something is wrong, with an explanation and a fix. It runs on the same rules the scenarios grade, so what you learn here carries over.

## What decides the outcome

`traceRoute(doc, fromId, toId, kind)` in `lib/packets.js` is a pure function of the document. It never changes it. The checks run in this order, and the first one that fails stops the packet:

| # | Check | Stops with | Where the packet stops |
|---|---|---|---|
| 1 | Two different devices; a hub can't be an endpoint (it has no address) | `same-device`, `bad-endpoint`, `missing` | the sender |
| 2 | Both devices have an IP address | `no-address` | the sender |
| 3 | The sender's firewall: **Restrict outbound traffic** when the receiver is on another network; **Allow web traffic** (web) or **File transfer access** (file) | `outbound-blocked`, `sender-policy` | the sender |
| 4 | A route over working links | `no-route` (lists what the sender can reach) | the sender |
| 5 | Every link on the route has the right cable (a wrong cable means the link is down) | `wrong-cable` | the device before the broken link |
| 6 | Different networks need a **router** on the route | `no-router` | the sender |
| 7 | The receiver's firewall: **Block untrusted IP** (sender on another network), **Block ping requests** (ping), **Allow web traffic** / **File transfer access** | `receiver-blocked` | the receiver (it arrived, then was dropped) |

A route that avoids a broken link is used when one exists, so a wrong cable only stops traffic when there is no other way through.

## Packet types

| Type | Needs |
|---|---|
| Ping | nothing, unless the receiver has Block ping requests on |
| Web | Allow web traffic on both devices |
| File | File transfer access on both devices |

## Networks and routers

"Same network" uses each class's default mask (Class A: first number, Class B: first two, Class C: first three), the same rule the scenario check **All devices on the same network** uses. Devices on different networks only reach each other through a router. A router as the sender or receiver counts. A route may pass the same hub twice (up to a router on the hub and back), but it never runs through the sender again or through the receiver.

## In the UI

- The packet is a dot that moves one hop at a time on a spring. Links it has crossed turn teal.
- Delivered: the receiver gets a green ring and a check. Blocked: the place it stopped gets a red ring or a red ✕ on the broken link.
- The result card says Delivered or Blocked, why, how to fix it, and lists each hop.
- Changing the network (a link, a cable, an address or a policy) clears the last result. Moving a device does not.
- With reduced motion the result appears at once.

## Files

| Area | File |
|---|---|
| Rules and route finding | `lib/packets.js` |
| Panel, timing, result card | `components/sandbox/PacketPanel.jsx` |
| Packet, trace and markers on the canvas | `components/workbench/NetworkCanvas.jsx` (`trace` prop) |
| Wiring | `components/sandbox/Sandbox.jsx`, `components/workbench/Workbench.jsx` |
| Tests | `tests/packets.test.js` (23 tests, including a seeded random-network invariant) |

## Limits to know about

- One-way: there is no reply, so a ping that arrives is "delivered", not "answered".
- No ARP, DNS, TTL, MTU or latency. Routers need no addresses on their own interfaces.
- Every device passes packets along, as in the ring demo on the Learn page, even though real PCs would not forward them.
- Firewall policies apply at the two endpoints only, not at devices in the middle.
- Encryption policies and QoS policies don't affect delivery.
- The packet panel is in the sandbox only. The simulator is unchanged.

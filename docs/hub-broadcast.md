# Hubs broadcast, and loops are a storm (Patch 2.4.2)

A hub is now a strict broadcaster. Whenever a packet passes through a hub, the hub **copies it out of every other port**, to everyone, and it can't tell it has seen a packet before. That makes loops of hubs dangerous, and SecuSim shows it.

This is one piece of Patch 2.4. Targeted delivery by a switch, ping answers and filtering at devices on the route are separate, later pieces.

## What happens to a packet that crosses a hub

`traceRoute` (`lib/packets.js`) still finds the route the packet takes, as before. For every hub on that route it then runs the flood in `spread()`:

1. The hub sends a copy out of every port except the one the packet came in on.
2. A copy that reaches **another hub** is repeated again, out of that hub's other ports.
3. A copy that reaches **any other device** (a PC, server, router, switch or modem) stops there. Only hubs repeat blindly. If the device is not the receiver, it **ignores** the copy because it isn't addressed to it.
4. Only links with the **right cable** carry a copy. A link with the wrong cable is down, so it carries nothing.

The result card lists this, for example:

> Hub 1 repeats it out of every other port, to PC 3 and PC 2.
> Heard by PC 3, which ignores it because it isn't addressed to it.

On the canvas, links that carried a copy are dashed, and a device that heard a packet it wasn't the target of gets a dotted ring. The route itself is still drawn solid.

Several hubs linked together are one **segment**: one flood covers all of them, and the result shows it once.

## The broadcast storm

If a copy reaches a hub that has already had one, the hubs are joined in a loop. The copies would circle forever, so the packet stops with a **broadcast storm** result (`broadcast-storm`):

- **Title:** "Broadcast storm: Hub 1, Hub 2 and Hub 3 form a loop", naming every hub in the loop.
- **Detail:** explains that a hub can't tell it has seen a packet before.
- **Fix:** "Remove one link in the loop, for example Hub 2 to Hub 3."
- **On the canvas:** the first hub the packet reached gets a red ring, and the link that closed the loop gets a red cross.

The order of checks is: the sender's own problems (addresses, firewall), then the route and cables, then **the flood**, then the receiver's firewall. So a storm is reported even when the receiver would have refused the packet anyway.

### What counts as a loop

| Layout | Storm? |
|---|---|
| Three or more hubs linked in a ring | Yes |
| A hub triangle the packet never enters | No: only hubs on the packet's route flood |
| A cycle that passes through a router, switch, PC, server or modem | No: those stop a copy, so the copies can't go around |
| A loop where one link has the wrong cable | No: that link is down |
| A star with a hub at the center, or hubs chained in a line | No |

A loop of **switches** is also not a storm yet: a switch still just passes the packet along, which is the next piece of 2.4.

## Behavior changes to be aware of

1. A network that used to deliver a packet through a looped group of hubs now reports a storm. Nothing else about delivery changes: a packet that didn't cross a hub, or crossed hubs without a loop, is delivered exactly as before.
2. The hub's log line changed from "repeats it to every device on its ports" to the wording above.
3. Custom scenarios can still ask for a ring or a mesh with hubs, and grading doesn't send packets, so they are still gradable. A scenario that must also *work* would have to wait for the planned reachability requirements.

## Files

| Area | File |
|---|---|
| Flood, storm detection, wording | `lib/packets.js` (`spread`, `bystanderLine`, step 5b of `traceRoute`) |
| Copies and "heard" devices handed to the canvas | `components/sandbox/PacketPanel.jsx` |
| Dashed copies, dotted ring | `components/workbench/NetworkCanvas.jsx`, `styles/workbench.css` |
| Tests | `tests/hub-broadcast.test.js` (14 tests); `tests/packets.test.js` and its randomized test cover the rest |

## Limits to know about

- The flood is drawn all at once when the packet finishes, not copy by copy.
- A packet that enters a storm is stopped at the first hub. SecuSim doesn't simulate the network melting down.
- The sender still sends a single packet along the shortest route, so a PC with several links doesn't copy a packet out of all of them. Only hubs duplicate.

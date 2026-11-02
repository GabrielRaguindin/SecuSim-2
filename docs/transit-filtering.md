# Filtering on the way (Patch 2.4.5, with default-deny permissions)

Firewall rules are no longer asked of the two ends only. A router, switch, modem, server or PC that a packet passes through can **drop it with its own policies**, in the order the packet meets them.

## What a device in the middle enforces

Two kinds of rule filter in the middle.

**Blocking rules**: these stop a packet when they are on.

| Policy | A device on the way drops the packet when… |
|---|---|
| **Restrict outbound traffic** | the packet is going to another network. The device won't forward it. |
| **Block untrusted IP** | the sender is outside the network the device guards. That is the device's **own network** when it has an address. A device with **no address** guards the network the packet is heading for. |
| **Block ping requests** | the packet is a ping. |

**Permissions (default deny)**: these must be on, or the device won't carry that kind of packet.

| Policy | Needed by |
|---|---|
| **Allow web traffic** | a web request, on the sender, the receiver **and every device in between** |
| **File transfer access** | a file transfer, on the sender, the receiver **and every device in between** |

A ping needs no permission anywhere.

Everything else is unchanged:

- **Quality of service, encryption and access-control** policies still never affect delivery.
- **Hubs** can't hold policies, so they never filter and never need a permission. They copy everything (see `docs/hub-broadcast.md`). This is why a network of hubs still works with no configuration at all.

"A device in the middle" means any device on the route other than the sender and the receiver that can hold policies: a router, switch, modem, server or PC. (SecuSim lets every device pass packets along, so a PC or server on the route filters like any other.)

## Order

`traceRoute` walks the route from the sender. At each device in the middle:

- a **hub** copies the packet out of every other port, and a loop of hubs is a storm;
- **any other device** checks the three rules above.

The first thing that stops the packet wins, and the packet is shown stopped at that device. So the full order is: the sender's own checks, the route and cables, **the devices on the way, in path order**, then the receiver's firewall.

This has visible consequences:

- A router with Block ping requests in front of a hub stops the ping **before** the hub copies anything. With the hub first, the hub copies it and then the router drops it.
- A router that objects in front of a hub loop is reported instead of a storm, and a hub loop in front of a router that objects is a storm.
- A filter in the middle is reported before the receiver's own rule.

## The result

A packet stopped in the middle shows **Blocked**, with code `transit-blocked` (a blocking rule) or `transit-policy` (a missing permission):

> **Router 1's firewall blocked it.** Restrict outbound traffic is on for Router 1, so it won't forward a packet to another network. This one is going from 192.168.1.0 to 10.0.0.0.
> **To fix it:** Turn Restrict outbound traffic off for Router 1, or send to a device on 192.168.1.0.

A missing permission reads:

> **Router 1 didn't let it through.** Allow web traffic is off for Router 1, so it won't carry a web request on the way. Every device a web request passes through needs it, not just the two ends.
> **To fix it:** Turn on Allow web traffic for Router 1.

On the canvas the device that stopped it gets a red ring, and the log ends there.

## Decisions worth knowing about

1. **The middle is default deny for permissions.** Allow web traffic and File transfer access must be on at every device a packet crosses, because that is how a real firewall works: nothing is allowed until it is permitted. It makes a built network need more setup before a web request or file transfer gets through, and the result always names the first device that is missing it, so the learner can fix them one at a time. Select several devices with Shift-click to set a policy on all of them at once.
2. **Filtering does not change the route.** Routing doesn't know about firewall rules, so a packet is still sent along the shortest working route, and a firewall drop on it is final even if another route exists. A **wrong cable** is different: that link is down, so the route avoids it.
3. **Block untrusted IP without an address.** A router needs no address in SecuSim, so there is no network of its own to trust. It guards the network the packet is heading for, which is the same rule an end device applies to itself.
4. **A blocking rule is reported before a missing permission** on the same device.

## Files

| Area | File |
|---|---|
| The rules and the order | `lib/packets.js` (`transitBlock`, step 5b of `traceRoute`) |
| Wording for the ping help | `lib/packets.js` (`PACKET_KINDS`) |
| Learn page, "Where a rule applies" | `app/(site)/learn/policies/page.jsx` |
| Tests | `tests/transit.test.js` (23 tests, including a 2000-network randomized check against an independent statement of the rules); `tests/switch.test.js` updated |

## Limits to know about

- The check is one-way: there is no reply path yet, so a return packet isn't filtered.
- A device filters only a packet that passes through it. A device that merely *hears* a hub's copy ignores it and doesn't filter it.

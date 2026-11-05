# Layer 1 devices: why hubs have no address and no policies

A hub works at **Layer 1**, the physical layer. It repeats the electrical signal it receives out of every other port and never looks at what is inside it. It does not read an address and it does not apply a rule, so in real networking it has **no IP address** and **cannot hold a security policy**. SecuSim now models that: the hub is the **one and only device type on the dock** that can't be given either.

| Device | IP address | Policies | Why |
|---|---|---|---|
| Router | yes | yes | Reads addresses to route between networks |
| PC | yes | yes | An end device on the network |
| Server | yes | yes | An end device other devices need to find |
| Modem | yes | yes | Has an address to be managed and to reach the provider |
| **Hub** | **no** | **no** | Layer 1: repeats signals, reads nothing |

A hub is still a real part of a network. It carries traffic, takes cables, can be the center of a star, and appears in topologies. It just can't be an endpoint of a packet and has nothing to configure.

## How it is enforced

The rule has **one definition** and every layer asks it.

| Layer | File | What happens |
|---|---|---|
| The definition | `lib/devices.js` | `DEVICE_TYPES.hub.layer1 = true`, with `isLayer1`, `canHaveIp`, `canHavePolicies` |
| The document | `lib/networkReducer.js` | `setIp` and `validateIp` refuse a hub, with a reason. `togglePolicy` skips hubs (a selection of only hubs is a no-op, a mixed selection applies to the rest). `autoIps` skips hubs. `normalizeDoc` strips an address or policies from a hub, so **older saves are cleaned when they load** |
| Grading | `lib/scenarios.js` | Every address and policy check works on the devices that *can* hold them (`context.addressable`). A hub is never asked for an address and never counted. Messages say the hubs were left out |
| Custom scenarios | `lib/customScenarios.js` | A hub is dropped from every policy rule's device types (also on import). A rule that names only hubs is refused. A scenario that needs addresses but has only hubs is refused. Labels say "every device except the hubs" when hubs are placed |
| Packets | `lib/packets.js` | `canBeEndpoint` uses `canHaveIp`. A hub can't send or receive, but a packet still crosses one |
| Device editor | `components/workbench/DeviceEditor.jsx` | Opening a hub shows a Layer 1 explanation instead of the address and policy controls. In a mixed selection the switches act on the other devices and a line says the hubs are skipped |
| Canvas | `components/workbench/NetworkCanvas.jsx` | A hub never shows an address or a policy badge. A screen reader hears "no IP address or policies (Layer 1)" |
| Address plan | `components/workbench/AddressPlan.jsx` | Hubs are listed as "No address needed", never as "No address yet" |
| Rule builder | `components/scenarios/ScenarioBuilder.jsx` | A policy rule never offers hubs as a device type, and a new rule never starts on one |
| Learn | `app/(site)/learn/addressing`, `learn/policies` | Both lessons explain the exception |

Because the document layer enforces it, nothing can bypass it: not the device editor, not a keyboard shortcut, not a saved file, not an imported scenario.

## The built-in scenarios, after this change

Scenario 1 has no hubs, so it is unchanged: a ring of **8 PCs**.

Scenarios 2 and 3 used to place two hubs each. They no longer do: the hubs are replaced with a **server** and a **modem**, so every device has a real job, and the policy requirements are rewritten so they only ever ask a device for something it can hold. Hubs stay fully supported in the sandbox and in custom scenarios.

**Scenario 2: Optimized video streaming in a star network** (6 PCs, 1 server, 1 modem, 1 router; 7:00)

| # | Requirement |
|---|---|
| 1 | Place 6 PCs, 1 server, 1 modem and 1 router. *(was: 6 PCs, 2 hubs, 1 router)* |
| 2 | Give every device its own IP address. |
| 3 | Use Class C addresses (beginning 192 to 223) for every device. |
| 4 | Link the router to every other device, with no other links, to form a star. |
| 5 | Use the right cable on every link: straight-through between unlike devices, crossover between like ones. |
| 6 | Turn on Prioritize streaming for the server and all 6 PCs. *(was: all 6 PCs)* |
| 7 | Turn on Throttle bulk data for exactly 3 PCs. |
| 8 | Turn on Allow web traffic for the router, the server and all 6 PCs. *(was: every device)* |
| 9 | Turn on Block untrusted IP for the router only. No other device should have it. *(replaces: Restrict outbound traffic for every device)* |

**Scenario 3: VoIP communication in a mesh network** (3 PCs, 1 server, 1 modem, 1 router; 6:00)

| # | Requirement |
|---|---|
| 1 | Place 3 PCs, 1 server, 1 modem and 1 router. *(was: 3 PCs, 2 hubs, 1 router)* |
| 2 | Give every device its own IP address. |
| 3 | Use Class C addresses (beginning 192 to 223) for every device. |
| 4 | Link every device to every other device to form a full mesh. |
| 5 | Use the right cable on every link: straight-through between unlike devices, crossover between like ones. |
| 6 | Turn on VoIP for the router, the server and all 3 PCs. *(was: every device)* |
| 7 | Turn on Encrypt VoIP for the server and all 3 PCs. *(new: replaces Allow web traffic)* |
| 8 | Turn on Limit P2P for the router only. No other device should have it. *(was: every device)* |
| 9 | Turn on SSH access for the router and the server only. No PC or modem should have it. *(replaces: Remote desktop access for the router and both hubs)* |

### Why these devices and rules

- **Why the hubs left.** In Scenario 3 a full mesh joined the two hubs to each other and to the router. Hubs have no loop protection, so a mesh of them creates loops in which a broadcast circles forever; a full mesh is a router-and-end-device idea. In Scenario 2 the hubs were linked straight to the router and did nothing. A star around a hub is still the classic example, and it is supported (see below).
- **A server and a modem instead.** In Scenario 2 the server is the streaming source and the modem is the uplink to the internet, both of which really do hang off the router in a star. In Scenario 3 the server is the VoIP server (a PBX) that brokers calls, and the modem carries outside calls. Both are devices that can hold an address and a policy.
- **The cabling is still a mix.** Scenario 2: router to modem is straight-through, router to the server and the PCs is crossover. Scenario 3: the modem takes a straight-through cable to every other device (5 links), and every other pair is crossover (10 links). Learners still have to choose per link.
- **Block untrusted IP on the router (S2).** A router is the border between a network and everything outside it, which is where a firewall belongs. Restricting outbound traffic on every device was a blunt rule, and on the gateway it would cut the network off from the internet.
- **Prioritize streaming on the server and the PCs (S2).** QoS marking belongs at the source of the stream and at the viewers.
- **Encrypt VoIP on the server and PCs (S3).** Calls begin and end on those devices, so that is where the voice is encrypted. It also gives the scenario an encryption requirement it never had.
- **Limit P2P on the router only (S3).** Peer-to-peer traffic is shaped where it crosses the gateway, not on every end device.
- **SSH on the router and the server only (S3).** Network equipment and servers are administered over SSH. The old rule asked for Remote desktop on a router and two hubs, which is wrong twice over: hubs can't be administered, and routers aren't managed over a desktop session. A PC or the modem with SSH still fails, so the challenge is kept.
- **The challenge level is unchanged.** Scenario 2 and Scenario 3 still have 9 requirements each, with the same mix of "every", "exactly" and "only" rules.

## Behavior changes to be aware of

1. **Saved networks and topologies** lose any address or policy that sits on a hub when they load. Nothing else changes.
2. **Saved results** keep the requirement lists they were graded against, so older Scenario 2 and 3 results still show the old wording and the old devices. Because they are different exercises now, a scenario you completed before the change still shows as "Done in…" on the list. If you would rather start clean, give Scenarios 2 and 3 new ids in `lib/scenarios.js` and old results stop counting.
3. **Custom scenarios** saved with a hub in a policy rule load with the hub removed from that rule. If that leaves the rule with no device type, it is flagged when you next open it in the builder.
4. **Policy requirement wording** now says exactly who it applies to ("the router and all 6 PCs") instead of "every device".

## Observations that are still open

- **Resolved:** Scenario 3 used to be a full mesh that included two hubs, and Scenario 2 linked two hubs to the router for no reason. Both are fixed by the device changes above.
- **Every device passes packets along** in the packet simulator, as in the ring demo, even though a real PC would not forward traffic.
- **Any full mesh that includes end devices is a teaching abstraction.** A real PC has one network port, not five. The mesh is still the right shape to teach "every device linked to every other", and Scenario 3's cabling and policy rules are now sound, but if the course should also be true about ports, the mesh should be built from routers.

## A star with a hub at the center

This works, in the sandbox and in custom scenarios. A hub-centered star is the textbook physical star, so the layout check accepts any device type as the center. The hub in the middle gets no address and no policies; the PCs around it get both; PC-to-hub links are straight-through; a packet from one PC to another crosses the hub. It is covered by a test (`tests/layer1.test.js`) and by the browser checks.

## Tests

| File | What it covers |
|---|---|
| `tests/layer1.test.js` | The definition, address and policy refusal, mixed selections, auto-assign, old saves, grading ignoring hubs, the revised scenarios' wording, custom scenarios with hubs, imports, packets crossing a hub, and a hub-centered star |
| `tests/scenarios.test.js`, `tests/customScenarios.test.js`, `tests/fixtures.js` | Updated for the revised Scenario 2 and 3 requirements |

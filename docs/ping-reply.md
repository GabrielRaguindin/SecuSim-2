# A ping is answered (Patch 2.4.4)

A ping is a question: "are you there?". When it reaches its target, the target **answers**. SecuSim now sends that answer back across the network, and a ping only counts once the answer arrives. This applies to the **Ping** packet type only. A web request and a file transfer are one-way, as before.

## The three outcomes

| Status | Pill | Meaning |
|---|---|---|
| `answered` | **Answered** (green) | The request arrived, the receiver replied, and the reply got back to the sender. |
| `unanswered` | **No reply** (amber) | The request arrived, but the reply was stopped on its way back. |
| `blocked` | **Blocked** (red) | The request never arrived, so there was nothing to answer. Every earlier failure is unchanged. |

A web request or file transfer that arrives is `delivered` (green), as before.

`result.ok` is true only for `answered` (for a ping) and `delivered` (for the others), so code that asked "did it work?" still gets the right answer.

## What the reply does

The reply is a new packet, sent by the receiver to the original sender. It goes **back along the same route** the request took: the same devices in the opposite order, over the same links. Along the way it meets the same things a request meets, in the same order:

1. **The receiver's own firewall**, as the sender of the reply.
2. **The devices on the way back**, in order. A hub copies the reply out of every other port, and any other device can drop it.
3. **The original sender's firewall**, as the receiver of the reply.

### Which rules apply to a reply

| Policy | Applies to the reply? |
|---|---|
| **Block ping requests** | **No.** It blocks *requests*. A device with it still gets the answers to its own pings. |
| **Restrict outbound traffic** | **Yes.** A device that can't send to another network can't send the reply to one either. This is checked at the receiver (as the reply's sender) and at every device on the way back. |
| **Block untrusted IP** | **Yes.** A reply from another network is dropped by a device that guards its own network. This is checked at every device on the way back and at the original sender. |
| **Allow web traffic, File transfer access** | No. A ping needs no permission, and neither does its answer. |
| QoS, encryption, access control | No, as always. |

Because the rules are checked the same way for the request and the reply, you can build a network where **the ping gets in but the answer can't get out**, and the result says exactly where it stopped:

- A receiver on another network with **Restrict outbound traffic**: "PC 2's firewall blocked the reply."
- A sender with **Block untrusted IP** that pings across a router: the request is fine, and the reply from another network is "dropped on arrival."
- A router with an address on the sender's network and **Block untrusted IP**: it trusts the sender's network, so the request passes, but the reply comes from outside it and is "blocked at Router 1."

## The result

An answered ping reads:

> **Answered in 2 hops each way**
> PC 1 sends a ping to 192.168.1.2. · Hub 1 repeats it out of every other port, to PC 2. · PC 2 receives it. · PC 2 sends a ping reply to 192.168.1.1. · Hub 1 repeats it out of every other port, to PC 1. · PC 1 receives the reply.

A ping with no answer reads, for example:

> **No reply: PC 2's firewall blocked the reply**
> The ping reached PC 2, but the reply didn't make it back. Restrict outbound traffic is on for PC 2, so it can't send the reply to another network. PC 2 is on 10.0.0.0 and PC 1 is on 192.168.1.0.
> **To fix it:** Turn Restrict outbound traffic off for PC 2.

On the canvas the packet travels out, then back. The device where a reply stopped gets the red ring and cross, and an answered ping ends with the green check on the **sender**. Copies a hub made on the way out or back are drawn dashed.

## Decisions worth knowing about

1. **The reply retraces the request's route.** Real replies find their own route. SecuSim sends them back the way the request came, so the devices and links are the same and the learner can follow one path.
2. **The firewalls are stateless.** A reply is checked like any other packet, so a rule that stops traffic arriving from another network stops the reply too. A real *stateful* firewall would let a reply through if it allowed the request out. This is deliberate, because it shows why a reply can be blocked, but it is a simplification.
3. **A reply can't start a storm.** It passes the same hubs the request did, so a hub loop would already have stopped the request.
4. **`path` is still the way the request went.** The reply has its own path, in `reply.path`, ending where it stopped if it was stopped.

## Behavior changes to be aware of

1. A ping that used to say "Delivered" now says "Answered". The words changed; the cases where a ping arrives are the same.
2. **A ping can now fail after arriving.** Networks that used to deliver a ping may now say "No reply" if the receiver can't send to the sender's network, or the sender, or a device on the way back, blocks the reply. The cases where a ping failed before are unchanged.
3. The result log has the reply's lines after the request's.

## Files

| Area | File |
|---|---|
| The reply, its rules, the statuses | `lib/packets.js` (`traceRoute` step 8, `walkRoute`, `transitBlock` with kind `reply`) |
| Pill, colours, the full-journey animation | `components/sandbox/PacketPanel.jsx`, `styles/ui.css`, `styles/workbench.css` |
| Learn page note | `app/(site)/learn/policies/page.jsx` |
| Tests | `tests/ping-reply.test.js` (15 tests, including a 3000-network randomized check against an independent statement of the reply rules) |

## Limits to know about

- There is no real ICMP: no TTL, no latency, no "destination unreachable" message coming back. A packet that is stopped simply stops.
- Only pings are answered. A web request doesn't get a response page.
- A reply doesn't need an address-resolution step, and a router needs no address of its own to forward one.

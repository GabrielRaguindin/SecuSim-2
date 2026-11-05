# Context Information: Network Simulation System Recommendations
## The following features patches were kept in mind to enhance the features, usability, and architecture of SecuSim 2.0:

# IMPLEMENTED PATCHES
## Patch 2.1: Custom Scenarios 
* Users now have the freedom to create custom simulation scenarios.

## Patch 2.2: IP Address Classes and Ethernet Cabling
* Upgraded the IP assignment mechanism to organize devices systematically into IP classes (e.g., Class A, B, C), creating a more realistic networking simulation.
* Implemented configurable network cabling options, allowing users to select between straight-through and crossover Ethernet cables based on specific scenario requirements and device types.

## Patch 2.3: Packet Sending
* Inside the sandbox module, the users are now able to send packets once they finished designing their desired network structure.
## Minor Patches
### [FIX] 2.3.1 — Scenario 1 Topology Correction 
* Scenario 1 is now a ring of 8 PCs with no routers. Only the device counts and the ring change. The policy rules are exactly as the original brief had them: five PCs share files, those five block untrusted IPs, and every device allows web traffic.

### [FIX] 2.3.2 — Hub Logic & Built-in Scenario Revisions 
* Updated Hub's Logic, it is now the one and only device that cannot be assigned an IP Address and Security Policies.
* Revised and replaced the policy requirements for Scenarios 2 and 3 so they make logical sense in a real-world networking context.

## Patch 2.4: Enhance Network Traffic Experience
**Overview:** This update introduces a new networking device, updates hub behavior, expands security policy enforcement across intermediate devices, and clarifies ping request/response dynamics.

### 2.4.1 — New Device Introduced
* **The Switch:** A new networking device on the device dock, placed between the Router and the Hub.
  * It is a managed switch: unlike the Hub, it **can hold an IP address and security policies**, and it can send and receive packets.
  * For cabling it behaves like a hub port: straight-through to PCs, servers and routers, crossover to another switch, a hub or a modem.
  * It delivers a packet only along its route. It never copies a packet to the devices on its other ports, so it stays distinct from the Hub.
  * It is available in the sandbox, the custom scenario builder (as a device count, a rule target and a star center) and the Learn pages.

### 2.4.2 — Hub Behavior Update
* **Strict Broadcaster:** The Hub now operates strictly as a packet broadcaster. It duplicates and sends any incoming packet out through all connected ports except the receiving port, over links with the right cable.
  * A copy stops at any device that isn't a hub. If that device isn't the target, it ignores the packet, and the result says so.
  * **Broadcast storm detection:** if the copies reach a hub they have already reached, the hubs form a loop. The packet stops with a "broadcast storm" result that names every hub in the loop and the link to remove.

### 2.4.3 — Expanded Security Enforcement
* **Intermediate Device Filtering:** Security policies are no longer restricted to the two terminating endpoints. Rules and policies now apply to intermediate devices (Switches, Routers, Modems, Servers and PCs) along the traffic path, in the order the packet meets them. The first device that objects stops the packet, and the result names it.
  * **Blocking rules** stop a packet wherever they are on: Restrict outbound traffic, Block untrusted IP, Block ping requests.
  * **Permissions are default deny:** Allow web traffic and File transfer access must be on at the sender, the receiver and every device in between. A device without the permission won't carry that kind of packet.
  * Hubs can't hold policies, so they never filter and never need a permission.
  * Quality of service, encryption and access-control policies still never affect delivery.

### 2.4.4 — Ping Mechanics
* **Answered Status:** When a ping packet successfully reaches an endpoint, and the reply makes it back, it is marked as **"Answered"**. A ping that arrived but whose reply was stopped is marked **"No reply"**.
* **Request/Response Cycle:** The receiving endpoint device automatically generates and sends a "response" back to the original source following a received "request". The reply goes back along the same route and is checked by the same devices on the way.
  * Block ping requests stops the request, never the reply. Restrict outbound traffic and Block untrusted IP apply to the reply too.

> **Numbering note:** the original 2.4.3 (Targeted Delivery vs. Broadcasting) was dropped, because the Switch and the Hub already behave that way: the Hub copies to everyone and the Switch delivers only along its route. The original 2.4.5 (Expanded Security Enforcement) became 2.4.3.

---

# INCOMING PATCH
## Patch 2.5: Absolute UI Fix and Optimizations
**Reason:** testers found the application hard to use. Everything beside the canvas was overwhelming.

### 1. [HIGH PRIORITY] Sandbox UI Optimization
*(Because putting all the stuff beside the canvas is too overwhelming)*
* Integrate "double click" on the devices and inside it their respective configuration instead of clumping everything on the right side. A modal will appear and in that modal the Device Name, IP Address Setting, and Policies in form of a category dropdown but keeping the toggle switch for each so that it won't be messy and stupidly long.
* Double click a cable and a tooltip will appear bearing the information about the link, the change cable selection and remove link option.
* The only stuff I want to see beside the canvas is the send packet and address plan. All the configuration part including the information and selections must be out of it.

### Delivery plan
Delivered in smaller patches, like 2.4.

**2.5.1: Take configuration out of the sidebar. (Implemented)**
* **Device editor modal:** header with the device icon, an editable name and a one-line description; the IP address and class chips on one row with a single summary line ("Class C, private, 192.168.1.0/24"); four collapsible policy categories, one open at a time, each showing how many are on, with a toggle per policy; Remove device and Done in a pinned footer. Changes apply as you make them, and each can be undone.
* **Link popover** on double-clicking a cable: the link's information, the cable choice and Remove link.
* **Entry points:** double-click or double-tap, Enter on a focused device, E on a selection, and a small Edit / Link / Delete bar beside the selected device (it moves out of the way of neighbouring devices).
* **Sidebar:** only Send a packet and Address plan stay. The simulator keeps its timer and requirements beside the canvas and gets the same editor. The Inspector is deleted and the sidebar is narrower.
* **Rename logic (new):** 1 to 24 characters, unique among devices ignoring case, with the reason shown when a name is refused.
* **Multi-select editing and Select all:** several selected devices open one editor for all their policies, which makes default-deny quick to set up.
* **First-use hints** on the canvas replace the sidebar's tips, one at a time, and are remembered.

**2.5.2: Make what's left fast. (Planned)**
* Labels on the toolbar icons, which are cryptic and have no hover on touch.

**2.5.3: Polish and verify. (Planned)**
* A pass over the simulator, the phone layout and keyboard use, and an optional collapsible sidebar.

**Later (agreed to wait so the patches stay small):**
* **One-click fixes** in the packet result: the "To fix it" line becomes a button the learner chooses to press (turn on a policy, change a cable).
* Changing how links are created (the Link tool and choosing a cable beforehand), which is also confusing but would make 2.5.1 too large to test well.

---

# UPCOMING PATCHES
## [HIGH PRIORITY] Reachability requirements in scenarios:
* Let a scenario say “PC 1 must be able to send a web request to Server 1” and grade it with the same engine. Built-ins and custom scenarios would test whether the network actually works, not only whether it has the right parts.

## Enhanced Results Modal:
* The results modal will not only display the list of completed conditions during the simulation but also the snapshot of the user's network design.

## Enhanced Canvas:
* A Pan-to-Zoom feature for the canvas if the user wishes to create large network models.

---

# FUTURE PATCHES (To be added later)
## User Authentication & Accounts: 
* Introduce user accounts with secure database storage to allow authentication, persistent session management, and the ability for users to save progress and custom configurations.

## Subscription Model & Access Control: 
* Establish a tiered subscription plan. Subscribed users gain full access to detailed simulation results and advanced features, while free/non-subscribed users operate under limited access.

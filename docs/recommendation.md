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

---

# INCOMING PATCH
## Patch 2.4: Enhance Network Traffic Experience
**Overview:** This update introduces a new networking device, updates hub behavior, clarifies ping request/response dynamics, and expands security policy enforcement across intermediate devices.

## Patch Details
### 2.4.1 — New Device Introduced
* **The Switch:** A new networking device to be added on the device dock.

### 2.4.2 — Hub Behavior Update
* **Strict Broadcaster:** The Hub now operates strictly as a packet broadcaster. It duplicates and sends any incoming packet out through all connected ports except the receiving port.

### 2.4.3 — Targeted Delivery vs. Broadcasting
* **Device Selection:** 
  * Use **The Switch** to deliver packets specifically to an intended target endpoint.
  * Use **The Hub** when broadcasting is desired. Remember: the Hub will *always* broadcast incoming packets to every connected endpoint.

### 2.4.4 — Ping Mechanics
* **Answered Status:** When a ping packet successfully reaches an endpoint, it is marked as **"Answered"**.
* **Request/Response Cycle:** The receiving endpoint device will automatically generate and send a "response" back to the original source following a received "request".

### 2.4.5 — Expanded Security Enforcement
* **Intermediate Device Filtering:** Security policies are no longer restricted to the two terminating endpoints. Rules and policies now apply to intermediate devices (e.g., Switches/Routers) along the traffic path.

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

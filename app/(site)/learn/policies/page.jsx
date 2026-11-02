import Link from 'next/link';
import { POLICY_CATEGORIES } from '@/lib/policies.js';

export const metadata = {
  title: 'Learn policies',
  description: 'What access control, quality of service, firewall and encryption policies do.',
};

export default function PoliciesPage() {
  return (
    <div className="sx-lessons">
      <p className="sx-lead sx-lessons__intro">
        A network policy is a rule about what is allowed on a device or a link. In SecuSim you turn policies on for each device, the same way an administrator would.
      </p>
      <p className="sx-body sx-lessons__intro">
        Hubs are the one exception. A hub works at Layer 1: it repeats electrical signals out of every port and never reads an address or a rule, so it can’t hold a policy. Put policies on the routers, PCs and servers around it.
      </p>
      <section className="sx-lesson sx-lesson--policy sx-lesson--stack" aria-labelledby="path-title">
        <div className="sx-lesson__text">
          <h2 id="path-title" className="sx-title-2">Where a rule applies</h2>
          <p className="sx-body">
            A firewall rule works wherever its device sits on a packet’s path, not only at the two ends. When you send a packet in the sandbox, every router, switch or other device it passes through gets a say, in the order the packet meets them, and the first one that objects stops it.
          </p>
        </div>
        <ul className="sx-controls" aria-label="Which rules apply where">
          <li className="sx-controls__item">
            <h3 className="sx-callout sx-controls__name">Rules that block: Restrict outbound traffic, Block untrusted IP, Block ping requests</h3>
            <p className="sx-callout sx-muted">When one of these is on, the device can stop a matching packet, whether it is an end of the journey or just in the middle.</p>
          </li>
          <li className="sx-controls__item">
            <h3 className="sx-callout sx-controls__name">Rules that permit: Allow web traffic, File transfer access</h3>
            <p className="sx-callout sx-muted">These must be on. A web request needs Allow web traffic on the sender, the receiver and every device in between, and a file transfer needs File transfer access the same way. A device that hasn’t been given the permission won’t carry that kind of packet. This is how real firewalls work: nothing is allowed until it is permitted.</p>
          </li>
          <li className="sx-controls__item">
            <h3 className="sx-callout sx-controls__name">Never stops a packet</h3>
            <p className="sx-callout sx-muted">Quality of service and encryption policies change how traffic is treated, not whether it arrives. A hub can’t hold any policy, so it never needs a permission: it just copies everything.</p>
          </li>
        </ul>
      </section>
      {POLICY_CATEGORIES.map((category) => (
        <section key={category.id} className="sx-lesson sx-lesson--policy" aria-labelledby={`${category.id}-title`}>
          <div className="sx-lesson__text">
            <h2 id={`${category.id}-title`} className="sx-title-1">{category.label}</h2>
            <p className="sx-lead">{category.summary}</p>
            <p className="sx-body">{category.detail}</p>
          </div>
          <ul className="sx-controls" aria-label={`${category.label} controls`}>
            {category.policies.map((p) => (
              <li key={p.id} className="sx-controls__item">
                <h3 className="sx-callout sx-controls__name">{p.label}</h3>
                <p className="sx-callout sx-muted">{p.help}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="sx-body">
        Ready to use them? <Link href="/simulator">Try a scenario</Link> or experiment freely in the <Link href="/sandbox">sandbox</Link>.
      </p>
    </div>
  );
}

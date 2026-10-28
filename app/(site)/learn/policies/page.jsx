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

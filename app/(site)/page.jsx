import Link from 'next/link';
import HeroRing from '@/components/home/HeroRing';
import TopologyDiagram from '@/components/learn/TopologyDiagram';
import Icon from '@/components/ui/Icon';
import { SCENARIOS } from '@/lib/scenarios.js';

export default function Home() {
  return (
    <>
      <section className="sx-hero">
        <div className="sx-hero__text">
          <h1 className="sx-display">Build the network. Then defend it.</h1>
          <p className="sx-lead">
            SecuSim is a free sandbox for learning how networks are laid out and how security policies protect them. Drag devices, link them up, and see whether your design holds.
          </p>
          <div className="sx-hero__actions">
            <Link href="/simulator" className="sx-btn sx-btn--primary">Start a scenario</Link>
            <Link href="/sandbox" className="sx-btn">Open the sandbox</Link>
          </div>
        </div>
        <HeroRing />
      </section>

      <section className="sx-page sx-bento" aria-label="Where to start">
        <Link href="/learn/topologies" className="sx-tile sx-tile--wide">
          <div>
            <p className="sx-caption">Learn</p>
            <h2 className="sx-title-2">See how topologies and policies work</h2>
            <p className="sx-body">Send a packet through a ring, a star and a mesh, then read what each security policy actually does.</p>
          </div>
          <div className="sx-tile__art" aria-hidden="true"><TopologyDiagram kind="mesh" compact /></div>
          <span className="sx-tile__go" aria-hidden="true"><Icon name="chevronRight" size={20} /></span>
        </Link>

        <Link href="/sandbox" className="sx-tile">
          <div>
            <p className="sx-caption">Build</p>
            <h2 className="sx-title-2">Sandbox</h2>
            <p className="sx-body">A blank canvas with no clock. Save what you make.</p>
          </div>
          <span className="sx-tile__go" aria-hidden="true"><Icon name="chevronRight" size={20} /></span>
        </Link>

        <Link href="/simulator" className="sx-tile sx-tile--full">
          <div>
            <p className="sx-caption">Simulate</p>
            <h2 className="sx-title-2">Three timed scenarios</h2>
            <p className="sx-body">Each one comes with a short brief and a checklist. Build to spec before the clock runs out.</p>
          </div>
          <ul className="sx-tile__chips">
            {SCENARIOS.map((s) => (
              <li key={s.id} className="sx-pill">{s.short}</li>
            ))}
          </ul>
          <span className="sx-tile__go" aria-hidden="true"><Icon name="chevronRight" size={20} /></span>
        </Link>
      </section>
    </>
  );
}

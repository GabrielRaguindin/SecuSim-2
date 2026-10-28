import Link from 'next/link';
import { IP_CLASSES, IP_CLASS_IDS } from '@/lib/ip.js';

export const metadata = {
  title: 'Learn addressing',
  description: 'IP address classes A, B and C, networks, masks, and the addresses a device can’t use.',
};

const SPECIAL = [
  ['Network address', 'The first address in a network, with every host bit set to 0, such as 192.168.1.0. It names the network, so no device can use it.'],
  ['Broadcast address', 'The last address in a network, with every host bit set to 1, such as 192.168.1.255. A message sent here reaches every device on the network, so no single device can use it.'],
  ['Loopback, 127.x.x.x', 'Points back at the device itself. It is used for testing and never leaves the device.'],
  ['Class D, 224 to 239', 'Reserved for multicast: one message to a group of devices.'],
  ['Class E, 240 to 255', 'Reserved for experiments and future use.'],
];

export default function AddressingPage() {
  return (
    <div className="sx-lessons">
      <p className="sx-lead sx-lessons__intro">
        An IP address names a device on a network. The first number tells you which class the address belongs to, and the class decides how much of the address names the network and how much names the device.
      </p>

      <ul className="sx-classes" aria-label="Address classes">
        {IP_CLASS_IDS.map((id) => {
          const c = IP_CLASSES[id];
          return (
            <li key={id} className="sx-class">
              <p className="sx-class__letter" aria-hidden="true">{id}</p>
              <h2 className="sx-title-2">{c.label}</h2>
              <p className="sx-body">Starts with {c.first[0]} to {c.first[1]}. {c.use}.</p>
              <dl className="sx-facts">
                {[
                  ['Default mask', `${c.mask} (/${c.prefixLength})`],
                  ['Networks', c.networks],
                  ['Devices per network', c.hosts],
                  ['Private range', c.privateRange],
                  ['Example', c.example],
                ].map(([term, detail]) => (
                  <div key={term} className="sx-facts__row sx-facts__row--tight">
                    <dt className="sx-callout">{term}</dt>
                    <dd className="sx-callout sx-muted sx-tnum">{detail}</dd>
                  </div>
                ))}
              </dl>
            </li>
          );
        })}
      </ul>

      <section className="sx-lesson sx-lesson--policy" aria-labelledby="special-title">
        <div className="sx-lesson__text">
          <h2 id="special-title" className="sx-title-1">Addresses a device can’t use</h2>
          <p className="sx-lead">Some addresses do a job of their own.</p>
          <p className="sx-body">SecuSim refuses these when you type them, and tells you why. Pick a class in the inspector for a valid starting address.</p>
        </div>
        <ul className="sx-controls" aria-label="Special addresses">
          {SPECIAL.map(([name, what]) => (
            <li key={name} className="sx-controls__item">
              <h3 className="sx-callout sx-controls__name">{name}</h3>
              <p className="sx-callout sx-muted">{what}</p>
            </li>
          ))}
        </ul>
      </section>

      <p className="sx-body">
        See it on a network in the <Link href="/sandbox">sandbox</Link>: the Address plan panel groups your devices by class and network. Or <Link href="/simulator">try a scenario</Link> that asks for a particular class.
      </p>
    </div>
  );
}

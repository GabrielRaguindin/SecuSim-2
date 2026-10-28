import Link from 'next/link';
import DeviceGlyph from '@/components/ui/DeviceGlyph';
import { CABLES, CABLE_IDS, cableMatrix } from '@/lib/cabling.js';
import { DEVICE_ORDER, DEVICE_TYPES } from '@/lib/devices.js';

export const metadata = {
  title: 'Learn cabling',
  description: 'When to use a straight-through cable and when to use a crossover cable.',
};

export default function CablingPage() {
  const matrix = cableMatrix();
  return (
    <div className="sx-lessons">
      <p className="sx-lead sx-lessons__intro">
        An Ethernet cable carries data on two wire pairs: one to send and one to receive. Whether a link works depends on lining the sending pair of one device up with the receiving pair of the other.
      </p>

      <ul className="sx-classes sx-classes--two" aria-label="Cable types">
        {CABLE_IDS.map((id) => (
          <li key={id} className="sx-class">
            <svg className="sx-cablesketch" viewBox="0 0 160 40" aria-hidden="true">
              <line x1="8" y1="20" x2="152" y2="20" data-cable={id} />
              <circle cx="8" cy="20" r="6" />
              <circle cx="152" cy="20" r="6" />
            </svg>
            <h2 className="sx-title-2">{CABLES[id].label}</h2>
            <p className="sx-body">
              {id === 'straight'
                ? 'The pairs run straight across. Use it to join unlike devices: a device that sends on pins 1 and 2 to one that listens on them.'
                : 'The pairs swap places in the cable. Use it to join like devices, which both send on the same pins.'}
            </p>
            <p className="sx-callout sx-muted">{CABLES[id].help}</p>
          </li>
        ))}
      </ul>

      <section className="sx-lesson sx-lesson--policy sx-lesson--stack" aria-labelledby="matrix-title">
        <div className="sx-lesson__text">
          <h2 id="matrix-title" className="sx-title-1">Which cable, where</h2>
          <p className="sx-lead">PCs, servers and routers send on pins 1 and 2. Hubs and modems listen on them.</p>
          <p className="sx-body">So like devices need a crossover, and unlike devices need a straight-through. In SecuSim you choose the cable for each link, and the inspector tells you if it is the wrong one.</p>
          <p className="sx-caption">Modern equipment often detects the cable type by itself (Auto-MDIX). SecuSim asks you to choose so you learn the rule.</p>
        </div>

        <div className="sx-matrixwrap">
          <table className="sx-matrix">
            <caption className="sx-visually-hidden">The cable needed between each pair of devices</caption>
            <thead>
              <tr>
                <td />
                {DEVICE_ORDER.map((t) => (
                  <th key={t} scope="col">
                    <span className="sx-matrix__dev" data-type={t}><DeviceGlyph type={t} size={18} /></span>
                    <span>{DEVICE_TYPES[t].label}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row) => (
                <tr key={row.type}>
                  <th scope="row">
                    <span className="sx-matrix__dev" data-type={row.type}><DeviceGlyph type={row.type} size={18} /></span>
                    <span>{DEVICE_TYPES[row.type].label}</span>
                  </th>
                  {row.cells.map((cell) => (
                    <td key={cell.type} data-cable={cell.cable}>{CABLES[cell.cable].short}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="sx-body">
        Practice in the <Link href="/sandbox">sandbox</Link>: draw a link, switch the cable with the toolbar or the C key, and watch the warning appear and clear. The built-in scenarios now grade your cables too.
      </p>
    </div>
  );
}

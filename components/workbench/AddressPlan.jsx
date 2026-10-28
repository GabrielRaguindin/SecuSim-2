import { groupByNetwork } from '@/lib/ip.js';

/** Every addressed device, organised by class and network, so the plan reads at a glance. */
export default function AddressPlan({ doc }) {
  if (doc.nodes.length === 0) return null;
  const { groups, unassigned } = groupByNetwork(doc.nodes);

  return (
    <section className="sx-panel sx-plan" aria-label="Address plan">
      <h3 className="sx-title-3">Address plan</h3>
      {groups.length === 0 && <p className="sx-caption">Addresses appear here, grouped by class and network, as you give them to devices.</p>}
      {groups.map((g) => (
        <div key={g.key} className="sx-plan__group">
          <div className="sx-plan__head">
            <span className="sx-pill sx-pill--accent">{g.class ? `Class ${g.class}` : 'Other'}</span>
            {g.network && <span className="sx-callout sx-tnum">{g.network}</span>}
            {g.mask && <span className="sx-caption sx-tnum">{g.mask}</span>}
          </div>
          <ul className="sx-plan__list">
            {g.nodes.map((n) => (
              <li key={n.id}>
                <span>{n.name}</span>
                <span className="sx-tnum sx-muted">{n.ip}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {unassigned.length > 0 && (
        <p className="sx-caption">No address yet: {unassigned.map((n) => n.name).join(', ')}.</p>
      )}
    </section>
  );
}

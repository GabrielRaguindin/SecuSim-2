import TopologyDiagram from '@/components/learn/TopologyDiagram';
import DeviceGlyph from '@/components/ui/DeviceGlyph';
import { DEVICE_ORDER } from '@/lib/devices.js';

/** A picture for a scenario card: the topology when there is one, otherwise the devices it uses. */
export default function ScenarioArt({ kind, devices = {} }) {
  if (kind === 'ring' || kind === 'star' || kind === 'mesh') return <TopologyDiagram kind={kind} compact />;
  const present = DEVICE_ORDER.filter((t) => (devices[t] ?? 0) > 0);
  return (
    <div className="sx-art-grid" data-count={present.length}>
      {present.map((t) => (
        <span key={t} className="sx-art-grid__tile" data-type={t}>
          <DeviceGlyph type={t} size={26} />
        </span>
      ))}
    </div>
  );
}

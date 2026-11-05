'use client';

import Icon from '@/components/ui/Icon';
import { actionBarPlacement } from '@/lib/overlays.js';

const BUTTON_WIDTH = 78;

/**
 * The small bar that floats by whatever is selected, so editing never depends on knowing a gesture:
 * a device offers Edit, Link and Delete, several devices offer Edit and Delete, and a link offers Edit and Delete.
 */
export default function ActionBar({ doc, selection, size, onEditNodes, onEditLink, onLink, onDelete }) {
  const nodes = selection.nodes.map((id) => doc.nodes.find((n) => n.id === id)).filter(Boolean);
  const edge = selection.edge ? doc.edges.find((e) => e.id === selection.edge) : null;

  let points = [];
  let buttons = [];
  let label = 'Selected device';

  if (edge) {
    const a = doc.nodes.find((n) => n.id === edge.a);
    const b = doc.nodes.find((n) => n.id === edge.b);
    if (!a || !b) return null;
    points = [{ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }];
    label = 'Selected link';
    buttons = [
      { id: 'edit', text: 'Edit', icon: 'edit', onClick: () => onEditLink(edge.id) },
      { id: 'delete', text: 'Delete', icon: 'trash', danger: true, onClick: onDelete },
    ];
  } else if (nodes.length > 0) {
    points = nodes.map((n) => ({ x: n.x, y: n.y }));
    if (nodes.length === 1) {
      buttons = [
        { id: 'edit', text: 'Edit', icon: 'edit', onClick: () => onEditNodes([nodes[0].id]) },
        { id: 'link', text: 'Link', icon: 'link', onClick: () => onLink(nodes[0].id) },
        { id: 'delete', text: 'Delete', icon: 'trash', danger: true, onClick: onDelete },
      ];
    } else {
      label = 'Selected devices';
      buttons = [
        { id: 'edit', text: `Edit ${nodes.length}`, icon: 'edit', onClick: () => onEditNodes(nodes.map((n) => n.id)) },
        { id: 'delete', text: 'Delete', icon: 'trash', danger: true, onClick: onDelete },
      ];
    }
  } else {
    return null;
  }

  const width = buttons.length * BUTTON_WIDTH + 12;
  const selected = new Set(selection.nodes);
  const obstacles = doc.nodes.filter((n) => !selected.has(n.id)).map((n) => ({ x: n.x, y: n.y }));
  const place = actionBarPlacement(points, size, { width, height: 44 }, obstacles);

  return (
    <div className="sx-glass sx-actionbar" role="toolbar" aria-label={label} data-placement={place.placement} style={{ left: place.left, top: place.top, width }}>
      {buttons.map((b) => (
        <button key={b.id} type="button" className="sx-actionbar__btn" data-danger={b.danger ? 'true' : undefined} onClick={b.onClick}>
          <Icon name={b.icon} size={16} />
          <span>{b.text}</span>
        </button>
      ))}
    </div>
  );
}

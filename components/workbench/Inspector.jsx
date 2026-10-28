'use client';

import { useEffect, useId, useState } from 'react';
import DeviceGlyph from '@/components/ui/DeviceGlyph';
import Switch from '@/components/ui/Switch';
import Icon from '@/components/ui/Icon';
import { DEVICE_TYPES } from '@/lib/devices.js';
import { POLICY_CATEGORIES } from '@/lib/policies.js';
import { hasPolicy, validateIp } from '@/lib/networkReducer.js';
import { normalizeIp } from '@/lib/ip.js';

function IpField({ node, doc, dispatch, disabled }) {
  const [draft, setDraft] = useState(node.ip);
  const [error, setError] = useState(null);
  const errorId = useId();

  useEffect(() => {
    setDraft(node.ip);
    setError(null);
  }, [node.id, node.ip]);

  const commit = () => {
    const problem = validateIp(doc, node.id, draft);
    setError(problem);
    if (!problem && normalizeIp(draft) !== node.ip) dispatch({ type: 'setIp', id: node.id, ip: draft });
    return !problem;
  };

  return (
    <div className="sx-field">
      <label className="sx-field__label" htmlFor={`ip-${node.id}`}>IP address</label>
      <input
        id={`ip-${node.id}`}
        className="sx-input sx-tnum"
        value={draft}
        placeholder="192.168.1.10"
        inputMode="decimal"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        disabled={disabled}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            if (commit()) e.currentTarget.blur();
          } else if (e.key === 'Escape') {
            setDraft(node.ip);
            setError(null);
            e.currentTarget.blur();
          }
        }}
      />
      {error && <p id={errorId} className="sx-field__error" role="alert">{error}</p>}
    </div>
  );
}

function Policies({ doc, ids, dispatch, disabled }) {
  return (
    <div className="sx-policies">
      {POLICY_CATEGORIES.map((category) => {
        const on = category.policies.filter((p) => ids.some((id) => hasPolicy(doc, id, p.id))).length;
        return (
          <section key={category.id} className="sx-policies__group" aria-label={category.label}>
            <header className="sx-policies__head">
              <h4 className="sx-callout">{category.label}</h4>
              {on > 0 && <span className="sx-caption">{on} on</span>}
            </header>
            <ul>
              {category.policies.map((p) => {
                const count = ids.filter((id) => hasPolicy(doc, id, p.id)).length;
                const state = count === ids.length ? true : count === 0 ? false : 'mixed';
                return (
                  <li key={p.id} className="sx-policy">
                    <div>
                      <p className="sx-callout">{p.label}</p>
                      <p className="sx-caption">{p.help}</p>
                    </div>
                    <Switch
                      checked={state}
                      label={p.label}
                      disabled={disabled}
                      onChange={(next) => dispatch({ type: 'togglePolicy', ids, policy: p.id, on: next })}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export default function Inspector({ doc, selection, dispatch, disabled, onRemoveNodes, onRemoveEdge }) {
  const nodes = selection.nodes.map((id) => doc.nodes.find((n) => n.id === id)).filter(Boolean);
  const edge = selection.edge ? doc.edges.find((e) => e.id === selection.edge) : null;

  if (edge) {
    const a = doc.nodes.find((n) => n.id === edge.a);
    const b = doc.nodes.find((n) => n.id === edge.b);
    return (
      <section className="sx-panel" aria-label="Selected link">
        <h3 className="sx-title-3">Link</h3>
        <p className="sx-body sx-inspector__text">{a?.name} is linked to {b?.name}.</p>
        <button type="button" className="sx-btn sx-btn--danger sx-btn--block" disabled={disabled} onClick={() => onRemoveEdge(edge.id)}>
          <Icon name="trash" size={18} /> Remove link
        </button>
      </section>
    );
  }

  if (nodes.length === 0) {
    return (
      <section className="sx-panel" aria-label="Inspector">
        <h3 className="sx-title-3">Nothing selected</h3>
        <p className="sx-body sx-inspector__text">Select a device to give it an IP address and set its policies.</p>
        <ul className="sx-tips">
          <li><Icon name="plus" size={16} /><span>Drag a device from the dock, or tap one to add it.</span></li>
          <li><Icon name="link" size={16} /><span>Choose the link tool, then drag from one device to another.</span></li>
          <li><Icon name="pointer" size={16} /><span>Shift-click to select several devices and set a policy on all of them.</span></li>
        </ul>
      </section>
    );
  }

  const ids = nodes.map((n) => n.id);
  const single = nodes.length === 1 ? nodes[0] : null;

  return (
    <section className="sx-panel" aria-label="Selected device">
      <header className="sx-inspector__head">
        {single ? (
          <span className="sx-inspector__tile" data-type={single.type}><DeviceGlyph type={single.type} size={26} /></span>
        ) : (
          <span className="sx-inspector__tile sx-inspector__tile--multi">{nodes.length}</span>
        )}
        <div>
          <h3 className="sx-title-3">{single ? single.name : `${nodes.length} devices`}</h3>
          <p className="sx-caption">{single ? DEVICE_TYPES[single.type].blurb : 'Policy changes apply to every selected device.'}</p>
        </div>
      </header>

      {single ? (
        <IpField node={single} doc={doc} dispatch={dispatch} disabled={disabled} />
      ) : (
        <p className="sx-caption">Select a single device to set its IP address.</p>
      )}

      <Policies doc={doc} ids={ids} dispatch={dispatch} disabled={disabled} />

      <button type="button" className="sx-btn sx-btn--danger sx-btn--block" disabled={disabled} onClick={() => onRemoveNodes(ids)}>
        <Icon name="trash" size={18} /> {single ? 'Remove device' : `Remove ${nodes.length} devices`}
      </button>
    </section>
  );
}

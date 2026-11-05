'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Sheet from '@/components/ui/Sheet';
import Switch from '@/components/ui/Switch';
import Icon from '@/components/ui/Icon';
import DeviceGlyph from '@/components/ui/DeviceGlyph';
import { DEVICE_TYPES, canHaveIp } from '@/lib/devices.js';
import { POLICY_CATEGORIES } from '@/lib/policies.js';
import { NAME_MAX, cleanDeviceName, validateIp, validateName } from '@/lib/networkReducer.js';
import { IP_CLASSES, IP_CLASS_IDS, ipClassOf, nextHostIp, normalizeIp } from '@/lib/ip.js';
import { categoryCounts, holderIds, ipSummary, policyState } from '@/lib/deviceEditor.js';
import { pluralize } from '@/lib/format.js';

/** The device's name. It is saved when you leave the field or press Enter, and Escape puts the old one back. */
function NameField({ node, doc, dispatch, disabled }) {
  const [draft, setDraft] = useState(node.name);
  const [error, setError] = useState(null);
  const errorId = useId();
  const cancelled = useRef(false);

  useEffect(() => {
    setDraft(node.name);
    setError(null);
  }, [node.id, node.name]);

  const commit = () => {
    if (cancelled.current) {
      cancelled.current = false; // Escape put the old name back, so the blur that follows must not save the draft
      return true;
    }
    const problem = validateName(doc, node.id, draft);
    setError(problem);
    if (problem) return false;
    const clean = cleanDeviceName(draft);
    setDraft(clean);
    if (clean !== node.name) dispatch({ type: 'rename', id: node.id, name: clean });
    return true;
  };

  return (
    <div className="sx-editor__namefield">
      <input
        className="sx-input sx-editor__name"
        aria-label="Device name"
        value={draft}
        maxLength={NAME_MAX}
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            if (commit()) e.currentTarget.blur();
          } else if (e.key === 'Escape' && (draft !== node.name || error)) {
            // The first Escape only puts the old name back. With nothing to undo, Escape closes the editor as usual.
            e.preventDefault();
            e.stopPropagation();
            cancelled.current = true;
            setDraft(node.name);
            setError(null);
            e.currentTarget.blur();
          }
        }}
      />
      {error && <p id={errorId} className="sx-field__error" role="alert">{error}</p>}
    </div>
  );
}

/** The IP address and its class on one row, with a single line saying what the address is. */
function AddressRow({ node, doc, dispatch, disabled }) {
  const [draft, setDraft] = useState(node.ip);
  const [error, setError] = useState(null);
  const inputId = useId();
  const errorId = useId();
  const cancelled = useRef(false);
  const current = ipClassOf(node.ip);

  useEffect(() => {
    setDraft(node.ip);
    setError(null);
  }, [node.id, node.ip]);

  const commit = () => {
    if (cancelled.current) {
      cancelled.current = false; // Escape put the old address back, so the blur that follows must not save the draft
      return true;
    }
    const problem = validateIp(doc, node.id, draft);
    setError(problem);
    if (!problem && normalizeIp(draft) !== node.ip) dispatch({ type: 'setIp', id: node.id, ip: draft });
    return !problem;
  };

  const pick = (cls) => {
    if (current === cls) return;
    const taken = doc.nodes.filter((n) => n.id !== node.id).map((n) => n.ip).filter(Boolean);
    const ip = nextHostIp(taken, cls);
    if (ip) dispatch({ type: 'setIp', id: node.id, ip });
  };

  return (
    <section className="sx-editor__section" aria-label="Address">
      <label className="sx-field__label" htmlFor={inputId}>IP address</label>
      <div className="sx-editor__iprow">
        <input
          id={inputId}
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
            } else if (e.key === 'Escape' && (normalizeIp(draft) !== node.ip || error)) {
              // The first Escape only puts the old address back. With nothing to undo, Escape closes the editor as usual.
              e.preventDefault();
              e.stopPropagation();
              cancelled.current = true;
              setDraft(node.ip);
              setError(null);
              e.currentTarget.blur();
            }
          }}
        />
        <div className="sx-chips" role="group" aria-label="Address class">
          {IP_CLASS_IDS.map((cls) => (
            <button key={cls} type="button" className="sx-chip" data-on={current === cls} aria-pressed={current === cls} disabled={disabled} title={IP_CLASSES[cls].use} onClick={() => pick(cls)}>
              <span>{IP_CLASSES[cls].label}</span>
            </button>
          ))}
        </div>
      </div>
      {error ? (
        <p id={errorId} className="sx-field__error" role="alert">{error}</p>
      ) : (
        <p className="sx-caption sx-tnum">{ipSummary(node.ip) ?? 'Type an address, or pick a class for a starting one.'}</p>
      )}
    </section>
  );
}

function Layer1Note() {
  return (
    <div className="sx-layer1">
      <p className="sx-callout"><strong>A Layer 1 device</strong></p>
      <p className="sx-caption">A hub copies every signal it receives out of all its other ports, to everyone. It never reads an address or a rule, so it has no IP address and can’t hold policies. There is nothing else to set here.</p>
    </div>
  );
}

/** Four categories, one open at a time, each saying how many of its policies are on. */
function PolicyAccordion({ doc, ids, dispatch, disabled }) {
  const [open, setOpen] = useState(null);
  const base = useId();
  const holders = holderIds(doc, ids);
  const counts = categoryCounts(doc, ids);

  return (
    <section className="sx-editor__section" aria-label="Policies">
      <h3 className="sx-field__label">Policies</h3>
      <div className="sx-acc">
        {POLICY_CATEGORIES.map((category) => {
          const row = counts.find((c) => c.id === category.id);
          const isOpen = open === category.id;
          const panelId = `${base}-${category.id}`;
          return (
            <div key={category.id} className="sx-acc__item" data-open={isOpen}>
              <h4 className="sx-acc__title">
                <button type="button" className="sx-acc__head" aria-expanded={isOpen} aria-controls={panelId} onClick={() => setOpen(isOpen ? null : category.id)}>
                  <span className="sx-acc__label">{category.label}</span>
                  <span className="sx-pill" data-count={row.on} data-tone={row.on > 0 ? 'on' : 'off'}>{row.on} of {row.total} on</span>
                  <span className="sx-acc__chevron" aria-hidden="true"><Icon name="chevronDown" size={18} /></span>
                </button>
              </h4>
              {isOpen && (
                <ul id={panelId} className="sx-acc__body">
                  {category.policies.map((p) => (
                    <li key={p.id} className="sx-policy">
                      <div>
                        <p className="sx-callout">{p.label}</p>
                        <p className="sx-caption">{p.help}</p>
                      </div>
                      <Switch
                        checked={policyState(doc, ids, p.id)}
                        label={p.label}
                        disabled={disabled}
                        onChange={(next) => dispatch({ type: 'togglePolicy', ids: holders, policy: p.id, on: next })}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Everything about one device, or the policies of several, in one place:
 * a name, an address and four collapsible categories of policies.
 * Every change is applied as you make it and is one step in the undo history.
 */
export default function DeviceEditor({ open, ids, doc, dispatch, disabled, onClose, onRemove }) {
  const nodes = ids.map((id) => doc.nodes.find((n) => n.id === id)).filter(Boolean);
  const single = nodes.length === 1 ? nodes[0] : null;
  const holders = holderIds(doc, ids);

  const title = single ? `Edit ${single.name}` : `Edit ${pluralize(nodes.length, 'device')}`;
  const header = single ? (
    <div className="sx-editor__head">
      <span className="sx-editor__tile" data-type={single.type}><DeviceGlyph type={single.type} size={26} /></span>
      <div className="sx-editor__who">
        <NameField node={single} doc={doc} dispatch={dispatch} disabled={disabled} />
        <p className="sx-caption">{DEVICE_TYPES[single.type].blurb}</p>
      </div>
    </div>
  ) : (
    <div className="sx-editor__head">
      <span className="sx-editor__tile sx-editor__tile--multi" aria-hidden="true">{nodes.length}</span>
      <div className="sx-editor__who">
        <h2 className="sx-title-3">{pluralize(nodes.length, 'device')}</h2>
        <p className="sx-caption">Policy changes apply to every selected device. Hubs are skipped, because they can’t hold policies.</p>
      </div>
    </div>
  );

  return (
    <Sheet open={open && nodes.length > 0} onClose={onClose} title={title} header={header}>
      <div className="sx-editor">
        {single && canHaveIp(single.type) && <AddressRow node={single} doc={doc} dispatch={dispatch} disabled={disabled} />}
        {holders.length > 0 ? <PolicyAccordion key={ids.join(',')} doc={doc} ids={ids} dispatch={dispatch} disabled={disabled} /> : <Layer1Note />}
      </div>
      <div className="sx-sheet__actions sx-editor__actions">
        <button type="button" className="sx-btn sx-btn--danger" disabled={disabled} onClick={() => onRemove(ids)}>
          <Icon name="trash" size={18} /> {single ? 'Remove device' : `Remove ${nodes.length} devices`}
        </button>
        <button type="button" className="sx-btn sx-btn--primary" onClick={onClose} data-autofocus="">Done</button>
      </div>
    </Sheet>
  );
}

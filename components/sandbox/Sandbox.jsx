'use client';

import { useEffect, useRef, useState } from 'react';
import Workbench from '@/components/workbench/Workbench';
import Sheet from '@/components/ui/Sheet';
import Icon from '@/components/ui/Icon';
import { useNetwork } from '@/components/hooks.js';
import { useToast } from '@/components/ui/Toast';
import { DEVICE_ORDER } from '@/lib/devices.js';
import { cleanName, deleteTopology, listTopologies, loadTopology, saveTopology, topologyExists, MAX_NAME_LENGTH } from '@/lib/storage.js';
import { formatDate, pluralize } from '@/lib/format.js';

function Library({ open, onClose, doc, loadDoc, toast }) {
  const [name, setName] = useState('');
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(null);

  useEffect(() => {
    if (!open) return;
    setItems(listTopologies());
    setError(null);
    setConfirming(null);
  }, [open]);

  const replacing = name.trim() !== '' && topologyExists(name);
  const empty = doc.nodes.length === 0;

  const save = () => {
    const result = saveTopology(name, doc);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setItems(listTopologies());
    setName('');
    setError(null);
    toast.show(`Saved “${result.name}”.`);
  };

  const open_ = (item) => {
    const saved = loadTopology(item.name);
    if (!saved) {
      setError(`“${item.name}” couldn’t be opened.`);
      return;
    }
    loadDoc(saved);
    onClose();
    toast.show(`Opened “${item.name}”.`);
  };

  const remove = (item) => {
    deleteTopology(item.name);
    setItems(listTopologies());
    setConfirming(null);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Library">
      <p className="sx-body">Save the network on your canvas, or open one you saved earlier. Topologies stay in this browser.</p>

      <div className="sx-library__save">
        <div className="sx-field">
          <label className="sx-field__label" htmlFor="topology-name">Name</label>
          <input
            id="topology-name"
            className="sx-input"
            value={name}
            maxLength={MAX_NAME_LENGTH}
            placeholder="Office ring"
            autoComplete="off"
            aria-invalid={error ? 'true' : undefined}
            onChange={(e) => { setName(e.target.value); setError(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !empty) save(); }}
          />
          {error && <p className="sx-field__error" role="alert">{error}</p>}
          {!error && replacing && <p className="sx-field__hint">Saving will replace the existing “{cleanName(name)}”.</p>}
          {!error && empty && <p className="sx-field__hint">Add some devices to the canvas first.</p>}
        </div>
        <button type="button" className="sx-btn sx-btn--primary" onClick={save} disabled={empty || name.trim() === ''}>
          {replacing ? 'Replace' : 'Save'}
        </button>
      </div>

      <h3 className="sx-title-3 sx-library__heading">Saved</h3>
      {items.length === 0 ? (
        <p className="sx-caption">Nothing saved yet.</p>
      ) : (
        <ul className="sx-library__list">
          {items.map((item) => (
            <li key={item.name} className="sx-library__item">
              <div>
                <p className="sx-callout sx-library__name">{item.name}</p>
                <p className="sx-caption">{pluralize(item.devices, 'device')}, {formatDate(item.updatedAt)}</p>
              </div>
              {confirming === item.name ? (
                <div className="sx-library__actions">
                  <button type="button" className="sx-btn sx-btn--sm sx-btn--danger" onClick={() => remove(item)}>Delete</button>
                  <button type="button" className="sx-btn sx-btn--sm" onClick={() => setConfirming(null)}>Keep</button>
                </div>
              ) : (
                <div className="sx-library__actions">
                  <button type="button" className="sx-btn sx-btn--sm sx-btn--tint" onClick={() => open_(item)}>Open</button>
                  <button type="button" className="sx-iconbtn" aria-label={`Delete ${item.name}`} onClick={() => setConfirming(item.name)}>
                    <Icon name="trash" size={18} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

export default function Sandbox() {
  const net = useNetwork();
  const toast = useToast();
  const controller = useRef(null);
  const [libraryOpen, setLibraryOpen] = useState(false);

  return (
    <>
      <Workbench
        net={net}
        toast={toast}
        palette={DEVICE_ORDER}
        controllerRef={controller}
        toolbarExtra={
          <>
            <span className="sx-toolbar__divider" aria-hidden="true" />
            <button type="button" className="sx-btn sx-btn--sm sx-btn--tint" onClick={() => setLibraryOpen(true)}>
              <Icon name="folder" size={18} /> Library
            </button>
          </>
        }
      />
      <Library
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        doc={net.doc}
        loadDoc={(d) => controller.current?.loadDoc(d)}
        toast={toast}
      />
    </>
  );
}

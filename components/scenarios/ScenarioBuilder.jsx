'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import Segmented from '@/components/ui/Segmented';
import Stepper from '@/components/ui/Stepper';
import Switch from '@/components/ui/Switch';
import DeviceGlyph from '@/components/ui/DeviceGlyph';
import { ToastRegion, useToast } from '@/components/ui/Toast';
import { DEVICE_ORDER, DEVICE_TYPES } from '@/lib/devices.js';
import { POLICY_CATEGORIES } from '@/lib/policies.js';
import { IP_CLASSES } from '@/lib/ip.js';
import {
  LAYOUTS, LIMITS, RULE_KINDS, compileScenario, emptySpec, ruleLabel, totalDevices, validateSpec,
} from '@/lib/customScenarios.js';
import { deleteCustomScenario, getCustomScenario, saveCustomScenario } from '@/lib/storage.js';
import { formatClock } from '@/lib/format.js';

const TIME_PRESETS = [3, 5, 8, 10, 15];

function PolicyOptions() {
  return POLICY_CATEGORIES.map((category) => (
    <optgroup key={category.id} label={category.label}>
      {category.policies.map((p) => (
        <option key={p.id} value={p.id}>{p.label}</option>
      ))}
    </optgroup>
  ));
}

function Group({ title, hint, aside, children }) {
  return (
    <section className="sx-group">
      <header className="sx-group__head">
        <div>
          <h2 className="sx-title-3">{title}</h2>
          {hint && <p className="sx-caption">{hint}</p>}
        </div>
        {aside}
      </header>
      <div className="sx-group__body">{children}</div>
    </section>
  );
}

function RuleCard({ rule, spec, error, onChange, onRemove }) {
  const info = RULE_KINDS.find((k) => k.id === rule.kind);
  const visibleTypes = DEVICE_ORDER.filter((t) => spec.devices[t] > 0 || rule.types.includes(t));

  const changeKind = (kind) => {
    const next = RULE_KINDS.find((k) => k.id === kind);
    const types = next.needsTypes && rule.types.length === 0 ? DEVICE_ORDER.filter((t) => spec.devices[t] > 0).slice(0, 1) : rule.types;
    onChange({ kind, types });
  };
  const toggleType = (type) =>
    onChange({ types: rule.types.includes(type) ? rule.types.filter((t) => t !== type) : [...rule.types, type] });

  return (
    <li className="sx-rule" data-invalid={Boolean(error)}>
      <div className="sx-rule__grid">
        <label className="sx-field">
          <span className="sx-field__label">Policy</span>
          <select className="sx-select" value={rule.policy} onChange={(e) => onChange({ policy: e.target.value })}>
            <PolicyOptions />
          </select>
        </label>
        <label className="sx-field">
          <span className="sx-field__label">Applies to</span>
          <select className="sx-select" value={rule.kind} onChange={(e) => changeKind(e.target.value)}>
            {RULE_KINDS.map((k) => (
              <option key={k.id} value={k.id}>{k.label}</option>
            ))}
          </select>
        </label>
      </div>

      {info.needsTypes && (
        <fieldset className="sx-rule__types">
          <legend className="sx-field__label">Device types</legend>
          <div className="sx-chips">
            {visibleTypes.length === 0 && <span className="sx-caption">Add devices above first.</span>}
            {visibleTypes.map((t) => (
              <label key={t} className="sx-chip" data-on={rule.types.includes(t)}>
                <input type="checkbox" className="sx-visually-hidden" checked={rule.types.includes(t)} onChange={() => toggleType(t)} />
                <DeviceGlyph type={t} size={16} />
                <span>{DEVICE_TYPES[t].plural}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {info.needsCount && (
        <div className="sx-field">
          <span className="sx-field__label">How many</span>
          <Stepper label="number of devices" value={rule.count} min={1} max={LIMITS.devices} onChange={(count) => onChange({ count })} />
        </div>
      )}

      {info.needsRequires && (
        <label className="sx-field">
          <span className="sx-field__label">When a device has</span>
          <select className="sx-select" value={rule.requires} onChange={(e) => onChange({ requires: e.target.value })}>
            <option value="">Choose a policy</option>
            <PolicyOptions />
          </select>
        </label>
      )}

      <div className="sx-rule__foot">
        <p className="sx-caption sx-rule__label">{ruleLabel(spec, rule)}</p>
        <button type="button" className="sx-iconbtn" onClick={onRemove} aria-label="Remove this rule">
          <Icon name="trash" size={18} />
        </button>
      </div>
      {error && <p className="sx-field__error" role="alert">{error}</p>}
    </li>
  );
}

export default function ScenarioBuilder({ scenarioId = null }) {
  const router = useRouter();
  const toast = useToast();
  const [draft, setDraft] = useState(emptySpec);
  const [status, setStatus] = useState(scenarioId ? 'loading' : 'ready');
  const [submitted, setSubmitted] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!scenarioId) return;
    const found = getCustomScenario(scenarioId);
    if (found) {
      setDraft(found);
      setStatus('ready');
    } else {
      setStatus('missing');
    }
  }, [scenarioId]);

  const check = useMemo(() => validateSpec(draft), [draft]);
  const preview = useMemo(() => compileScenario(check.spec), [check.spec]);
  const total = totalDevices(check.spec);
  const minutes = Math.round(draft.timeLimit / 60);
  const show = (message) => (submitted ? message : undefined);

  const patch = (changes) => setDraft((d) => ({ ...d, ...changes }));
  const setDevice = (type, n) => setDraft((d) => ({ ...d, devices: { ...d.devices, [type]: n } }));
  const updateRule = (id, changes) => setDraft((d) => ({ ...d, rules: d.rules.map((r) => (r.id === id ? { ...r, ...changes } : r)) }));
  const removeRule = (id) => setDraft((d) => ({ ...d, rules: d.rules.filter((r) => r.id !== id) }));
  const addRule = () =>
    setDraft((d) => {
      if (d.rules.length >= LIMITS.rules) return d;
      const id = `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
      return { ...d, rules: [...d.rules, { id, policy: 'allowWeb', kind: 'all', types: [], count: 1, requires: '' }] };
    });

  const submit = (next) => {
    setSubmitted(true);
    setSaveError(null);
    if (!check.ok) {
      document.getElementById('builder-problems')?.focus();
      return;
    }
    const result = saveCustomScenario(draft);
    if (!result.ok) {
      setSaveError(result.error);
      return;
    }
    router.push(next === 'try' ? `/simulator/${result.spec.id}` : '/simulator');
  };

  const remove = () => {
    deleteCustomScenario(scenarioId);
    router.push('/simulator');
  };

  if (status === 'loading') {
    return (
      <div className="sx-page">
        <p className="sx-body" aria-busy="true">Loading…</p>
      </div>
    );
  }

  if (status === 'missing') {
    return (
      <div className="sx-page">
        <div className="sx-empty">
          <h1 className="sx-title-1">That scenario isn’t here</h1>
          <p className="sx-body">Custom scenarios are kept in the browser that made them. It may have been deleted, or it was made somewhere else.</p>
          <Link href="/simulator" className="sx-btn sx-btn--primary">All scenarios</Link>
        </div>
      </div>
    );
  }

  const problems = [...check.list, saveError].filter(Boolean);

  return (
    <div className="sx-page">
      <header className="sx-pagehead">
        <Link href="/simulator" className="sx-btn sx-btn--plain sx-btn--sm">
          <Icon name="arrowLeft" size={16} /> Scenarios
        </Link>
        <h1 className="sx-display">{scenarioId ? 'Edit scenario' : 'New scenario'}</h1>
        <p className="sx-lead">
          Describe the network you want someone to build. SecuSim turns it into a checklist, times the attempt, and grades it.
        </p>
      </header>

      <div className="sx-builder">
        <form className="sx-builder__form" onSubmit={(e) => e.preventDefault()} noValidate>
          {submitted && problems.length > 0 && (
            <div id="builder-problems" className="sx-problems" role="alert" tabIndex={-1}>
              <p className="sx-callout"><strong>Fix this before saving</strong></p>
              <ul>
                {problems.map((p) => <li key={p} className="sx-callout">{p}</li>)}
              </ul>
            </div>
          )}

          <Group title="The brief">
            <div className="sx-field">
              <label className="sx-field__label" htmlFor="sc-title">Title</label>
              <input
                id="sc-title"
                className="sx-input"
                value={draft.title}
                maxLength={LIMITS.titleMax}
                placeholder="Lab network for the chemistry department"
                autoComplete="off"
                aria-invalid={show(check.errors.title) ? 'true' : undefined}
                onChange={(e) => patch({ title: e.target.value })}
              />
              {show(check.errors.title) && <p className="sx-field__error">{check.errors.title}</p>}
            </div>
            <div className="sx-field">
              <label className="sx-field__label" htmlFor="sc-story">Story <span className="sx-muted">(optional)</span></label>
              <textarea
                id="sc-story"
                className="sx-input sx-textarea"
                rows={3}
                value={draft.story}
                maxLength={LIMITS.storyMax}
                placeholder="Who needs this network, and why?"
                onChange={(e) => patch({ story: e.target.value })}
              />
            </div>
            <div className="sx-field">
              <label className="sx-field__label" htmlFor="sc-goal">Goal <span className="sx-muted">(optional, written for you if left empty)</span></label>
              <input
                id="sc-goal"
                className="sx-input"
                value={draft.goal}
                maxLength={LIMITS.goalMax}
                autoComplete="off"
                onChange={(e) => patch({ goal: e.target.value })}
              />
            </div>
            <div className="sx-field">
              <span className="sx-field__label">Time limit</span>
              <div className="sx-time">
                <div className="sx-chips">
                  {TIME_PRESETS.map((m) => (
                    <button key={m} type="button" className="sx-chip" data-on={minutes === m} aria-pressed={minutes === m} onClick={() => patch({ timeLimit: m * 60 })}>
                      <span>{m} min</span>
                    </button>
                  ))}
                </div>
                <Stepper label="minutes" value={minutes} min={LIMITS.timeMin / 60} max={LIMITS.timeMax / 60} format={(m) => `${m} min`} onChange={(m) => patch({ timeLimit: m * 60 })} />
              </div>
            </div>
          </Group>

          <Group
            title="Devices"
            hint="Exactly this many of each. The attempt fails if there are more or fewer."
            aside={<span className="sx-pill sx-tnum">{total} {total === 1 ? 'device' : 'devices'}</span>}
          >
            <ul className="sx-devrows">
              {DEVICE_ORDER.map((t) => (
                <li key={t} className="sx-devrow">
                  <span className="sx-devrow__tile" data-type={t}><DeviceGlyph type={t} size={22} /></span>
                  <div className="sx-devrow__text">
                    <p className="sx-callout"><strong>{DEVICE_TYPES[t].label}</strong></p>
                    <p className="sx-caption">{DEVICE_TYPES[t].blurb}</p>
                  </div>
                  <Stepper label={`${DEVICE_TYPES[t].plural}`} value={draft.devices[t]} min={0} max={LIMITS.perType} onChange={(n) => setDevice(t, n)} />
                </li>
              ))}
            </ul>
            {show(check.errors.devices) && <p className="sx-field__error" role="alert">{check.errors.devices}</p>}
          </Group>

          <Group title="Layout" hint={LAYOUTS.find((l) => l.id === draft.layout.kind).help}>
            <Segmented
              label="Network layout"
              options={LAYOUTS.map((l) => ({ value: l.id, label: l.label }))}
              value={draft.layout.kind}
              onChange={(kind) => patch({ layout: { ...draft.layout, kind } })}
            />
            {draft.layout.kind === 'star' && (
              <label className="sx-field">
                <span className="sx-field__label">Center of the star</span>
                <select className="sx-select" value={draft.layout.center} onChange={(e) => patch({ layout: { ...draft.layout, center: e.target.value } })}>
                  {DEVICE_ORDER.map((t) => <option key={t} value={t}>{DEVICE_TYPES[t].label}</option>)}
                </select>
              </label>
            )}
            {draft.layout.kind === 'mesh' && total >= 3 && (
              <p className="sx-caption">A mesh of {total} devices needs {(total * (total - 1)) / 2} links.</p>
            )}
            {show(check.errors.layout) && <p className="sx-field__error" role="alert">{check.errors.layout}</p>}
          </Group>

          <Group title="Addresses and cables" hint="Grade how the devices are addressed and wired.">
            <div className="sx-switchrow">
              <div>
                <p className="sx-callout"><strong>Every device needs its own IP address</strong></p>
                <p className="sx-caption">Turn this off if the exercise is only about links and policies.</p>
              </div>
              <Switch label="Require IP addresses" checked={draft.requireIps} onChange={(on) => patch({ requireIps: on })} />
            </div>
            {draft.requireIps && (
              <>
                <div className="sx-field">
                  <span className="sx-field__label">Address class</span>
                  <Segmented
                    label="Address class"
                    options={[{ value: 'any', label: 'Any' }, ...Object.values(IP_CLASSES).map((c) => ({ value: c.id, label: c.label }))]}
                    value={draft.ipClass}
                    onChange={(ipClass) => patch({ ipClass })}
                  />
                  <p className="sx-caption">
                    {draft.ipClass === 'any'
                      ? 'Any valid address will do.'
                      : `Every address must begin with ${IP_CLASSES[draft.ipClass].first[0]} to ${IP_CLASSES[draft.ipClass].first[1]}. ${IP_CLASSES[draft.ipClass].use}.`}
                  </p>
                </div>
                <div className="sx-switchrow">
                  <div>
                    <p className="sx-callout"><strong>All devices on the same network</strong></p>
                    <p className="sx-caption">Their addresses must share one network number, using each class’s default mask.</p>
                  </div>
                  <Switch label="Require one network" checked={draft.sameNetwork} onChange={(on) => patch({ sameNetwork: on })} />
                </div>
              </>
            )}
            <div className="sx-switchrow">
              <div>
                <p className="sx-callout"><strong>Use the right cable on every link</strong></p>
                <p className="sx-caption">Straight-through between unlike devices, crossover between like ones. Needs a layout, so there are links to check.</p>
              </div>
              <Switch label="Require the right cables" checked={draft.requireCabling} onChange={(on) => patch({ requireCabling: on })} />
            </div>
          </Group>

          <Group
            title="Policy rules"
            hint="Each rule becomes one requirement. Add as many as the exercise needs."
            aside={<span className="sx-pill sx-tnum">{draft.rules.length} of {LIMITS.rules}</span>}
          >
            {draft.rules.length === 0 ? (
              <p className="sx-caption">No rules yet. A scenario without rules is graded on devices, layout and addresses alone.</p>
            ) : (
              <ul className="sx-rules">
                {draft.rules.map((rule) => (
                  <RuleCard
                    key={rule.id}
                    rule={rule}
                    spec={check.spec}
                    error={show(check.errors.rules[rule.id])}
                    onChange={(changes) => updateRule(rule.id, changes)}
                    onRemove={() => removeRule(rule.id)}
                  />
                ))}
              </ul>
            )}
            <button type="button" className="sx-btn sx-btn--tint" onClick={addRule} disabled={draft.rules.length >= LIMITS.rules}>
              <Icon name="plus" size={18} /> Add a rule
            </button>
          </Group>

          <div className="sx-builder__actions">
            <button type="button" className="sx-btn sx-btn--primary" onClick={() => submit('try')}>
              <Icon name="play" size={16} strokeWidth={2.2} /> Save and try it
            </button>
            <button type="button" className="sx-btn" onClick={() => submit('save')}>Save</button>
            <Link href="/simulator" className="sx-btn sx-btn--plain">Cancel</Link>
            {scenarioId && (confirmDelete ? (
              <span className="sx-builder__confirm">
                <button type="button" className="sx-btn sx-btn--danger" onClick={remove}>Delete for good</button>
                <button type="button" className="sx-btn sx-btn--plain" onClick={() => setConfirmDelete(false)}>Keep it</button>
              </span>
            ) : (
              <button type="button" className="sx-btn sx-btn--danger sx-builder__delete" onClick={() => setConfirmDelete(true)}>
                <Icon name="trash" size={16} /> Delete
              </button>
            ))}
          </div>
        </form>

        <aside className="sx-builder__preview" aria-label="Preview">
          <div className="sx-panel">
            <p className="sx-caption">Preview</p>
            <h2 className="sx-title-3">{preview.title}</h2>
            <div className="sx-scenario__meta">
              <span className="sx-pill sx-pill--accent">Custom scenario</span>
              <span className="sx-pill"><Icon name="clock" size={14} /> {formatClock(preview.timeLimit)}</span>
            </div>
            <p className="sx-callout sx-muted">{preview.goal}</p>

            <h3 className="sx-callout sx-session__heading">Requirements</h3>
            <ol className="sx-reqs">
              {preview.checks.map((c) => (
                <li key={c.id} className="sx-req" data-state="unchecked">
                  <span className="sx-req__mark" aria-hidden="true" />
                  <span className="sx-caption sx-req__text">{c.label}</span>
                </li>
              ))}
            </ol>

            {check.ok ? (
              <p className="sx-status sx-status--ok" role="status">
                <Icon name="check" size={16} strokeWidth={2.6} /> A network exists that meets every requirement.
              </p>
            ) : (
              <div className="sx-status" role="status">
                <p className="sx-caption"><strong>Still to sort out</strong></p>
                <ul>
                  {check.list.map((p) => <li key={p} className="sx-caption">{p}</li>)}
                </ul>
              </div>
            )}
          </div>
        </aside>
      </div>
      <ToastRegion toast={toast.toast} onHide={toast.hide} />
    </div>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import Segmented from '@/components/ui/Segmented';
import { usePrefersReducedMotion } from '@/components/hooks.js';
import { PACKET_KINDS, PACKET_ORDER, canBeEndpoint, traceRoute } from '@/lib/packets.js';

const STEP_MS = 650;
const SETTLE_MS = 450;

const makeTrace = (result, step, done) => ({
  path: result.path,
  step,
  done,
  ok: result.ok,
  failNode: result.failure?.nodeId ?? null,
  failEdge: result.failure?.edgeId ?? null,
});

/**
 * Send a packet across the network you built. It arrives only if the network is set up right,
 * and when it doesn't, it stops where the problem is and says why.
 */
export default function PacketPanel({ doc, onTrace }) {
  const reduced = usePrefersReducedMotion();
  const endpoints = useMemo(() => doc.nodes.filter((n) => canBeEndpoint(n.type)), [doc.nodes]);
  const [picks, setPicks] = useState({ from: '', to: '' });
  const [kind, setKind] = useState('ping');
  const [run, setRun] = useState(null); // { result, signature }
  const [sending, setSending] = useState(false);
  const [cleared, setCleared] = useState(false);
  const timers = useRef([]);

  // The picks stay valid as devices come and go.
  const fromId = endpoints.some((n) => n.id === picks.from) ? picks.from : endpoints[0]?.id ?? '';
  const toId = endpoints.some((n) => n.id === picks.to) && picks.to !== fromId ? picks.to : endpoints.find((n) => n.id !== fromId)?.id ?? '';

  // What a packet depends on. Moving a device around doesn't change the answer, so it isn't in here.
  const signature = useMemo(
    () => JSON.stringify([doc.edges.map((e) => [e.id, e.cable]), doc.nodes.map((n) => [n.id, n.type, n.ip]), doc.policies]),
    [doc.edges, doc.nodes, doc.policies]
  );

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  // Change the network and the last result no longer applies.
  useEffect(() => {
    if (run && run.signature !== signature) {
      clearTimers();
      setRun(null);
      setSending(false);
      setCleared(true);
      onTrace(null);
    }
  }, [signature, run, onTrace, clearTimers]);

  const send = () => {
    clearTimers();
    const result = traceRoute(doc, fromId, toId, kind);
    const last = result.path.length - 1;
    setRun({ result, signature });
    setCleared(false);

    if (reduced) {
      onTrace(makeTrace(result, Math.max(0, last), true));
      setSending(false);
      return;
    }
    setSending(true);
    onTrace(makeTrace(result, 0, false));
    for (let i = 1; i <= last; i += 1) {
      timers.current.push(window.setTimeout(() => onTrace(makeTrace(result, i, false)), STEP_MS * i));
    }
    timers.current.push(
      window.setTimeout(() => {
        onTrace(makeTrace(result, Math.max(0, last), true));
        setSending(false);
      }, STEP_MS * Math.max(0, last) + SETTLE_MS)
    );
  };

  const swap = () => setPicks({ from: toId, to: fromId });
  const result = run?.result ?? null;
  const done = Boolean(result) && !sending;
  const label = (n) => (n.ip ? n.name : `${n.name} (no address)`);
  const sender = endpoints.find((n) => n.id === fromId);
  const receiver = endpoints.find((n) => n.id === toId);

  return (
    <section className="sx-panel sx-packet-panel" aria-label="Send a packet">
      <header>
        <h3 className="sx-title-3">Send a packet</h3>
        <p className="sx-caption">It only arrives if the network is set up right.</p>
      </header>

      {endpoints.length < 2 ? (
        <p className="sx-caption">Add at least two devices that can send and receive (a PC, server, router or modem), link them, and give them addresses.</p>
      ) : (
        <>
          <div className="sx-packet-panel__pair">
            <label className="sx-field">
              <span className="sx-field__label">From</span>
              <select className="sx-select" value={fromId} onChange={(e) => setPicks({ from: e.target.value, to: toId })}>
                {endpoints.map((n) => <option key={n.id} value={n.id}>{label(n)}</option>)}
              </select>
            </label>
            <button type="button" className="sx-iconbtn sx-packet-panel__swap" onClick={swap} aria-label="Swap sender and receiver" title="Swap">
              <Icon name="repeat" size={18} />
            </button>
            <label className="sx-field">
              <span className="sx-field__label">To</span>
              <select className="sx-select" value={toId} onChange={(e) => setPicks({ from: fromId, to: e.target.value })}>
                {endpoints.filter((n) => n.id !== fromId).map((n) => <option key={n.id} value={n.id}>{label(n)}</option>)}
              </select>
            </label>
          </div>

          {sender && receiver && (
            <p className="sx-caption sx-packet-panel__route sx-tnum">
              {sender.ip || 'no address'} to {receiver.ip || 'no address'}
            </p>
          )}

          <div className="sx-field">
            <span className="sx-field__label">Packet</span>
            <Segmented
              label="Packet type"
              options={PACKET_ORDER.map((id) => ({ value: id, label: PACKET_KINDS[id].label }))}
              value={kind}
              onChange={(next) => { if (!sending) setKind(next); }}
            />
            <p className="sx-caption">{PACKET_KINDS[kind].help}</p>
          </div>

          <button type="button" className="sx-btn sx-btn--primary sx-btn--block" onClick={send} disabled={sending || !fromId || !toId}>
            <Icon name="send" size={18} /> {sending ? 'Sending…' : 'Send packet'}
          </button>
        </>
      )}

      {cleared && !result && <p className="sx-caption">The network changed, so the last packet was cleared. Send it again to see what happens now.</p>}

      {sending && <p className="sx-caption" role="status">On its way…</p>}

      {done && (
        <div className="sx-packetresult" data-ok={result.ok} role="status">
          <div className="sx-packetresult__head">
            <span className={`sx-pill ${result.ok ? 'sx-pill--ok' : 'sx-pill--danger'}`}>{result.ok ? 'Delivered' : 'Blocked'}</span>
            <p className="sx-callout"><strong>{result.ok ? result.summary : result.failure.title}</strong></p>
          </div>
          {!result.ok && <p className="sx-caption">{result.failure.detail}</p>}
          {!result.ok && <p className="sx-caption sx-packetresult__fix"><strong>To fix it: </strong>{result.failure.fix}</p>}
          <ol className="sx-packetlog">
            {result.log.map((line, i) => (
              <li key={i} data-ok={line.ok}>
                <span className="sx-packetlog__mark" aria-hidden="true"><Icon name={line.ok ? 'check' : 'x'} size={12} strokeWidth={3} /></span>
                <span className="sx-caption sx-packetlog__text">
                  <span className="sx-visually-hidden">{line.ok ? 'Done: ' : 'Stopped: '}</span>
                  {line.text}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

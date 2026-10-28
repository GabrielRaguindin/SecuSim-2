import Icon from './Icon';

/** The graded requirements, each with what happened and what to do next. */
export default function CheckList({ checks }) {
  return (
    <ul className="sx-checks">
      {checks.map((c) => (
        <li key={c.id} className="sx-check" data-ok={c.ok}>
          <span className="sx-check__mark" aria-hidden="true">
            <Icon name={c.ok ? 'check' : 'x'} size={14} strokeWidth={2.6} />
          </span>
          <div>
            <p className="sx-callout sx-check__label">
              <span className="sx-visually-hidden">{c.ok ? 'Met: ' : 'Not met: '}</span>
              {c.label}
            </p>
            <p className="sx-caption">{c.detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

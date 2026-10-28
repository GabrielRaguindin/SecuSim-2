import Link from 'next/link';

export const metadata = { title: 'Not found' };

export default function NotFound() {
  return (
    <div className="sx-page">
      <div className="sx-empty">
        <h1 className="sx-title-1">That page doesn’t exist</h1>
        <p className="sx-body">The link may be old, or the address may have a typo.</p>
        <Link href="/" className="sx-btn sx-btn--primary">Go home</Link>
      </div>
    </div>
  );
}

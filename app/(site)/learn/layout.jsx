import LearnTabs from '@/components/learn/LearnTabs';

export default function LearnLayout({ children }) {
  return (
    <div className="sx-page">
      <header className="sx-pagehead">
        <h1 className="sx-display">Learn</h1>
        <LearnTabs />
      </header>
      {children}
    </div>
  );
}

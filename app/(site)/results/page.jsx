import ResultsList from '@/components/results/ResultsList';

export const metadata = {
  title: 'Results',
  description: 'Your saved scenario attempts, with a PDF for each.',
};

export default function ResultsPage() {
  return (
    <div className="sx-page">
      <header className="sx-pagehead">
        <h1 className="sx-display">Results</h1>
        <p className="sx-lead">Every attempt you saved, newest first. They stay in this browser for 30 days.</p>
      </header>
      <ResultsList />
    </div>
  );
}

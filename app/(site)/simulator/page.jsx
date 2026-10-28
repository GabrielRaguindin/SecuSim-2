import ScenarioList from '@/components/simulator/ScenarioList';

export const metadata = {
  title: 'Simulator',
  description: 'Pick a timed scenario, build the network it asks for, and check your work.',
};

export default function SimulatorPage() {
  return (
    <div className="sx-page">
      <header className="sx-pagehead">
        <h1 className="sx-display">Simulator</h1>
        <p className="sx-lead">
          Each scenario gives you a brief, a list of requirements and a clock. Build the network, set the policies, then check your work.
        </p>
      </header>
      <ScenarioList />
    </div>
  );
}

import ScenarioRunner from '@/components/simulator/ScenarioRunner';
import { SCENARIOS, getScenario } from '@/lib/scenarios.js';

export function generateStaticParams() {
  return SCENARIOS.map((s) => ({ id: s.id }));
}

export function generateMetadata({ params }) {
  const scenario = getScenario(params.id);
  return scenario ? { title: `Scenario ${scenario.number}: ${scenario.short}` } : { title: 'Custom scenario' };
}

export default function ScenarioPage({ params }) {
  // Only the id crosses to the client: scenarios carry check functions, which can't be serialized.
  // Built-in ids render ahead of time; any other id is looked up in the browser's saved scenarios.
  // The key makes moving between scenarios (back and forward) start fresh instead of reusing state.
  return <ScenarioRunner key={params.id} scenarioId={params.id} />;
}

import { notFound } from 'next/navigation';
import Simulator from '@/components/simulator/Simulator';
import { SCENARIOS, getScenario } from '@/lib/scenarios.js';

export function generateStaticParams() {
  return SCENARIOS.map((s) => ({ id: s.id }));
}

export function generateMetadata({ params }) {
  const scenario = getScenario(params.id);
  return scenario ? { title: `Scenario ${scenario.number}: ${scenario.short}` } : { title: 'Scenario not found' };
}

export default function ScenarioPage({ params }) {
  const scenario = getScenario(params.id);
  if (!scenario) notFound();
  // Only the id crosses to the client: scenarios carry check functions, which can't be serialized.
  return <Simulator scenarioId={scenario.id} />;
}

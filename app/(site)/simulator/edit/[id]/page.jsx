import ScenarioBuilder from '@/components/scenarios/ScenarioBuilder';

export const metadata = { title: 'Edit scenario' };

export default function EditScenarioPage({ params }) {
  return <ScenarioBuilder scenarioId={params.id} />;
}

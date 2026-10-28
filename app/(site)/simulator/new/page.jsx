import ScenarioBuilder from '@/components/scenarios/ScenarioBuilder';

export const metadata = {
  title: 'New scenario',
  description: 'Describe a network for someone to build, and SecuSim turns it into a graded scenario.',
};

export default function NewScenarioPage() {
  return <ScenarioBuilder />;
}

import TopologyLesson from '@/components/learn/TopologyLesson';
import { TOPOLOGY_LESSONS } from '@/lib/lessons.js';

export const metadata = {
  title: 'Learn topologies',
  description: 'See how ring, star and mesh networks are wired, and send a packet through each one.',
};

export default function TopologiesPage() {
  return (
    <div className="sx-lessons">
      <p className="sx-lead sx-lessons__intro">
        A topology is the shape of a network: which devices connect to which. The shape decides how data travels and what breaks when something fails.
      </p>
      {TOPOLOGY_LESSONS.map((lesson) => (
        <TopologyLesson key={lesson.kind} lesson={lesson} />
      ))}
    </div>
  );
}

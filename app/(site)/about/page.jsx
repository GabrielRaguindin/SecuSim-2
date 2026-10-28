export const metadata = {
  title: 'About',
  description: 'What SecuSim is, how it works, and where your data goes.',
};

const SHORTCUTS = [
  ['V', 'Select and move tool'],
  ['L', 'Link tool'],
  ['Delete', 'Remove the selection'],
  ['C', 'Switch the cable used for new links'],
  ['Ctrl or ⌘ + Z', 'Undo'],
  ['Shift + Ctrl or ⌘ + Z', 'Redo'],
  ['Ctrl or ⌘ + A', 'Select every device'],
  ['Arrow keys', 'Nudge the selected devices (hold Shift for bigger steps)'],
  ['Esc', 'Clear the selection'],
];

export default function About() {
  return (
    <div className="sx-page sx-prose">
      <header className="sx-pagehead">
        <h1 className="sx-display">About SecuSim</h1>
        <p className="sx-lead">A free, hands-on way to learn how networks are built and how security policies keep them safe.</p>
      </header>

      <section>
        <h2 className="sx-title-2">How it works</h2>
        <p className="sx-body">
          Learn the basics on the Learn pages, experiment with no clock in the Sandbox, then take on a Simulator scenario. Each scenario gives you a brief and a checklist. When you press Check my work, every requirement is graded and told what to fix next.
        </p>
      </section>

      <section>
        <h2 className="sx-title-2">Your data</h2>
        <p className="sx-body">
          Everything runs in your browser. Saved topologies and results are kept in this browser’s local storage and are never sent anywhere. Nothing you do here touches a real network.
        </p>
      </section>

      <section>
        <h2 className="sx-title-2">Keyboard shortcuts</h2>
        <dl className="sx-shortcuts">
          {SHORTCUTS.map(([keys, what]) => (
            <div key={keys} className="sx-shortcuts__row">
              <dt><kbd>{keys}</kbd></dt>
              <dd className="sx-body">{what}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="sx-title-2">Credits</h2>
        <p className="sx-body">Originally created by Gabriel Raguindin as a capstone project, SecuSim 2 is a complete redesign and rebuild from the ground up. The platform remains under active development with continuous feature updates.</p>
      </section>
    </div>
  );
}

import Panel from '../Panel'

export default function Intro({ active, onClose }) {
  return (
    <Panel id="intro" active={active} onClose={onClose}>
      <h2 className="major">Intro</h2>
      <span className="image main">
        <img src="/images/Intro.jpg" alt="" />
        photo by Markus Spiske
      </span>
      <p>
        Computing sits at a captivating intersection of mathematical elegance and engineering
        craft. Over decades, software and hardware have grown tremendously in capability —
        driven in large part by the sustained transistor-density scaling described by Moore&apos;s
        Law. As that classical scaling curve begins to plateau, the path forward relies less on
        raw transistor gains and more on architectural innovation, domain-specific accelerators,
        and emerging computational paradigms. Understanding where computing is headed requires a
        firm grasp of its entire stack — from silicon to systems — and that kind of understanding
        does not come cheaply.
      </p>
      <p>
        In my experience, building genuine intuition for the fundamentals takes considerably more
        than reading through definitions. It demands sitting with an idea long enough to
        stress-test it, see where it breaks, and arrive at a version that feels both clear and
        extensible. I have always embraced that deliberate pace, even when it means a slower
        start on a new problem, because the foundation it builds tends to hold.
      </p>
      <p>
        We are now entering an era shaped by agentic AI — systems capable of reasoning over
        goals, using tools, and autonomously executing multi-step tasks across complex
        environments. This marks a genuine shift: AI is evolving from a passive utility invoked
        by engineers into an active collaborator that can plan, adapt, and act. The{' '}
        <em>Me &amp; Agents</em> section of this site reflects my engagement with that
        transition. I believe the engineers who will navigate this era most effectively are those
        who pair a rigorous understanding of computing fundamentals with a genuine curiosity about
        — and critical perspective on — these increasingly capable systems.
      </p>
    </Panel>
  )
}

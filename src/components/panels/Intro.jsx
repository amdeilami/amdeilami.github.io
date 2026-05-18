import Panel from '../Panel'

export default function Intro({ active, onClose }) {
  return (
    <Panel id="intro" active={active} onClose={onClose}>
      <h2 className="major">Intro</h2>
      <span className="image main">
        <img src="/images/Intro.jpg" alt="" />
        photo by Markus Spiske
      </span>
      <p style={{ textAlign: 'justify' }}>
        Computing is beautiful, though it can be challenging in a lot of ways. Programs are
        getting more and more involved each day as well as hardware. But there is a question:{' '}
        <em>&ldquo;can this way of progressing continue as much as we want?&rdquo;</em>{' '}
        <br />
        Honestly, I do not have an exact answer for this question and don&apos;t think this
        crucial question can be answered easily. It requires a deep understanding on computing
        stack and typical toolflows to be able to foresee the future of computing. I personally
        believe that gaining the aforementioned understanding requires spending a lot of time
        on thinking about the fundamentals of computing. It&apos;s not as easy as reading a
        bunch of definitions — it requires reading and deep thinking simultaneously.
      </p>
      <p style={{ textAlign: 'justify' }}>
        I can remember some moments of studying a set of principles and motivations on
        computer science during which I had to think for several hours to actually learn a
        basic concept as something reasonable, clear and extendable. I try to keep on my
        previous studying methods (although slight modifications may always be applicable),
        notwithstanding being slow in the early phases of doing a project.
      </p>
    </Panel>
  )
}

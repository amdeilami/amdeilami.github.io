import Panel from '../Panel'

export default function Projects({ active, onClose }) {
  return (
    <Panel id="work" active={active} onClose={onClose}>
      <h2 className="major">Projects</h2>
      <span className="image main">
        <img src="/images/sam-albury-oA7MMRxTVzo-unsplash.jpg" alt="" />
        photo by Sam Albury
      </span>
      <p>
        I&apos;ve already uploaded a few projects on my GitHub page, but I have a lot of
        projects that may be interesting for you, though they&apos;re not expandable (or not
        worth expanding for public use). I&apos;ll try to write <em>English</em> reports for
        those projects that I won&apos;t share on GitHub and share them through this page.
      </p>
      <ul>
        <li>
          <h4 className="projects">Heaven Gate</h4>
          <p className="projects">
            Automatic layout creation was a wonderful gift to chip manufacturing process,
            though sometimes the feature of being <em>automatic</em> may cause the layout to
            be much denser than expected. In this project, a new FPGA cell was designed
            manually instead of its auto-generated version, resulting in a halved (area) cell
            — wonderful! Especially for embedded applications.
            <br /><br />
            <img src="/images/Layout.png" alt="Heaven Gate layout" />
          </p>
        </li>
        <li>
          <h4 className="projects">Pitch Detection using Autocorrelation</h4>
          <p className="projects">
            Pitch detection on environment (including human) sounds using auto-correlation.
            Writing efficient code considering resource constraints and real-time response,
            and finding the best sampling rate and signal scaling for better resolution were
            part of the challenges.
            <br /><br />
            <img src="/images/Pitch_Detection.png" alt="Pitch detection" />
          </p>
        </li>
        <li>
          <h4 className="projects">Hitman Go</h4>
          <p className="projects">
            Java is a wonderful language with amazing features. This project is a puzzle-genre
            game designed using object-oriented concepts and implemented with Java. It&apos;s
            been designed as an offline game, but I think it would be interesting to add a
            multiplayer section and launch it on a server — maybe it becomes another{' '}
            <em>Among Us!</em>
            <br /><br />
            <img src="/images/Hitman.jpg" alt="Hitman Go" />
          </p>
        </li>
      </ul>
    </Panel>
  )
}

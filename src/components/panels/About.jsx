import Panel from '../Panel'

export default function About({ active, onClose }) {
  return (
    <Panel id="about" active={active} onClose={onClose}>
      <h2 className="major">About</h2>
      <span className="image main">
        <img src="/images/Amir_in_Nature.jpg" alt="" />
      </span>
      <p style={{ textAlign: 'justify' }}>
        I hold a Master&apos;s degree in Computer Science and have a genuine passion for
        continuous learning. Outside of software engineering, I enjoy intellectually
        stimulating films, chess, hiking, and cooking.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1em', marginBottom: '1.5em' }}>
        <img src="/images/sfu-logo.png" alt="Simon Fraser University logo"
          style={{ width: '60px', flexShrink: 0 }} />
        <div>
          <b>MSc, Computer Science</b><br />
          (2022&ndash;2023)<br />
          Simon Fraser University, Burnaby, British Columbia, Canada
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1em', marginBottom: '1.5em' }}>
        <img src="/images/SBU_Logo.png" alt="Shahid Beheshti University logo"
          style={{ width: '60px', flexShrink: 0 }} />
        <div>
          <b>B.Sc., Computer Engineering</b><br />
          (2014&ndash;2019)<br />
          Shahid Beheshti University, Tehran, Tehran province, Iran
        </div>
      </div>
    </Panel>
  )
}

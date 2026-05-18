import Panel from '../Panel'

export default function About({ active, onClose }) {
  return (
    <Panel id="about" active={active} onClose={onClose}>
      <h2 className="major">About</h2>
      <span className="image main">
        <img src="/images/Amir_in_Nature.jpg" alt="" />
      </span>
      <p style={{ textAlign: 'justify' }}>
        Currently, I hold a Master&apos;s degree in computer science. I love learning.
        <br />
        In addition to software engineering, I like to watch brain-engaging movies and chess,
        hiking and cooking.
      </p>
      <p>
        <img
          src="/images/sfu-logo.png"
          alt="Simon Fraser University logo"
          width="10%"
          style={{ float: 'left', marginRight: '1em' }}
        />
        <b>MSc, Computer Science</b> <br /> (2022&ndash;2023)
        <br /> Simon Fraser University, Burnaby, British Columbia, Canada
      </p>
      <p>
        <img
          src="/images/SBU_Logo.png"
          alt="Shahid Beheshti University logo"
          width="10%"
          style={{ float: 'left', marginRight: '1em' }}
        />
        <b>B.Sc., Computer Engineering</b> <br /> (2014&ndash;2019)
        <br /> Shahid Beheshti University, Tehran, Tehran province, Iran
      </p>
    </Panel>
  )
}

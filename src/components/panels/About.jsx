import Panel from '../Panel'

export default function About({ active, onClose }) {
  return (
    <Panel id="about" active={active} onClose={onClose}>
      <h2 className="major">About</h2>
      <span className="image main">
        <img src="/images/Amir_in_Nature.jpg" alt="" />
      </span>
      <p>
        I hold a Master&apos;s degree in Computer Science and have a genuine passion for
        continuous learning. Outside of software engineering, I enjoy intellectually
        stimulating films, chess, hiking, and cooking.
      </p>
      <div className="edu-entry">
        <img src="/images/sfu-logo.png" alt="Simon Fraser University logo" />
        <div>
          <b>MSc, Computer Science</b><br />
          (2022&ndash;2023)<br />
          Simon Fraser University, Burnaby, British Columbia, Canada
        </div>
      </div>
      <div className="edu-entry">
        <img src="/images/SBU_Logo.png" alt="Shahid Beheshti University logo" />
        <div>
          <b>B.Sc., Computer Engineering</b><br />
          (2014&ndash;2019)<br />
          Shahid Beheshti University, Tehran, Tehran province, Iran
        </div>
      </div>
      <p>
        I am always open to meaningful conversations — whether it is a professional
        inquiry, a collaborative opportunity, or a thoughtful discussion about computing
        and technology. Feel free to reach out through either of the platforms below.
      </p>
      <ul className="icons">
        <li>
          <a href="https://www.linkedin.com/in/amirmohammad-deilami-724033246"
            className="icon brands fa-linkedin" target="_blank" rel="noreferrer">
            <span className="label">LinkedIn</span>
          </a>
        </li>
        <li>
          <a href="https://github.com/amdeilami"
            className="icon brands fa-github" target="_blank" rel="noreferrer">
            <span className="label">GitHub</span>
          </a>
        </li>
      </ul>
    </Panel>
  )
}

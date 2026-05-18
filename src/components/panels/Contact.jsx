import Panel from '../Panel'

export default function Contact({ active, onClose }) {
  return (
    <Panel id="contact" active={active} onClose={onClose}>
      <h2 className="major">Contact</h2>
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

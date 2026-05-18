import Panel from '../Panel'

export default function Contact({ active, onClose }) {
  return (
    <Panel id="contact" active={active} onClose={onClose}>
      <h2 className="major">Contact</h2>
      <p style={{ textAlign: 'justify' }}>
        Have something interesting to share? Wanna ask a question? Or maybe you want to tell
        me your suggestion(s) about this website — whatever it is, contact me and I&apos;ll
        be happy to help.
      </p>
      <p style={{ textAlign: 'justify' }}>
        Currently I don&apos;t have an Instagram, Twitter or Facebook account. Whenever I
        decide to create one, I&apos;ll link them to my website.
      </p>
      <ul className="icons">
        <li>
          <a href="mailto:a.m.deilami@gmail.com" className="icon brands fa-google">
            <span className="label">Email</span>
          </a>
        </li>
        <li>
          <a href="https://github.com/amdeilami" className="icon brands fa-github">
            <span className="label">GitHub</span>
          </a>
        </li>
      </ul>
    </Panel>
  )
}

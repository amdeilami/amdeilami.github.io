export default function Header() {
  return (
    <header id="header">
      <div className="logo">
        <span className="fa fa-space-shuttle fa-lg fa-spin" />
      </div>
      <div className="content">
        <div className="inner">
          <h1>AmirMohammad Deilami</h1>
          <p>
            A computer engineer by training and a computer scientist by graduate study.{' '}
            <br />Feel free to explore and learn more about my work and interests.
          </p>
        </div>
      </div>
      {/* 4 items = even count — use-middle on nav, is-middle on 3rd item (index 2) */}
      <nav className="use-middle">
        <ul>
          <li><a href="#intro">Intro</a></li>
          <li><a href="#work">Projects</a></li>
          <li className="is-middle"><a href="#agents">Me &amp; Agents</a></li>
          <li><a href="#about">About</a></li>
        </ul>
      </nav>
    </header>
  )
}

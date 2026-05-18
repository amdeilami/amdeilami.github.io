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
            I am a computer engineer who tries to be a computer scientist.{' '}
            <br />To find out more about me, take a look at this website.
          </p>
        </div>
      </div>
      {/* use-middle + is-middle are hard-coded because nav always has 4 items */}
      <nav className="use-middle">
        <ul>
          <li><a href="#intro">Intro</a></li>
          <li><a href="#work">Projects</a></li>
          <li className="is-middle"><a href="#about">About</a></li>
          <li><a href="#contact">Contact</a></li>
        </ul>
      </nav>
    </header>
  )
}

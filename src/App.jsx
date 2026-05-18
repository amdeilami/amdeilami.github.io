import { useState, useEffect, useRef } from 'react'
import Header from './components/Header'
import Footer from './components/Footer'
import Intro from './components/panels/Intro'
import Projects from './components/panels/Projects'
import About from './components/panels/About'
import Contact from './components/panels/Contact'
import './styles/main.scss'

const DELAY = 325
const PANELS = ['intro', 'work', 'about', 'contact']

export default function App() {
  const [isPreload, setIsPreload] = useState(true)
  const [isVisible, setIsVisible] = useState(false)
  const [activePanel, setActivePanel] = useState(null)
  const locked = useRef(false)

  useEffect(() => {
    const t = setTimeout(() => setIsPreload(false), 100)
    return () => clearTimeout(t)
  }, [])

  // Assigned each render so event handlers always call the latest version
  const showRef = useRef(null)
  const hideRef = useRef(null)

  showRef.current = (id) => {
    if (locked.current) return
    locked.current = true
    if (isVisible) {
      setActivePanel(null)
      setTimeout(() => {
        setActivePanel(id)
        setTimeout(() => { locked.current = false }, DELAY)
      }, DELAY)
    } else {
      setIsVisible(true)
      setTimeout(() => {
        setActivePanel(id)
        setTimeout(() => { locked.current = false }, DELAY)
      }, DELAY)
    }
  }

  hideRef.current = () => {
    if (!isVisible || locked.current) return
    locked.current = true
    setActivePanel(null)
    setTimeout(() => {
      setIsVisible(false)
      setTimeout(() => { locked.current = false }, DELAY)
    }, DELAY)
  }

  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

    const onHashChange = () => {
      const hash = location.hash.slice(1)
      if (!hash) hideRef.current()
      else if (PANELS.includes(hash)) showRef.current(hash)
    }
    const onKeyUp = (e) => { if (e.key === 'Escape') location.hash = '' }

    window.addEventListener('hashchange', onHashChange)
    window.addEventListener('keyup', onKeyUp)

    const initHash = location.hash.slice(1)
    if (initHash && PANELS.includes(initHash)) showRef.current(initHash)

    return () => {
      window.removeEventListener('hashchange', onHashChange)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  useEffect(() => {
    const classes = []
    if (isPreload) classes.push('is-preload')
    if (isVisible) classes.push('is-article-visible')
    document.body.className = classes.join(' ')
  }, [isPreload, isVisible])

  const close = () => { location.hash = '' }

  return (
    <div id="wrapper" onClick={() => isVisible && (location.hash = '')}>
      <Header />
      <div id="main">
        <Intro    active={activePanel === 'intro'}   onClose={close} />
        <Projects active={activePanel === 'work'}    onClose={close} />
        <About    active={activePanel === 'about'}   onClose={close} />
        <Contact  active={activePanel === 'contact'} onClose={close} />
      </div>
      <Footer />
    </div>
  )
}

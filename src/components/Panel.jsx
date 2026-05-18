import { useState, useEffect } from 'react'

// Duration must match the CSS transition in _main.scss (325ms) plus a small buffer.
const EXIT_DELAY = 350

export default function Panel({ id, active, onClose, children }) {
  const [mounted, setMounted] = useState(false)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (active) {
      setMounted(true)
      // One rAF between mount and adding .active so the browser has a painted
      // base state (opacity:0, translateY(0.25rem)) to transition *from*.
      const raf = requestAnimationFrame(() => setShow(true))
      return () => cancelAnimationFrame(raf)
    } else {
      setShow(false)
      const t = setTimeout(() => setMounted(false), EXIT_DELAY)
      return () => clearTimeout(t)
    }
  }, [active])

  if (!mounted) return null

  return (
    <article
      id={id}
      className={show ? 'active' : ''}
      onClick={e => e.stopPropagation()}
    >
      {children}
      <div className="close" onClick={onClose}>Close</div>
    </article>
  )
}

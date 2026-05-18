export default function Panel({ id, active, onClose, children }) {
  return (
    <article
      id={id}
      className={active ? 'active' : ''}
      onClick={e => e.stopPropagation()}
    >
      {children}
      <div className="close" onClick={onClose}>Close</div>
    </article>
  )
}

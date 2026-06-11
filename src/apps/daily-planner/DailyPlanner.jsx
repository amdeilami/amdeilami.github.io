import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react'

const LS_DAYS = 'daily-planner-days'
const HISTORY_DAYS = 7 // today + previous 6

function dateKey(d = new Date()) {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function dayLabel(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

// Drop days older than the 7-day window so storage never grows unbounded
function prune(days) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - (HISTORY_DAYS - 1))
  const cutoffKey = dateKey(cutoff)
  const pruned = {}
  for (const key of Object.keys(days)) {
    if (key >= cutoffKey) pruned[key] = days[key]
  }
  return pruned
}

function loadDays() {
  try { return prune(JSON.parse(localStorage.getItem(LS_DAYS)) || {}) } catch { return {} }
}

export default function DailyPlanner() {
  const [days, setDays] = useState(loadDays)
  const [newGoal, setNewGoal] = useState('')
  const [noteOpenId, setNoteOpenId] = useState(null)
  const [todayKey, setTodayKey] = useState(dateKey)

  // Roll over to the new day if the tab stays open past midnight. The
  // visibilitychange listener covers mobile browsers, which suspend timers
  // in background tabs — the date is re-checked the moment the tab returns.
  useEffect(() => {
    function checkDay() {
      const key = dateKey()
      if (key !== todayKey) {
        setTodayKey(key)
        setDays(prev => prune(prev))
        setNoteOpenId(null)
      }
    }
    const timer = setInterval(checkDay, 30_000)
    const onVisible = () => { if (!document.hidden) checkDay() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [todayKey])

  const goals = useMemo(() => days[todayKey]?.goals ?? [], [days, todayKey])

  function save(next) {
    localStorage.setItem(LS_DAYS, JSON.stringify(next))
    setDays(next)
  }

  function updateGoals(nextGoals) {
    save({ ...prune(days), [todayKey]: { goals: nextGoals } })
  }

  function addGoal(e) {
    e.preventDefault()
    const text = newGoal.trim()
    if (!text) return
    updateGoals([...goals, { id: Date.now(), text, done: false, note: '' }])
    setNewGoal('')
  }

  function toggleGoal(id) {
    updateGoals(goals.map(g => (g.id === id ? { ...g, done: !g.done } : g)))
  }

  function setNote(id, note) {
    updateGoals(goals.map(g => (g.id === id ? { ...g, note } : g)))
  }

  function deleteGoal(id) {
    updateGoals(goals.filter(g => g.id !== id))
    if (noteOpenId === id) setNoteOpenId(null)
  }

  // ── Drag-to-reorder ──────────────────────────────────────────────────────
  // Pointer Events instead of HTML5 drag-and-drop: the latter does not fire
  // on touch devices. The grip handle has touch-action:none (CSS) so dragging
  // it never scrolls the page; setPointerCapture keeps move/up events coming
  // to the handle for the whole gesture.
  //
  // The DOM order stays untouched during the drag: the lifted row follows the
  // pointer via translateY, displaced rows slide aside via translateY with a
  // CSS transition, and the reorder is committed once on drop. Row rects are
  // cached at drag start — layout never changes mid-drag, so they stay valid.
  const [drag, setDrag] = useState(null) // { id, from, to, offset, height }
  const listRef = useRef(null)
  const dragMetaRef = useRef(null) // { startY, rects }

  function onDragStart(e, id) {
    if (!listRef.current) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const from = goals.findIndex(g => g.id === id)
    const rects = Array.from(listRef.current.children).map(r => r.getBoundingClientRect())
    dragMetaRef.current = { startY: e.clientY, rects }
    setDrag({ id, from, to: from, offset: 0, height: rects[from].height })
  }

  function onDragMove(e) {
    if (!drag || !dragMetaRef.current) return
    const { startY, rects } = dragMetaRef.current
    const offset = e.clientY - startY
    const center = rects[drag.from].top + rects[drag.from].height / 2 + offset
    // Final index = how many other rows the dragged row's center sits below
    let to = 0
    for (let i = 0; i < rects.length; i++) {
      if (i === drag.from) continue
      if (center > rects[i].top + rects[i].height / 2) to += 1
    }
    setDrag(d => ({ ...d, offset, to }))
  }

  function onDragDrop() {
    if (!drag) return
    if (drag.to !== drag.from && listRef.current) {
      // Record each row's on-screen position (transforms included) so the
      // settle effect below can animate from here to the new layout (FLIP).
      const prevTops = new Map()
      Array.from(listRef.current.children).forEach((el, i) => {
        prevTops.set(goals[i].id, el.getBoundingClientRect().top)
      })
      settleRef.current = prevTops
      const next = [...goals]
      const [moved] = next.splice(drag.from, 1)
      next.splice(drag.to, 0, moved)
      updateGoals(next)
    }
    setDrag(null)
    dragMetaRef.current = null
  }

  function onDragCancel() {
    setDrag(null)
    dragMetaRef.current = null
  }

  // FLIP settle after a drop: the DOM just reordered and all drag transforms
  // were cleared in the same commit, so a plain CSS transition would animate
  // each row from the wrong anchor (its NEW layout slot plus the OLD transform).
  // Instead: before paint, pin every moved row at its previous on-screen spot
  // with transitions off, then release one frame later so the rows glide into
  // their new places.
  const settleRef = useRef(null)
  useLayoutEffect(() => {
    if (drag || !settleRef.current || !listRef.current) return
    const prevTops = settleRef.current
    settleRef.current = null
    const els = Array.from(listRef.current.children)
    els.forEach((el, i) => {
      const oldTop = prevTops.get(goals[i].id)
      if (oldTop === undefined) return
      const delta = oldTop - el.getBoundingClientRect().top
      if (Math.abs(delta) < 1) return
      el.style.transition = 'none'
      el.style.transform = `translateY(${delta}px)`
      void el.offsetHeight // force reflow so the pinned position paints
    })
    requestAnimationFrame(() => {
      els.forEach(el => {
        el.style.transition = ''
        el.style.transform = ''
      })
    })
  }, [drag, goals])

  // Inline transform for each row while a drag is in progress
  function rowStyle(i) {
    if (!drag) return undefined
    if (i === drag.from) return { transform: `translateY(${drag.offset}px) scale(1.02)` }
    if (drag.from < drag.to && i > drag.from && i <= drag.to)
      return { transform: `translateY(${-drag.height}px)` }
    if (drag.to < drag.from && i >= drag.to && i < drag.from)
      return { transform: `translateY(${drag.height}px)` }
    return undefined
  }

  const doneCount = goals.filter(g => g.done).length
  const pastKeys = Object.keys(days)
    .filter(k => k !== todayKey)
    .sort()
    .reverse()

  return (
    <div className="daily-planner">
      <h3>
        Today <span className="dp-date">— {dayLabel(todayKey)}</span>
      </h3>

      <form className="dp-add-row" onSubmit={addGoal}>
        <input
          type="text" placeholder="Add a goal for today…"
          value={newGoal} onChange={e => setNewGoal(e.target.value)}
        />
        <button type="submit">Add</button>
      </form>

      {goals.length > 0 && (
        <>
          <div className="dp-bar-wrap">
            <div className="dp-bar" style={{ width: `${(doneCount / goals.length) * 100}%` }} />
          </div>
          <p className="dp-progress">{doneCount} of {goals.length} completed</p>
        </>
      )}

      {goals.length === 0 && (
        <p className="dp-empty">No goals yet — add your first goal for today above.</p>
      )}

      <ul className={`dp-goal-list${drag ? ' dp-drag-active' : ''}`} ref={listRef}>
        {goals.map((goal, i) => (
          <li
            key={goal.id}
            className={`${goal.done ? 'dp-done' : ''}${goal.id === drag?.id ? ' dp-dragging' : ''}`}
            style={rowStyle(i)}
          >
            <div className="dp-goal-row">
              {goals.length > 1 && (
                <span
                  className="dp-drag fas fa-grip-vertical"
                  title="Drag to reorder"
                  onPointerDown={e => onDragStart(e, goal.id)}
                  onPointerMove={onDragMove}
                  onPointerUp={onDragDrop}
                  onPointerCancel={onDragCancel}
                  onContextMenu={e => e.preventDefault()}
                />
              )}
              <button
                type="button" className="dp-check" title={goal.done ? 'Mark as not done' : 'Mark as done'}
                onClick={() => toggleGoal(goal.id)}
              >
                <span className="fas fa-check" />
              </button>
              <span className="dp-text">{goal.text}</span>
              <button
                type="button"
                className={`dp-icon-btn${goal.note ? ' dp-has-note' : ''}`}
                title={noteOpenId === goal.id ? 'Close note' : goal.note ? 'Edit note' : 'Add note'}
                onClick={() => setNoteOpenId(noteOpenId === goal.id ? null : goal.id)}
              >
                <span className="fas fa-sticky-note" />
              </button>
              <button
                type="button" className="dp-icon-btn dp-delete" title="Delete goal"
                onClick={() => deleteGoal(goal.id)}
              >
                <span className="fas fa-trash" />
              </button>
            </div>
            {noteOpenId === goal.id ? (
              <input
                type="text" className="dp-note-input" placeholder="Optional note…"
                value={goal.note} autoFocus
                onChange={e => setNote(goal.id, e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') setNoteOpenId(null) }}
              />
            ) : (
              goal.note && <p className="dp-note">{goal.note}</p>
            )}
          </li>
        ))}
      </ul>

      {pastKeys.length > 0 && (
        <>
          <h4 className="dp-history-title">Past {HISTORY_DAYS} days</h4>
          {pastKeys.map(key => {
            const dayGoals = days[key].goals
            const dayDone = dayGoals.filter(g => g.done).length
            return (
              <div className="dp-day-card" key={key}>
                <div className="dp-day-head">
                  <strong>{dayLabel(key)}</strong>
                  <span>{dayDone} / {dayGoals.length} completed</span>
                </div>
                <ul className="dp-day-goals">
                  {dayGoals.map(g => (
                    <li key={g.id} className={g.done ? 'dp-done' : ''}>
                      <span className={`dp-day-mark fas ${g.done ? 'fa-check' : 'fa-times'}`} />
                      <span className="dp-text">{g.text}</span>
                      {g.note && <p className="dp-note">{g.note}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

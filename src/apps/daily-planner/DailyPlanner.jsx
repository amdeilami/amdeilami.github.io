import { useState, useEffect } from 'react'

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

  const goals = days[todayKey]?.goals ?? []

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

      <ul className="dp-goal-list">
        {goals.map(goal => (
          <li key={goal.id} className={goal.done ? 'dp-done' : ''}>
            <div className="dp-goal-row">
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

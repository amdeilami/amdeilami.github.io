import { useState, useEffect } from 'react'

const LS_SETTINGS = 'gas-calc-settings'
const LS_LOG = 'gas-calc-log'

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(LS_SETTINGS)) } catch { return null }
}

function loadLog() {
  try { return JSON.parse(localStorage.getItem(LS_LOG)) || [] } catch { return [] }
}

function calcStats(log, settings) {
  if (!settings || log.length === 0) return { avgConsumption: null, fuelAfterLast: null }

  const intervals = []
  for (let i = 1; i < log.length; i++) {
    const dist = log[i].odometer - log[i - 1].odometer
    if (dist > 0) intervals.push((log[i].litersAdded / dist) * 100)
  }
  const avgConsumption =
    intervals.length > 0
      ? intervals.reduce((a, b) => a + b, 0) / intervals.length
      : settings.defaultConsumption

  // Reconstruct fuel level starting from the user-specified initial amount
  // (falls back to tankMax for settings saved before this field was added)
  let fuel = settings.initialFuel ?? settings.tankMax
  for (let i = 0; i < log.length; i++) {
    if (i > 0) {
      const dist = log[i].odometer - log[i - 1].odometer
      fuel -= (dist / 100) * (intervals[i - 1] ?? settings.defaultConsumption)
    }
    fuel = Math.min(fuel + log[i].litersAdded, settings.tankMax)
  }

  return { avgConsumption, fuelAfterLast: Math.max(fuel, 0) }
}

export default function GasCalculator() {
  const [settings, setSettings] = useState(loadSettings)
  const [log, setLog] = useState(loadLog)
  const [screen, setScreen] = useState(() => (loadSettings() ? 'main' : 'setup'))

  // Setup form state
  const [tankMax, setTankMax] = useState('')
  const [defaultConsumption, setDefaultConsumption] = useState('')
  const [initialFuel, setInitialFuel] = useState('')

  // Refuel form state
  const [odometer, setOdometer] = useState('')
  const [litersAdded, setLitersAdded] = useState('')

  // Live estimate input
  const [currentOdo, setCurrentOdo] = useState('')

  // Seed setup form when editing existing settings
  useEffect(() => {
    if (settings && screen === 'setup') {
      setTankMax(String(settings.tankMax))
      setDefaultConsumption(String(settings.defaultConsumption))
      setInitialFuel(String(settings.initialFuel ?? settings.tankMax))
    }
  }, [screen, settings])

  function saveSettings(e) {
    e.preventDefault()
    const max = parseFloat(tankMax)
    const cons = parseFloat(defaultConsumption)
    const init = parseFloat(initialFuel) || max  // blank → assume full tank
    if (!max || !cons || max <= 0 || cons <= 0) return
    const s = { tankMax: max, defaultConsumption: cons, initialFuel: Math.min(init, max) }
    localStorage.setItem(LS_SETTINGS, JSON.stringify(s))
    setSettings(s)
    setScreen('main')
  }

  function addRefuel(e) {
    e.preventDefault()
    const odo = parseFloat(odometer)
    const liters = parseFloat(litersAdded)
    if (!odo || !liters || odo <= 0 || liters <= 0) return
    if (log.length > 0 && odo <= log[log.length - 1].odometer) return
    const entry = { id: Date.now(), date: new Date().toLocaleDateString(), odometer: odo, litersAdded: liters }
    const next = [...log, entry]
    localStorage.setItem(LS_LOG, JSON.stringify(next))
    setLog(next)
    setOdometer('')
    setLitersAdded('')
  }

  function resetLog() {
    localStorage.removeItem(LS_LOG)
    setLog([])
    setCurrentOdo('')
  }

  function resetAll() {
    localStorage.removeItem(LS_SETTINGS)
    localStorage.removeItem(LS_LOG)
    setSettings(null)
    setLog([])
    setCurrentOdo('')
    setTankMax('')
    setDefaultConsumption('')
    setInitialFuel('')
    setScreen('setup')
  }

  const { avgConsumption, fuelAfterLast } = calcStats(log, settings)

  // Live estimate
  let fuelNow = null
  let rangeKm = null
  if (log.length > 0 && fuelAfterLast !== null && avgConsumption) {
    const odoVal = parseFloat(currentOdo)
    const lastOdo = log[log.length - 1].odometer
    if (odoVal > lastOdo) {
      const dist = odoVal - lastOdo
      fuelNow = Math.max(fuelAfterLast - (dist / 100) * avgConsumption, 0)
    } else {
      fuelNow = fuelAfterLast
    }
    rangeKm = (fuelNow / avgConsumption) * 100
  }

  const fuelPercent =
    settings && fuelNow !== null ? Math.min((fuelNow / settings.tankMax) * 100, 100) : null

  // ─── Setup screen ──────────────────────────────────────────────────────────
  if (screen === 'setup') {
    return (
      <div className="gas-calc">
        <h3>Setup</h3>
        <form onSubmit={saveSettings}>
          <label>Tank capacity (L)</label>
          <input
            type="text" inputMode="decimal" placeholder="e.g. 50"
            value={tankMax} onChange={e => setTankMax(e.target.value)} required
          />
          <label>Estimated consumption (L/100km)</label>
          <input
            type="text" inputMode="decimal" placeholder="e.g. 8.5"
            value={defaultConsumption} onChange={e => setDefaultConsumption(e.target.value)} required
          />
          <label>Current fuel level (L)</label>
          <input
            type="text" inputMode="decimal"
            placeholder={tankMax ? `e.g. ${tankMax} (full tank)` : 'e.g. 30'}
            value={initialFuel} onChange={e => setInitialFuel(e.target.value)}
          />
          <small className="gc-hint">
            How much fuel is in the tank right now? Leave blank to assume a full tank.
          </small>
          <div className="calc-row" style={{ marginTop: '0.8em' }}>
            <button type="submit">Save &amp; Start</button>
            {settings && (
              <button type="button" onClick={() => setScreen('main')}>Cancel</button>
            )}
          </div>
        </form>
      </div>
    )
  }

  // ─── Main screen ───────────────────────────────────────────────────────────
  return (
    <div className="gas-calc">
      {/* Settings bar */}
      <div className="gc-settings-bar">
        <span>Tank: <strong>{settings.tankMax} L</strong></span>
        <span>
          Consumption:{' '}
          <strong>
            {avgConsumption ? avgConsumption.toFixed(1) : settings.defaultConsumption} L/100km
          </strong>
          {log.length < 2 && <em> (estimated)</em>}
        </span>
        <button onClick={() => setScreen('setup')}>Edit</button>
      </div>

      {/* Fuel status */}
      {log.length > 0 && (
        <div style={{ marginBottom: '1em' }}>
          <label>Current odometer (km) — for live estimate</label>
          <input
            type="text" inputMode="numeric" placeholder={`Last: ${log[log.length - 1].odometer}`}
            value={currentOdo} onChange={e => setCurrentOdo(e.target.value)}
          />
          {fuelPercent !== null && (
            <>
              <div className="fuel-bar-wrap">
                <div className="fuel-bar" style={{ width: `${fuelPercent}%` }} />
              </div>
              <div className="gc-estimate">
                <span>~{fuelNow.toFixed(1)} L remaining</span>
                <span>~{rangeKm.toFixed(0)} km range</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Add refuel form */}
      <h4>Log a refuel</h4>
      <form onSubmit={addRefuel}>
        <div className="calc-row">
          <div>
            <label>Odometer (km)</label>
            <input
              type="text" inputMode="numeric" placeholder="e.g. 45200"
              value={odometer} onChange={e => setOdometer(e.target.value)} required
            />
          </div>
          <div>
            <label>Liters added</label>
            <input
              type="text" inputMode="decimal" placeholder="e.g. 35"
              value={litersAdded} onChange={e => setLitersAdded(e.target.value)} required
            />
          </div>
        </div>
        <button type="submit">Add Entry</button>
      </form>

      {/* History */}
      {log.length > 0 && (
        <>
          <h4 style={{ marginTop: '1.2em' }}>History</h4>
          <table className="history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Odometer</th>
                <th>Liters</th>
                <th>L/100km</th>
              </tr>
            </thead>
            <tbody>
              {log.map((entry, i) => {
                const dist = i > 0 ? entry.odometer - log[i - 1].odometer : null
                const cons = dist && dist > 0 ? ((entry.litersAdded / dist) * 100).toFixed(1) : '—'
                return (
                  <tr key={entry.id}>
                    <td>{entry.date}</td>
                    <td>{entry.odometer.toLocaleString()}</td>
                    <td>{entry.litersAdded}</td>
                    <td>{cons}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}

      {/* Danger zone — always visible so users can reset even before adding entries */}
      <div className="gc-danger-row">
        {log.length > 0 && (
          <button
            onClick={() => { if (window.confirm('Clear all log entries?')) resetLog() }}
          >
            Reset Log
          </button>
        )}
        <button
          className="gc-reset-all"
          onClick={() => { if (window.confirm('Reset everything? This will delete your settings and all log entries.')) resetAll() }}
        >
          Reset All
        </button>
      </div>
    </div>
  )
}

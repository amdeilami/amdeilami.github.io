import { useState, useEffect } from 'react'
import Panel from '../Panel'
import GasCalculator from '../../apps/gas-calculator/GasCalculator'
import WheelSpinner from '../../apps/wheel-spinner/WheelSpinner'
import Walk from '../../apps/walk/Walk'

const APPS = [
  {
    id: 'gas-calculator',
    title: 'Gas Consumption Calculator',
    desc: 'Track refuels, compute L/100km, and estimate your remaining range — all stored locally in your browser.',
    icon: 'fas fa-gas-pump',
  },
  {
    id: 'wheel-spinner',
    title: 'Group Picker Wheel',
    desc: 'Enter names or a headcount, spin the wheel, and let chance decide who\'s picked.',
    icon: 'fas fa-random',
  },
  {
    id: 'walk',
    title: 'Walk',
    desc: 'Explore a small open-world yard freely. WASD to move, mouse to look around.',
    icon: 'fas fa-compass',
  },
]

export default function Agents({ active, onClose }) {
  const [activeApp, setActiveApp] = useState(null)

  useEffect(() => {
    if (!active) setActiveApp(null)
  }, [active])

  const currentApp = APPS.find(a => a.id === activeApp)

  return (
    <Panel id="agents" active={active} onClose={onClose}>
      {currentApp ? (
        <h2 className="major">
          <span className={`${currentApp.icon} app-title-icon`} />{currentApp.title}
        </h2>
      ) : (
        <h2 className="major">Me &amp; Agents</h2>
      )}

      {activeApp === null ? (
        <>
          <p>
            Browser-based tools you can use directly — no sign-up, no server, no data leaves your device.
          </p>
          <ul className="list-none p-0 m-0 flex flex-col gap-[0.75em]">
            {APPS.map(app => (
              <li key={app.id} className="app-card" onClick={() => setActiveApp(app.id)}>
                <div className="app-card-icon">
                  <span className={app.icon} />
                </div>
                <div className="app-card-body">
                  <h4>{app.title}</h4>
                  <p>{app.desc}</p>
                </div>
                <span className="app-card-arrow fas fa-chevron-right" />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <button
            className="bg-transparent border border-glass-btn text-inherit cursor-pointer px-[0.8em] py-[0.3em] mb-[1.2em] rounded-sm hover:border-glass-hover transition-colors duration-200"
            onClick={() => setActiveApp(null)}
          >
            &#8592; Back to Apps
          </button>
          {activeApp === 'gas-calculator' && <GasCalculator />}
          {activeApp === 'wheel-spinner' && <WheelSpinner />}
          {activeApp === 'walk' && <Walk />}
        </>
      )}
    </Panel>
  )
}

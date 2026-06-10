import { useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { KeyboardControls } from '@react-three/drei'
import { WorldScene, EYE_HEIGHT } from './YardMap'
import { SpaceScene, SPACE_EYE_HEIGHT } from './SpaceMap'

const KEYBOARD_MAP = [
  { name: 'forward',  keys: ['ArrowUp',    'KeyW'] },
  { name: 'backward', keys: ['ArrowDown',  'KeyS'] },
  { name: 'left',     keys: ['ArrowLeft',  'KeyA'] },
  { name: 'right',    keys: ['ArrowRight', 'KeyD'] },
]

const isMobile =
  /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ||
  ('ontouchstart' in window && navigator.maxTouchPoints > 0)

export default function Walk() {
  const [locked, setLocked] = useState(false)
  const [currentMap, setCurrentMap] = useState('yard')
  const isSpace = currentMap === 'space'

  useEffect(() => {
    function interceptEsc(e) {
      if (e.key === 'Escape' && locked) e.stopPropagation()
    }
    document.addEventListener('keyup', interceptEsc, true)
    return () => document.removeEventListener('keyup', interceptEsc, true)
  }, [locked])

  if (isMobile) {
    return (
      <p className="walk-mobile-hint">
        Walk is best experienced on a desktop with a mouse — pointer lock isn&apos;t supported on mobile browsers.
      </p>
    )
  }

  return (
    <KeyboardControls map={KEYBOARD_MAP}>
      <div className="flex gap-2 mb-2">
        <button
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${!isSpace ? 'bg-green-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          onClick={() => { setCurrentMap('yard'); setLocked(false) }}
        >
          Yard
        </button>
        <button
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${isSpace ? 'bg-indigo-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          onClick={() => { setCurrentMap('space'); setLocked(false) }}
        >
          Spaceship
        </button>
      </div>

      <div className="walk-app relative w-full aspect-video max-h-[420px] bg-black rounded overflow-hidden">
        <Canvas
          key={currentMap}
          shadows
          camera={{
            fov: 75,
            near: 0.1,
            far: isSpace ? 520 : 100,
            position: [0, isSpace ? SPACE_EYE_HEIGHT : EYE_HEIGHT, 0],
          }}
          gl={{ antialias: true }}
          dpr={[1, 2]}
          onCreated={({ camera }) => camera.quaternion.identity()}
        >
          {isSpace
            ? <SpaceScene onLock={() => setLocked(true)} onUnlock={() => setLocked(false)} />
            : <WorldScene onLock={() => setLocked(true)} onUnlock={() => setLocked(false)} />
          }
        </Canvas>

        {!locked && (
          <div className="walk-click-prompt">
            <p>Click to look around</p>
            {!isSpace && <p>WASD to walk</p>}
          </div>
        )}

        {locked && (
          <div className="walk-overlay">
            <span>ESC to release mouse</span>
          </div>
        )}
      </div>
    </KeyboardControls>
  )
}

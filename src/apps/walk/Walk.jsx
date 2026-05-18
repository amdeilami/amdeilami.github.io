import { useRef, useState, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PointerLockControls, Sky, KeyboardControls, useKeyboardControls } from '@react-three/drei'

const KEYBOARD_MAP = [
  { name: 'forward',  keys: ['ArrowUp',    'KeyW'] },
  { name: 'backward', keys: ['ArrowDown',  'KeyS'] },
  { name: 'left',     keys: ['ArrowLeft',  'KeyA'] },
  { name: 'right',    keys: ['ArrowRight', 'KeyD'] },
]

const WORLD_HALF = 9.2   // yard boundary: 10 units - 0.8 safety margin
const EYE_HEIGHT = 1.7
const MOVE_SPEED  = 5    // units/sec — comfortable walking pace

const TREE_POSITIONS = [
  [4, 3], [-5, 2], [3, -5], [-4, -3], [6, -6], [-7, 4],
]

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[20, 20]} />
      <meshLambertMaterial color="#4a7c3f" />
    </mesh>
  )
}

function Tree({ x, z }) {
  return (
    <group position={[x, 0, z]}>
      {/* trunk */}
      <mesh position={[0, 1, 0]}>
        <cylinderGeometry args={[0.15, 0.2, 2, 8]} />
        <meshLambertMaterial color="#6b4226" />
      </mesh>
      {/* foliage */}
      <mesh position={[0, 2.7, 0]}>
        <sphereGeometry args={[1.1, 8, 6]} />
        <meshLambertMaterial color="#2d6a2d" />
      </mesh>
    </group>
  )
}

function Fence() {
  const plank = { w: 20, h: 1.2, d: 0.15 }
  const y = plank.h / 2
  return (
    <group>
      <mesh position={[0, y,  10]}>
        <boxGeometry args={[plank.w, plank.h, plank.d]} />
        <meshLambertMaterial color="#8b6914" />
      </mesh>
      <mesh position={[0, y, -10]}>
        <boxGeometry args={[plank.w, plank.h, plank.d]} />
        <meshLambertMaterial color="#8b6914" />
      </mesh>
      <mesh position={[ 10, y, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[plank.w, plank.h, plank.d]} />
        <meshLambertMaterial color="#8b6914" />
      </mesh>
      <mesh position={[-10, y, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[plank.w, plank.h, plank.d]} />
        <meshLambertMaterial color="#8b6914" />
      </mesh>
    </group>
  )
}

function PlayerControls({ locked, onLock, onUnlock }) {
  const controlsRef = useRef()
  const [, get] = useKeyboardControls()
  const { camera } = useThree()

  useFrame((_, delta) => {
    const ctrl = controlsRef.current
    if (!ctrl?.isLocked) return
    const { forward, backward, left, right } = get()
    const speed = MOVE_SPEED * delta
    if (forward)  ctrl.moveForward(speed)
    if (backward) ctrl.moveForward(-speed)
    if (left)     ctrl.moveRight(-speed)
    if (right)    ctrl.moveRight(speed)
    camera.position.x = Math.max(-WORLD_HALF, Math.min(WORLD_HALF, camera.position.x))
    camera.position.z = Math.max(-WORLD_HALF, Math.min(WORLD_HALF, camera.position.z))
    camera.position.y = EYE_HEIGHT
  })

  return (
    <PointerLockControls
      ref={controlsRef}
      onLock={onLock}
      onUnlock={onUnlock}
    />
  )
}

function WorldScene({ onLock, onUnlock, locked }) {
  return (
    <>
      <Sky sunPosition={[100, 20, 100]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 20, 10]} intensity={1.0} />
      <Ground />
      <Fence />
      {TREE_POSITIONS.map(([x, z]) => (
        <Tree key={`${x}-${z}`} x={x} z={z} />
      ))}
      <PlayerControls locked={locked} onLock={onLock} onUnlock={onUnlock} />
    </>
  )
}

const isMobile =
  /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ||
  ('ontouchstart' in window && navigator.maxTouchPoints > 0)

export default function Walk() {
  const [locked, setLocked] = useState(false)

  // Intercept ESC at capture phase so App.jsx's bubble-phase window listener
  // doesn't close the panel when the user exits pointer lock.
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
      <div className="walk-app relative w-full aspect-video max-h-[420px] bg-black rounded overflow-hidden">
        <Canvas
          camera={{ fov: 75, near: 0.1, far: 100, position: [0, EYE_HEIGHT, 0] }}
          gl={{ antialias: true }}
          dpr={[1, 2]}
        >
          <WorldScene
            locked={locked}
            onLock={() => setLocked(true)}
            onUnlock={() => setLocked(false)}
          />
        </Canvas>

        {!locked && (
          <div className="walk-click-prompt">
            <p>Click to look around</p>
            <p>WASD to walk</p>
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

import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  PointerLockControls, Sky, useKeyboardControls,
  Environment, SoftShadows,
} from '@react-three/drei'
import { EffectComposer, N8AO, Bloom, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { createNoise2D } from 'simplex-noise'
import { Color, BufferAttribute, PlaneGeometry } from 'three'

export const WORLD_HALF = 9.2
export const EYE_HEIGHT  = 1.7
const MOVE_SPEED         = 5

const noise2D = createNoise2D()

const GRASS_COLOR = new Color('#4a7c3f')
const PATH_COLOR  = new Color('#7a6040')

const TREE_DATA = [
  { pos: [4,  3],   scale: 1.00 },
  { pos: [-5, 2],   scale: 1.20 },
  { pos: [3,  -5],  scale: 0.85 },
  { pos: [-4, -3],  scale: 1.10 },
  { pos: [6,  -6],  scale: 0.90 },
  { pos: [-7, 4],   scale: 1.15 },
  { pos: [-8, -7],  scale: 0.80 },
  { pos: [7,  6],   scale: 1.05 },
]

const ROCK_DATA = [
  { pos: [2.5,  -3.5], rot: [0.3, 0.8, 0], size: 0.22 },
  { pos: [-3.5, 4.5],  rot: [1.2, 0.4, 0], size: 0.18 },
  { pos: [6.5,  1.5],  rot: [0.6, 1.1, 0], size: 0.25 },
  { pos: [-6,   -5],   rot: [0.9, 0.2, 0], size: 0.20 },
  { pos: [1.5,  7],    rot: [0.4, 0.7, 0], size: 0.17 },
  { pos: [-7,   -1],   rot: [1.5, 0.5, 0], size: 0.23 },
  { pos: [5,    -2],   rot: [0.7, 1.3, 0], size: 0.19 },
]

const FENCE_POSTS = Array.from({ length: 11 }, (_, i) => -10 + i * 2)

function TerrainGround() {
  const geom = useMemo(() => {
    const g = new PlaneGeometry(20, 20, 80, 80)
    g.rotateX(-Math.PI / 2)
    // After rotateX: pos.getX/Z = world XZ, pos.setY = height
    const pos = g.attributes.position
    const colorArr = new Float32Array(pos.count * 3)

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      // flatten near fence so posts sit flush
      const edgeFactor = Math.max(Math.abs(x) / 9.5, Math.abs(z) / 9.5)
      const falloff = Math.max(0, 1 - edgeFactor * 1.8)
      pos.setY(i, noise2D(x * 0.3, z * 0.3) * 0.12 * falloff)

      // blend grass → dirt within path corridor (|x| < 0.9)
      const pathBlend = Math.max(0, 1 - Math.abs(x) / 0.9)
      const c = GRASS_COLOR.clone().lerp(PATH_COLOR, pathBlend)
      colorArr[i * 3]     = c.r
      colorArr[i * 3 + 1] = c.g
      colorArr[i * 3 + 2] = c.b
    }

    g.setAttribute('color', new BufferAttribute(colorArr, 3))
    g.computeVertexNormals()
    return g
  }, [])

  return (
    <mesh geometry={geom} receiveShadow>
      <meshStandardMaterial vertexColors roughness={1} />
    </mesh>
  )
}

function Tree({ x, z, scale = 1 }) {
  const trunkH = 1.8 * scale
  const baseY  = trunkH + 0.3 * scale
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, trunkH / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.12 * scale, 0.18 * scale, trunkH, 7]} />
        <meshStandardMaterial color="#5a3a1e" roughness={0.9} />
      </mesh>
      <mesh position={[0, baseY, 0]} castShadow>
        <sphereGeometry args={[0.95 * scale, 7, 5]} />
        <meshStandardMaterial color="#2a5a2a" roughness={0.8} />
      </mesh>
      <mesh position={[0, baseY + 0.70 * scale, 0]} castShadow>
        <sphereGeometry args={[0.70 * scale, 7, 5]} />
        <meshStandardMaterial color="#2f6830" roughness={0.8} />
      </mesh>
      <mesh position={[0, baseY + 1.25 * scale, 0]} castShadow>
        <sphereGeometry args={[0.42 * scale, 6, 4]} />
        <meshStandardMaterial color="#356335" roughness={0.8} />
      </mesh>
    </group>
  )
}

function Rock({ pos, rot, size }) {
  return (
    <mesh position={[pos[0], size * 0.7, pos[1]]} rotation={rot} castShadow receiveShadow>
      <dodecahedronGeometry args={[size, 0]} />
      <meshStandardMaterial color="#7a7a6a" roughness={0.95} />
    </mesh>
  )
}

function FenceLine() {
  return (
    <group>
      {FENCE_POSTS.map(x => (
        <mesh key={x} position={[x, 0.7, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.12, 1.4, 0.12]} />
          <meshStandardMaterial color="#7a5c1e" roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, 0.38, 0]} castShadow>
        <boxGeometry args={[20, 0.10, 0.08]} />
        <meshStandardMaterial color="#8b6914" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.00, 0]} castShadow>
        <boxGeometry args={[20, 0.10, 0.08]} />
        <meshStandardMaterial color="#8b6914" roughness={0.9} />
      </mesh>
    </group>
  )
}

function Fence() {
  return (
    <group>
      <group position={[0, 0,  10]}><FenceLine /></group>
      <group position={[0, 0, -10]}><FenceLine /></group>
      <group position={[ 10, 0, 0]} rotation={[0,  Math.PI / 2, 0]}><FenceLine /></group>
      <group position={[-10, 0, 0]} rotation={[0, -Math.PI / 2, 0]}><FenceLine /></group>
    </group>
  )
}

function Bench({ x, z, ry = 0 }) {
  return (
    <group position={[x, 0, z]} rotation={[0, ry, 0]}>
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.06, 0.40]} />
        <meshStandardMaterial color="#7a5c1e" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.72, -0.17]} castShadow>
        <boxGeometry args={[1.2, 0.42, 0.06]} />
        <meshStandardMaterial color="#7a5c1e" roughness={0.9} />
      </mesh>
      {[-0.5, 0.5].map(lx => (
        <mesh key={lx} position={[lx, 0.22, 0]} castShadow>
          <boxGeometry args={[0.06, 0.45, 0.38]} />
          <meshStandardMaterial color="#6b4e1a" roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
}

function PlayerControls({ onLock, onUnlock }) {
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
      selector=".walk-app"
      onLock={onLock}
      onUnlock={onUnlock}
    />
  )
}

export function WorldScene({ onLock, onUnlock }) {
  return (
    <>
      <fog attach="fog" args={['#c9e8f5', 12, 40]} />
      <Sky sunPosition={[100, 20, 100]} />
      <Environment preset="park" />
      <SoftShadows size={40} samples={16} focus={0} />
      <ambientLight intensity={0.1} />
      <directionalLight
        position={[10, 20, 10]}
        intensity={1.5}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.5}
        shadow-camera-far={50}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
      />
      <TerrainGround />
      <Fence />
      {TREE_DATA.map(({ pos, scale }) => (
        <Tree key={`${pos[0]}-${pos[1]}`} x={pos[0]} z={pos[1]} scale={scale} />
      ))}
      {ROCK_DATA.map(({ pos, rot, size }) => (
        <Rock key={`${pos[0]}-${pos[1]}`} pos={pos} rot={rot} size={size} />
      ))}
      <Bench x={-3} z={-1} ry={Math.PI / 4} />
      <Bench x={3}  z={2}  ry={-Math.PI / 6} />
      <EffectComposer>
        <N8AO aoRadius={2} intensity={3} quality="medium" />
        <Bloom luminanceThreshold={0.85} intensity={0.4} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Vignette eskil={false} offset={0.15} darkness={0.55} />
      </EffectComposer>
      <PlayerControls onLock={onLock} onUnlock={onUnlock} />
    </>
  )
}

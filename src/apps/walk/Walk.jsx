import { useRef, useState, useEffect, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  PointerLockControls, Sky, KeyboardControls, useKeyboardControls,
  Environment, SoftShadows,
} from '@react-three/drei'
import { EffectComposer, N8AO, Bloom, ToneMapping, Vignette, SMAA } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { createNoise2D } from 'simplex-noise'
import { Color, AdditiveBlending, CanvasTexture, BufferAttribute, BufferGeometry, PlaneGeometry, Vector3 } from 'three'

const KEYBOARD_MAP = [
  { name: 'forward',  keys: ['ArrowUp',    'KeyW'] },
  { name: 'backward', keys: ['ArrowDown',  'KeyS'] },
  { name: 'left',     keys: ['ArrowLeft',  'KeyA'] },
  { name: 'right',    keys: ['ArrowRight', 'KeyD'] },
]

const WORLD_HALF = 9.2
const EYE_HEIGHT = 1.7
const MOVE_SPEED  = 5

// Module-level: consistent terrain shape for the session
const noise2D = createNoise2D()

// Comet tail direction: unit vector pointing away from sun at [-220, 75, -280]
// from comet origin — precomputed so particle geometry can use it at module level
const TAIL_DIR   = new Vector3(0.668, -0.236, 0.705)
const TAIL_PERP1 = new Vector3().crossVectors(TAIL_DIR, new Vector3(0, 1, 0)).normalize()
const TAIL_PERP2 = new Vector3().crossVectors(TAIL_DIR, TAIL_PERP1).normalize()

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

// ── Space map constants ────────────────────────────────────────────────────
const SPACE_EYE_HEIGHT = 1.4
const GALACTIC_TILT    = 0.52  // axial tilt of galactic plane (≈30°)
const DUST_COUNT       =   70  // interplanetary dust — streams past cockpit
const DUST_DRIFT       = 20.0  // dust drift speed (scene units/s)

// Generates a 2048×1024 equirectangular canvas texture that resembles a
// photographic Milky Way: dark sky → faint outer band → bright inner band →
// warm amber galactic core. Dense tiny stars concentrated along the band.
function buildMilkyWayTexture() {
  const W = 2048, H = 1024
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')

  // 1. Near-black background — very faint blue so even empty sky isn't pure void
  ctx.fillStyle = '#010508'
  ctx.fillRect(0, 0, W, H)

  // 2. Galactic band glow — painted at a slight angle to simulate the tilt
  // without rotating the sphere (keeps poles safely away from camera forward).
  // Band diagonal: latN = TILT * (u - CORE_U), where CORE_U=0.75 puts the
  // warm core straight ahead (-Z = u≈0.75 in Three.js sphere UV).
  const img = ctx.getImageData(0, 0, W, H)
  const d   = img.data
  const CORE_U  = 0.75
  const TILT_UV = 0.55  // band diagonal tilt in UV space

  for (let py = 0; py < H; py++) {
    const vn = py / H                          // 0=top, 1=bottom
    const latN = 0.5 - vn                      // +0.5 top, −0.5 bottom

    for (let px = 0; px < W; px++) {
      const u   = px / W
      const du  = Math.min(Math.abs(u - CORE_U), 1 - Math.abs(u - CORE_U))
      // Tilted band centre: latN=0 shifted by tilt relative to longitude
      const bandCentre = TILT_UV * (du < 0.5 ? u - CORE_U : -(1 - Math.abs(u - CORE_U)) * Math.sign(u - CORE_U))
      const distFromBand = latN - bandCentre * 0.3

      const outer = Math.exp(-distFromBand * distFromBand / 0.007)
      const inner = Math.exp(-distFromBand * distFromBand / 0.002)
      const core  = Math.exp(-du * du / 0.020) * inner

      const idx = (py * W + px) * 4
      d[idx]   = Math.min(255, d[idx]   + Math.round(outer * 20 + inner * 30 + core *  65))
      d[idx+1] = Math.min(255, d[idx+1] + Math.round(outer * 26 + inner * 35 + core *  38))
      d[idx+2] = Math.min(255, d[idx+2] + Math.round(outer * 52 + inner * 44 + core *   8))
    }
  }
  ctx.putImageData(img, 0, 0)

  // 3. Stars: dense band (65%) + sparse halo everywhere (35%)
  // Halo covers the full sphere including poles so there's no black void cap.
  for (let i = 0; i < 18000; i++) {
    const inBand = Math.random() < 0.65
    const latRaw = inBand
      ? (Math.random() + Math.random() - 1) * 0.28
      : (Math.random() - 0.5) * Math.PI
    const lon = Math.random() * Math.PI * 2
    const px  = Math.round((lon / (Math.PI * 2)) * W) % W
    const py  = Math.round((0.5 - latRaw / Math.PI) * H)
    if (py < 0 || py >= H) continue

    const t = Math.random()
    let r, g, b
    if      (t < 0.06) { r=175; g=200; b=255 }
    else if (t < 0.36) { r=220; g=235; b=255 }
    else if (t < 0.65) { r=255; g=255; b=252 }
    else if (t < 0.80) { r=255; g=232; b=168 }
    else if (t < 0.92) { r=255; g=192; b=118 }
    else               { r=255; g=145; b=78  }

    const alpha = inBand ? 0.35 + Math.random() * 0.65 : 0.20 + Math.random() * 0.55
    const size  = Math.random() < 0.92 ? 0.6 : Math.random() < 0.65 ? 1.3 : 2.2
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(2)})`
    ctx.beginPath()
    ctx.arc(px, py, size, 0, 6.283)
    ctx.fill()
  }

  return canvas
}

// Equirectangular planet surface texture: ocean / land / highlands / polar ice.
// Uses 4-octave simplex noise sampled on the unit sphere to avoid UV seams.
function buildPlanetTexture() {
  const W = 512, H = 512
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(W, H)
  const d   = img.data
  const n   = createNoise2D()

  for (let py = 0; py < H; py++) {
    const lat    = ((py / H) - 0.5) * Math.PI
    const cosLat = Math.cos(lat)
    const v      = py / H

    for (let px = 0; px < W; px++) {
      const lon = (px / W) * Math.PI * 2
      // Sphere-space coords — avoids seam artefact on longitude wrap
      const nx = cosLat * Math.cos(lon)
      const ny = Math.sin(lat)
      const nz = cosLat * Math.sin(lon)

      // 4-octave fBm
      let h = n(nx * 1.2 + ny * 0.6, nz * 1.2 + ny * 0.4) * 1.000
            + n(nx * 2.4 + ny * 1.2, nz * 2.4 + ny * 0.8) * 0.500
            + n(nx * 4.8 + ny * 2.4, nz * 4.8 + ny * 1.6) * 0.250
            + n(nx * 9.6 + ny * 4.8, nz * 9.6 + ny * 3.2) * 0.125
      h = h / 1.875 * 0.5 + 0.5  // → [0, 1]

      // Polar ice override: boost h within top/bottom 15% of texture
      const poleProx = Math.max(0, (Math.abs(v - 0.5) * 2 - 0.70) / 0.30)
      h = Math.min(1, h + poleProx * 0.55)

      let r, g, b
      if      (h > 0.90) { r=220; g=240; b=255 }
      else if (h > 0.80) { r=148; g=132; b=115 }
      else if (h > 0.68) { r=118; g=105; b=88  }
      else if (h > 0.58) {
        const t = (h - 0.58) / 0.10
        r = Math.round(68  + t * 50); g = Math.round(112 - t * 7); b = Math.round(58 + t * 30)
      }
      else if (h > 0.50) { r=68;  g=112; b=58  }
      else if (h > 0.44) { r=52;  g=100; b=65  }
      else if (h > 0.38) { r=30;  g=82;  b=120 }
      else               { r=13;  g=46;  b=90  }

      const idx = (py * W + px) * 4
      d[idx] = r; d[idx+1] = g; d[idx+2] = b; d[idx+3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

// Cloud layer texture: white/transparent noise pattern, wraps correctly on sphere.
function buildCloudTexture() {
  const W = 512, H = 512
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(W, H)
  const d   = img.data
  const c   = createNoise2D()

  for (let py = 0; py < H; py++) {
    const lat    = ((py / H) - 0.5) * Math.PI
    const cosLat = Math.cos(lat)
    for (let px = 0; px < W; px++) {
      const lon = (px / W) * Math.PI * 2
      const nx  = cosLat * Math.cos(lon)
      const ny  = Math.sin(lat)
      const nz  = cosLat * Math.sin(lon)
      const raw = c(nx * 3.5, nz * 3.5 + ny * 2.0) * 0.5 + 0.5
      const alpha = raw > 0.52 ? Math.round(Math.pow((raw - 0.52) / 0.48, 0.55) * 210) : 0
      const idx = (py * W + px) * 4
      d[idx] = 255; d[idx+1] = 255; d[idx+2] = 255; d[idx+3] = alpha
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

// Sky sphere with the procedural Milky Way texture.
// side=BackSide renders the inner surface; GALACTIC_TILT tilts the band.
function GalacticSky() {
  const tex = useMemo(() => new CanvasTexture(buildMilkyWayTexture()), [])
  return (
    <mesh>
      <sphereGeometry args={[500, 64, 32]} />
      <meshBasicMaterial map={tex} side={1} depthWrite={false} />
    </mesh>
  )
}

// Sparse — in real space even asteroid belts are mostly empty
const ASTEROID_DATA = [
  { pos: [6,   1,  -52], size: 0.5, speed: 1.8 },  // small, nearby, slow tumble
  { pos: [-24, 6, -118], size: 1.7, speed: 0.7 },  // large, distant, barely drifts
  { pos: [40, -4,  -88], size: 0.9, speed: 1.3 },  // medium, wide off to the side
]

// Comets: bright nucleus + coma + two tails (dust and ion)
// Tail direction tilted away from sun at [-220, 75, -280]
const COMET_DATA = [
  { pos: [-42, 12, -150], speed: 0.6 },   // closer, noticeable
  { pos: [ 68, -7, -198], speed: 0.25 },  // far background, barely moves
]

// Dust only — background stars live in GalacticSky texture
function StarField() {
  const dustGeom = useMemo(() => {
    const g   = new BufferGeometry()
    const pos = new Float32Array(DUST_COUNT * 3)
    const col = new Float32Array(DUST_COUNT * 3)
    for (let i = 0; i < DUST_COUNT; i++) {
      pos[i*3]   = (Math.random() - 0.5) * 40
      pos[i*3+1] = (Math.random() - 0.5) * 40
      pos[i*3+2] = -(Math.random() * 80 + 5)
      const t = Math.random()
      if      (t < 0.60) { col[i*3]=0.55; col[i*3+1]=0.52; col[i*3+2]=0.50 }
      else if (t < 0.85) { col[i*3]=0.62; col[i*3+1]=0.65; col[i*3+2]=0.70 }
      else               { col[i*3]=0.70; col[i*3+1]=0.58; col[i*3+2]=0.48 }
    }
    g.setAttribute('position', new BufferAttribute(pos, 3))
    g.setAttribute('color',    new BufferAttribute(col, 3))
    return g
  }, [])

  useFrame((_, delta) => {
    const a = dustGeom.attributes.position
    for (let i = 0; i < DUST_COUNT; i++) {
      a.array[i*3+2] += delta * DUST_DRIFT
      if (a.array[i*3+2] > 8) {
        a.array[i*3]   = (Math.random() - 0.5) * 40
        a.array[i*3+1] = (Math.random() - 0.5) * 40
        a.array[i*3+2] = -85
      }
    }
    a.needsUpdate = true
  })

  return (
    <points geometry={dustGeom}>
      <pointsMaterial size={0.8} vertexColors sizeAttenuation={false} transparent opacity={0.40} />
    </points>
  )
}

function Planet() {
  const bodyRef  = useRef()
  const cloudRef = useRef()

  const planetTex = useMemo(() => new CanvasTexture(buildPlanetTexture()), [])
  const cloudTex  = useMemo(() => new CanvasTexture(buildCloudTexture()),  [])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    bodyRef.current.rotation.y  = t * 0.008
    cloudRef.current.rotation.y = t * 0.011
  })
  return (
    <group position={[22, 6, -100]}>
      {/* Core body — procedural continent/ocean/ice texture */}
      <mesh ref={bodyRef}>
        <sphereGeometry args={[10, 128, 128]} />
        <meshStandardMaterial map={planetTex} roughness={0.72} />
      </mesh>
      {/* Cloud layer — separate slow rotation */}
      <mesh ref={cloudRef}>
        <sphereGeometry args={[10.12, 64, 64]} />
        <meshBasicMaterial map={cloudTex} transparent depthWrite={false} />
      </mesh>
      {/* Inner atmosphere */}
      <mesh>
        <sphereGeometry args={[10.9, 128, 128]} />
        <meshBasicMaterial color="#55aaff" transparent opacity={0.22} depthWrite={false} side={2} blending={AdditiveBlending} />
      </mesh>
      {/* Outer halo */}
      <mesh>
        <sphereGeometry args={[12.4, 128, 128]} />
        <meshBasicMaterial color="#2277cc" transparent opacity={0.10} depthWrite={false} side={2} blending={AdditiveBlending} />
      </mesh>
    </group>
  )
}

function Comet({ initialPos, speed }) {
  const ref = useRef()
  useFrame((_, delta) => {
    ref.current.position.z += delta * speed
    if (ref.current.position.z > 20) {
      ref.current.position.set(initialPos[0], initialPos[1], initialPos[2] - 280)
    }
  })

  // Particle tails: no cone geometry → no tube silhouette when viewed from the side.
  // Particles are in comet-local space along TAIL_DIR (away from sun at [-220,75,-280]).
  const { dustGeom, ionGeom } = useMemo(() => {
    const DUST_N = 150, ION_N = 80
    const dustPos = new Float32Array(DUST_N * 3)
    const dustCol = new Float32Array(DUST_N * 3)
    const ionPos  = new Float32Array(ION_N  * 3)
    const ionCol  = new Float32Array(ION_N  * 3)

    for (let i = 0; i < DUST_N; i++) {
      const t = Math.random() * 32
      const r = Math.random() * 4.0
      const θ = Math.random() * Math.PI * 2
      const cθ = Math.cos(θ), sθ = Math.sin(θ)
      dustPos[i*3]   = TAIL_DIR.x*t + TAIL_PERP1.x*r*cθ + TAIL_PERP2.x*r*sθ
      dustPos[i*3+1] = TAIL_DIR.y*t + TAIL_PERP1.y*r*cθ + TAIL_PERP2.y*r*sθ
      dustPos[i*3+2] = TAIL_DIR.z*t + TAIL_PERP1.z*r*cθ + TAIL_PERP2.z*r*sθ
      const fade = 1 - t / 32
      dustCol[i*3] = 1.0; dustCol[i*3+1] = 0.55 + 0.32*fade; dustCol[i*3+2] = 0.18*fade
    }

    for (let i = 0; i < ION_N; i++) {
      const t = Math.random() * 50
      const r = Math.random() * 1.5
      const θ = Math.random() * Math.PI * 2
      const cθ = Math.cos(θ), sθ = Math.sin(θ)
      ionPos[i*3]   = TAIL_DIR.x*t + TAIL_PERP1.x*r*cθ + TAIL_PERP2.x*r*sθ
      ionPos[i*3+1] = TAIL_DIR.y*t + TAIL_PERP1.y*r*cθ + TAIL_PERP2.y*r*sθ
      ionPos[i*3+2] = TAIL_DIR.z*t + TAIL_PERP1.z*r*cθ + TAIL_PERP2.z*r*sθ
      const fade = 1 - t / 50
      ionCol[i*3] = 0.35 + 0.20*fade; ionCol[i*3+1] = 0.45 + 0.25*fade; ionCol[i*3+2] = 1.0
    }

    const dG = new BufferGeometry()
    dG.setAttribute('position', new BufferAttribute(dustPos, 3))
    dG.setAttribute('color',    new BufferAttribute(dustCol, 3))
    const iG = new BufferGeometry()
    iG.setAttribute('position', new BufferAttribute(ionPos, 3))
    iG.setAttribute('color',    new BufferAttribute(ionCol, 3))
    return { dustGeom: dG, ionGeom: iG }
  }, [])

  return (
    <group ref={ref} position={initialPos}>
      {/* Nucleus */}
      <mesh>
        <sphereGeometry args={[0.45, 10, 10]} />
        <meshBasicMaterial color="#eef4ff" />
      </mesh>
      {/* Coma */}
      <mesh>
        <sphereGeometry args={[2.0, 16, 16]} />
        <meshBasicMaterial color="#99bbff" transparent opacity={0.18} depthWrite={false} blending={AdditiveBlending} />
      </mesh>
      {/* Dust tail — warm amber particles */}
      <points geometry={dustGeom}>
        <pointsMaterial size={2.0} vertexColors sizeAttenuation={false} transparent opacity={0.55} blending={AdditiveBlending} depthWrite={false} />
      </points>
      {/* Ion tail — blue particles, straighter */}
      <points geometry={ionGeom}>
        <pointsMaterial size={1.4} vertexColors sizeAttenuation={false} transparent opacity={0.45} blending={AdditiveBlending} depthWrite={false} />
      </points>
    </group>
  )
}

// Visible star (sun) — placed in the direction of the directional light.
// Only this object emits light; everything else reflects.
function Sun() {
  return (
    <group position={[-220, 75, -280]}>
      <mesh>
        <sphereGeometry args={[7, 16, 16]} />
        <meshBasicMaterial color="#fffce0" />
      </mesh>
      <mesh>
        <sphereGeometry args={[11, 16, 16]} />
        <meshBasicMaterial color="#ffee66" transparent opacity={0.14} depthWrite={false} blending={AdditiveBlending} side={2} />
      </mesh>
      <mesh>
        <sphereGeometry args={[18, 16, 16]} />
        <meshBasicMaterial color="#ffcc22" transparent opacity={0.05} depthWrite={false} blending={AdditiveBlending} side={2} />
      </mesh>
    </group>
  )
}

function SpaceAsteroid({ initialPos, size, speed }) {
  const ref = useRef()
  useFrame((_, delta) => {
    ref.current.position.z += speed * delta
    ref.current.rotation.x += delta * 0.4
    ref.current.rotation.y += delta * 0.25
    if (ref.current.position.z > 15) {
      ref.current.position.set(
        (Math.random() - 0.5) * 60,
        (Math.random() - 0.5) * 30,
        -150
      )
    }
  })
  return (
    <mesh ref={ref} position={initialPos} castShadow>
      <dodecahedronGeometry args={[size, 1]} />
      <meshStandardMaterial color="#6a6a5a" roughness={0.95} />
    </mesh>
  )
}

function CockpitInterior() {
  const frame = { color: '#3a3f52', roughness: 0.5 }
  const dash  = { color: '#2e3347', roughness: 0.65 }

  // Eye at [0, 1.4, 0] looking -Z.
  // Glass at z=-2.8: full view spans ±3.8 wide, ±2.15 tall at that depth.
  // Glass fills nearly all forward view; frame bars sit just at the edges.
  return (
    <group>
      {/* ── Large glass windshield ── */}
      <mesh position={[0, 2.15, -2.8]}>
        <planeGeometry args={[7.2, 2.9]} />
        <meshStandardMaterial
          color="#88aaff"
          transparent
          opacity={0.07}
          roughness={0}
          depthWrite={false}
        />
      </mesh>

      {/* ── Window frame ── */}
      {/* Top bar */}
      <mesh position={[0, 3.62, -2.8]}>
        <boxGeometry args={[7.6, 0.28, 0.20]} />
        <meshStandardMaterial {...frame} />
      </mesh>
      {/* Bottom bar — top of dashboard */}
      <mesh position={[0, 0.69, -2.8]}>
        <boxGeometry args={[7.6, 0.28, 0.20]} />
        <meshStandardMaterial {...frame} />
      </mesh>
      {/* Left A-pillar */}
      <mesh position={[-3.64, 2.155, -2.8]}>
        <boxGeometry args={[0.28, 3.22, 0.20]} />
        <meshStandardMaterial {...frame} />
      </mesh>
      {/* Right A-pillar */}
      <mesh position={[3.64, 2.155, -2.8]}>
        <boxGeometry args={[0.28, 3.22, 0.20]} />
        <meshStandardMaterial {...frame} />
      </mesh>
      {/* Thin center divider */}
      <mesh position={[0, 2.155, -2.8]}>
        <boxGeometry args={[0.10, 2.9, 0.10]} />
        <meshStandardMaterial {...frame} />
      </mesh>

      {/* ── Dashboard — visible as a strip at the bottom ── */}
      <mesh position={[0, 0.92, -2.4]} rotation={[-0.28, 0, 0]}>
        <boxGeometry args={[7.2, 0.14, 0.9]} />
        <meshStandardMaterial {...dash} />
      </mesh>
      {/* Dashboard front fascia */}
      <mesh position={[0, 0.62, -2.15]} rotation={[-0.28, 0, 0]}>
        <boxGeometry args={[7.2, 0.55, 0.12]} />
        <meshStandardMaterial {...dash} />
      </mesh>

      {/* Screens on dashboard */}
      <mesh position={[-1.6, 0.96, -2.38]} rotation={[-0.28, 0, 0]}>
        <planeGeometry args={[1.6, 0.55]} />
        <meshStandardMaterial color="#001530" emissive="#003880" emissiveIntensity={2.5} />
      </mesh>
      <mesh position={[0, 0.98, -2.38]} rotation={[-0.28, 0, 0]}>
        <planeGeometry args={[1.1, 0.55]} />
        <meshStandardMaterial color="#001522" emissive="#005577" emissiveIntensity={2.8} />
      </mesh>
      <mesh position={[1.6, 0.96, -2.38]} rotation={[-0.28, 0, 0]}>
        <planeGeometry args={[1.6, 0.55]} />
        <meshStandardMaterial color="#001530" emissive="#003880" emissiveIntensity={2.5} />
      </mesh>

      {/* Blue LED trim along dashboard top edge */}
      <mesh position={[0, 1.04, -1.98]}>
        <boxGeometry args={[6.8, 0.03, 0.03]} />
        <meshStandardMaterial color="#0055ff" emissive="#0055ff" emissiveIntensity={5} />
      </mesh>

      {/* Warning dots */}
      <mesh position={[-3.0, 0.96, -2.38]} rotation={[-0.28, 0, 0]}>
        <circleGeometry args={[0.05, 8]} />
        <meshStandardMaterial color="#ff2200" emissive="#ff2200" emissiveIntensity={6} />
      </mesh>
      <mesh position={[3.0, 0.96, -2.38]} rotation={[-0.28, 0, 0]}>
        <circleGeometry args={[0.05, 8]} />
        <meshStandardMaterial color="#ff8800" emissive="#ff8800" emissiveIntensity={6} />
      </mesh>

      {/* Thin side console lips — barely visible at screen edges */}
      <mesh position={[-3.6, 1.0, -0.6]}>
        <boxGeometry args={[0.14, 0.5, 3.0]} />
        <meshStandardMaterial {...frame} />
      </mesh>
      <mesh position={[3.6, 1.0, -0.6]}>
        <boxGeometry args={[0.14, 0.5, 3.0]} />
        <meshStandardMaterial {...frame} />
      </mesh>
    </group>
  )
}

function SpaceControls({ onLock, onUnlock }) {
  const controlsRef = useRef()
  const { camera } = useThree()

  useFrame(() => {
    camera.position.set(0, SPACE_EYE_HEIGHT, 0)
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

function SpaceScene({ onLock, onUnlock }) {
  const { scene } = useThree()

  useEffect(() => {
    const prev = scene.background
    scene.background = new Color('#000008')
    return () => { scene.background = prev }
  }, [scene])

  return (
    <>
      {/* No ambient — space has no atmosphere to scatter light */}
      <ambientLight intensity={0.0} />
      {/* Star light: direction matches the visible Sun position */}
      <directionalLight position={[-220, 75, -280]} intensity={4.5} color="#fff8ee" />

      <GalacticSky />
      <StarField />
      <Sun />
      <Planet />
      {COMET_DATA.map((c, i) => (
        <Comet key={i} initialPos={c.pos} speed={c.speed} />
      ))}
      {ASTEROID_DATA.map((a, i) => (
        <SpaceAsteroid key={i} initialPos={a.pos} size={a.size} speed={a.speed} />
      ))}

      <EffectComposer>
        <SMAA />
        <Bloom luminanceThreshold={0.35} intensity={0.5} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Vignette eskil={false} offset={0.2} darkness={0.55} />
      </EffectComposer>

      <CockpitInterior />
      <SpaceControls onLock={onLock} onUnlock={onUnlock} />
    </>
  )
}

// Displaced terrain with vertex-colored grass/path blend
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

function WorldScene({ onLock, onUnlock }) {
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

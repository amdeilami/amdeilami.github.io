import { useRef, useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'
import { EffectComposer, SMAA, Bloom, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { createNoise2D } from 'simplex-noise'
import { Color, AdditiveBlending, CanvasTexture, BufferAttribute, BufferGeometry, Vector3, Euler } from 'three'

export const SPACE_EYE_HEIGHT = 1.4
const SPACE_SEAT_Z            = -0.5  // pilot seated forward of centre, near the windshield
const GALACTIC_TILT           = 0.52  // axial tilt of galactic plane (≈30°)
const DUST_COUNT              =   70  // interplanetary dust — streams past cockpit
const DUST_DRIFT              = 20.0  // dust drift speed (scene units/s)
const MAX_YAW                 = Math.PI / 2  // ±90° horizontal look limit (cockpit front only)
const LOOK_EULER              = new Euler(0, 0, 0, 'YXZ')  // reused for per-frame yaw clamp

// Cockpit pod enclosure. An enclosed cabin: below SILL_Y the shell is solid,
// lit hull (floor + all four walls); above it the shell is glass (windshield +
// side/back glass + roof). So looking down/sideways shows a real lit cabin wall,
// while forward/up shows space through glass — no floating black shapes, no void.
// The pilot (camera at [0, SPACE_EYE_HEIGHT, 0]) sits near the front, so
// POD_FRONT is close and POD_BACK is farther.
const POD_X     =  2.6   // half-width (walls at ±X)
const POD_FRONT = -1.9   // front wall / windshield z (close ahead)
const POD_BACK  =  1.5   // back wall z (behind pilot)
const FLOOR_Y   = -0.3   // floor height
const SILL_Y    =  1.05  // hull→glass transition (just above the dashboard top)
const ROOF_Y    =  2.6   // roof height

// Comet tail direction: unit vector pointing away from sun at [-220, 75, -280]
// from comet origin — precomputed so particle geometry can use it at module level
const TAIL_DIR   = new Vector3(0.668, -0.236, 0.705)
const TAIL_PERP1 = new Vector3().crossVectors(TAIL_DIR, new Vector3(0, 1, 0)).normalize()
const TAIL_PERP2 = new Vector3().crossVectors(TAIL_DIR, TAIL_PERP1).normalize()

const ASTEROID_DATA = [
  { pos: [6,   1,  -52], size: 0.5, speed: 1.8 },
  { pos: [-24, 6, -118], size: 1.7, speed: 0.7 },
  { pos: [40, -4,  -88], size: 0.9, speed: 1.3 },
]

const COMET_DATA = [
  { pos: [-42, 12, -150], speed: 0.6 },
  { pos: [ 68, -7, -198], speed: 0.25 },
]

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

// Circular instrument dial drawn on a transparent canvas — dark disc, bezel,
// tick ring, a glowing blue "value" arc, central hub + needle. The texture is
// self-lit (mapped onto meshBasicMaterial) so it reads as a powered display and
// blooms under the EffectComposer Bloom pass.
//   value : 0..1 needle position around the 270° sweep
//   arc   : 0..1 how much of the sweep the glowing arc fills
//   label : true → draw a few minor digit ticks for a busier "nav" look
function buildGaugeTexture({ value = 0.5, arc = 0.6, label = false } = {}) {
  const S = 256, c = S / 2
  const canvas = document.createElement('canvas')
  canvas.width = S; canvas.height = S
  const ctx = canvas.getContext('2d')

  const GLOW = '#1a9bff'      // bright blue glow
  const DIM  = '#0a3a66'      // dim blue ticks
  const START = Math.PI * 0.75        // sweep from 135°…
  const SWEEP = Math.PI * 1.5         // …through 270°

  // Dark inner disc
  const grad = ctx.createRadialGradient(c, c, 4, c, c, c - 6)
  grad.addColorStop(0, '#06101c')
  grad.addColorStop(1, '#020611')
  ctx.fillStyle = grad
  ctx.beginPath(); ctx.arc(c, c, c - 6, 0, 6.283); ctx.fill()

  // Outer bezel ring
  ctx.strokeStyle = '#16344f'
  ctx.lineWidth = 6
  ctx.beginPath(); ctx.arc(c, c, c - 6, 0, 6.283); ctx.stroke()

  // Tick marks around the sweep
  const TICKS = label ? 48 : 32
  for (let i = 0; i <= TICKS; i++) {
    const a = START + (SWEEP * i) / TICKS
    const major = i % 4 === 0
    const r0 = c - 14
    const r1 = c - (major ? 30 : 22)
    ctx.strokeStyle = major ? GLOW : DIM
    ctx.lineWidth = major ? 3 : 1.5
    ctx.beginPath()
    ctx.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0)
    ctx.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1)
    ctx.stroke()
  }

  // Glowing value arc
  ctx.strokeStyle = GLOW
  ctx.lineWidth = 7
  ctx.shadowColor = GLOW
  ctx.shadowBlur = 12
  ctx.beginPath()
  ctx.arc(c, c, c - 38, START, START + SWEEP * arc)
  ctx.stroke()
  ctx.shadowBlur = 0

  // Needle pointing at `value`
  const na = START + SWEEP * value
  ctx.strokeStyle = '#dff0ff'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(c, c)
  ctx.lineTo(c + Math.cos(na) * (c - 46), c + Math.sin(na) * (c - 46))
  ctx.stroke()

  // Central hub
  ctx.fillStyle = '#bfe4ff'
  ctx.beginPath(); ctx.arc(c, c, 9, 0, 6.283); ctx.fill()
  ctx.fillStyle = GLOW
  ctx.beginPath(); ctx.arc(c, c, 5, 0, 6.283); ctx.fill()

  return canvas
}

// Rectangular readout screen — faint grid + a glowing waveform/bar trace in
// blue. Self-lit like the gauges.
function buildScreenTexture({ bars = false } = {}) {
  const W = 256, H = 128
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#04101e'
  ctx.fillRect(0, 0, W, H)

  // Faint grid
  ctx.strokeStyle = '#0c2d4d'
  ctx.lineWidth = 1
  for (let x = 0; x <= W; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
  for (let y = 0; y <= H; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }

  ctx.shadowColor = '#1a9bff'
  ctx.shadowBlur = 8
  ctx.strokeStyle = '#39b0ff'
  ctx.fillStyle = '#39b0ff'

  if (bars) {
    // Bar-graph readout
    const n = 9, bw = (W - 20) / n
    for (let i = 0; i < n; i++) {
      const bh = 14 + Math.abs(Math.sin(i * 1.7)) * (H - 30)
      ctx.fillRect(12 + i * bw, H - 10 - bh, bw - 6, bh)
    }
  } else {
    // Waveform trace
    ctx.lineWidth = 2.5
    ctx.beginPath()
    for (let x = 0; x <= W; x += 4) {
      const y = H / 2 + Math.sin(x * 0.06) * 22 + Math.sin(x * 0.21) * 9
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.stroke()
  }

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

// Self-lit circular instrument dial — canvas gauge face + a dark bezel ring.
function Gauge({ position, radius, opts }) {
  const tex = useMemo(() => new CanvasTexture(buildGaugeTexture(opts)), [])
  return (
    <group position={position} rotation={[-0.28, 0, 0]}>
      <mesh>
        <circleGeometry args={[radius, 48]} />
        <meshBasicMaterial map={tex} transparent />
      </mesh>
      {/* Dark bezel rim around the dial */}
      <mesh position={[0, 0, 0.005]}>
        <torusGeometry args={[radius, radius * 0.07, 12, 48]} />
        <meshStandardMaterial color="#3a3f52" roughness={0.5} />
      </mesh>
    </group>
  )
}

// Self-lit rectangular readout screen.
function Screen({ position, size, opts }) {
  const tex = useMemo(() => new CanvasTexture(buildScreenTexture(opts)), [])
  return (
    <mesh position={position} rotation={[-0.28, 0, 0]}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={tex} />
    </mesh>
  )
}

// Glass panel — uniform unlit tint, double-sided. meshBasicMaterial (not
// Standard) so panels are NOT shaded per-orientation by the sun: every pane
// carries the same faint tint, so the canopy reads as one continuous sheet of
// glass with no hard brightness seam where panes meet at the pod corners.
function Glass({ position, rotation, args }) {
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={args} />
      <meshBasicMaterial
        color="#9fc4ff"
        transparent
        opacity={0.045}
        depthWrite={false}
        side={2}
      />
    </mesh>
  )
}

// Solid hull panel — opaque floor, double-sided. Mid-grey (not near-black) with
// a little metalness so the cabin light gives it form instead of reading as a
// black cutout against the stars.
function Hull({ position, rotation, args }) {
  return (
    <mesh position={position} rotation={rotation} receiveShadow>
      <planeGeometry args={args} />
      <meshStandardMaterial color="#2a3040" roughness={0.6} metalness={0.25} side={2} />
    </mesh>
  )
}

function CockpitInterior() {
  const dash = { color: '#2e3347', roughness: 0.65 }
  const trim = { color: '#3a3f52', roughness: 0.5 }

  // Derived pod dimensions
  const Xspan   = POD_X * 2
  const Zspan   = POD_BACK - POD_FRONT
  const Zc      = (POD_FRONT + POD_BACK) / 2
  const lowerH  = SILL_Y - FLOOR_Y          // solid hull band height
  const lowerYc = (FLOOR_Y + SILL_Y) / 2
  const upperH  = ROOF_Y - SILL_Y           // glass band height
  const upperYc = (SILL_Y + ROOF_Y) / 2
  const rim     = { color: '#1c6fff', emissive: '#1c6fff', emissiveIntensity: 2 }

  // Eye at [0, 1.4, 0] looking -Z. Enclosed cabin: lit solid hull below SILL_Y,
  // glass above. The pilot sits near the front, right up against the dashboard.
  return (
    <group>
      {/* ── Cabin lights so the hull walls + dashboard read as lit surfaces ── */}
      <pointLight position={[0, 1.5, -0.6]} intensity={7} distance={9} decay={2} color="#bcd6ff" />
      <pointLight position={[0, 1.0, 1.0]}  intensity={4} distance={8} decay={2} color="#9ec5ff" />{/* rear fill */}

      {/* ── Solid hull — floor + all four walls, below the dashboard line ── */}
      <Hull position={[0, FLOOR_Y, Zc]}      rotation={[-Math.PI / 2, 0, 0]} args={[Xspan, Zspan]} />{/* floor */}
      <Hull position={[-POD_X, lowerYc, Zc]} rotation={[0, Math.PI / 2, 0]}  args={[Zspan, lowerH]} />{/* left */}
      <Hull position={[POD_X, lowerYc, Zc]}  rotation={[0, Math.PI / 2, 0]}  args={[Zspan, lowerH]} />{/* right */}
      <Hull position={[0, lowerYc, POD_FRONT]} rotation={[0, 0, 0]}          args={[Xspan, lowerH]} />{/* front (behind dash) */}
      <Hull position={[0, lowerYc, POD_BACK]}  rotation={[0, 0, 0]}          args={[Xspan, lowerH]} />{/* back */}

      {/* ── Glass canopy — four walls + roof, above the dashboard line ── */}
      <Glass position={[0, upperYc, POD_FRONT]} rotation={[0, 0, 0]}           args={[Xspan, upperH]} />{/* windshield */}
      <Glass position={[0, upperYc, POD_BACK]}  rotation={[0, 0, 0]}           args={[Xspan, upperH]} />{/* back */}
      <Glass position={[-POD_X, upperYc, Zc]}   rotation={[0, Math.PI / 2, 0]} args={[Zspan, upperH]} />{/* left */}
      <Glass position={[POD_X, upperYc, Zc]}    rotation={[0, Math.PI / 2, 0]} args={[Zspan, upperH]} />{/* right */}
      <Glass position={[0, ROOF_Y, Zc]}         rotation={[Math.PI / 2, 0, 0]} args={[Xspan, Zspan]} />{/* roof */}

      {/* ── Sill rim — thin emissive trim framing the wall→glass transition,
            so the cabin reads as deliberate (matches the dashboard LED) ── */}
      <mesh position={[-POD_X + 0.02, SILL_Y, Zc]}>
        <boxGeometry args={[0.03, 0.03, Zspan - 0.04]} />
        <meshStandardMaterial {...rim} />
      </mesh>
      <mesh position={[POD_X - 0.02, SILL_Y, Zc]}>
        <boxGeometry args={[0.03, 0.03, Zspan - 0.04]} />
        <meshStandardMaterial {...rim} />
      </mesh>
      <mesh position={[0, SILL_Y, POD_BACK - 0.02]}>
        <boxGeometry args={[Xspan - 0.04, 0.03, 0.03]} />
        <meshStandardMaterial {...rim} />
      </mesh>

      {/* ── Dashboard — angled strip across the bottom, close to the pilot ── */}
      <mesh position={[0, 0.92, -1.5]} rotation={[-0.28, 0, 0]}>
        <boxGeometry args={[5.0, 0.14, 0.7]} />
        <meshStandardMaterial {...dash} />
      </mesh>
      {/* Dashboard front fascia */}
      <mesh position={[0, 0.64, -1.32]} rotation={[-0.28, 0, 0]}>
        <boxGeometry args={[5.0, 0.5, 0.12]} />
        <meshStandardMaterial {...dash} />
      </mesh>

      {/* ── Circular instrument gauges ── */}
      {/* Central nav dial — dominant */}
      <Gauge position={[0, 0.98, -1.46]} radius={0.40} opts={{ value: 0.62, arc: 0.72, label: true }} />
      {/* Flanking gauges */}
      <Gauge position={[-1.15, 0.94, -1.43]} radius={0.25} opts={{ value: 0.35, arc: 0.45 }} />
      <Gauge position={[1.15, 0.94, -1.43]}  radius={0.25} opts={{ value: 0.80, arc: 0.85 }} />

      {/* ── Outboard readout screens ── */}
      <Screen position={[-2.0, 0.95, -1.46]} size={[1.0, 0.45]} opts={{ bars: false }} />
      <Screen position={[2.0, 0.95, -1.46]}  size={[1.0, 0.45]} opts={{ bars: true }} />

      {/* Blue LED trim along dashboard top edge */}
      <mesh position={[0, 1.02, -1.15]}>
        <boxGeometry args={[4.8, 0.03, 0.03]} />
        <meshStandardMaterial color="#0055ff" emissive="#0055ff" emissiveIntensity={5} />
      </mesh>

      {/* Warning dots */}
      <mesh position={[-2.35, 0.95, -1.48]} rotation={[-0.28, 0, 0]}>
        <circleGeometry args={[0.05, 8]} />
        <meshStandardMaterial color="#ff2200" emissive="#ff2200" emissiveIntensity={6} />
      </mesh>
      <mesh position={[2.35, 0.95, -1.48]} rotation={[-0.28, 0, 0]}>
        <circleGeometry args={[0.05, 8]} />
        <meshStandardMaterial color="#ff8800" emissive="#ff8800" emissiveIntensity={6} />
      </mesh>

      {/* Thin side console lips — run alongside the pilot at the floor edge */}
      <mesh position={[-2.55, 0.9, -0.3]}>
        <boxGeometry args={[0.12, 0.4, 2.2]} />
        <meshStandardMaterial {...trim} />
      </mesh>
      <mesh position={[2.55, 0.9, -0.3]}>
        <boxGeometry args={[0.12, 0.4, 2.2]} />
        <meshStandardMaterial {...trim} />
      </mesh>
    </group>
  )
}

function SpaceControls({ onLock, onUnlock }) {
  const controlsRef = useRef()
  const { camera } = useThree()

  // Only the front of the cockpit is modelled, so clamp horizontal look to
  // ±90° from forward (-Z). PointerLockControls re-reads camera.quaternion on
  // each mousemove, so clamping it here makes the limit stick.
  useFrame(() => {
    camera.position.set(0, SPACE_EYE_HEIGHT, SPACE_SEAT_Z)
    LOOK_EULER.setFromQuaternion(camera.quaternion, 'YXZ')
    if (LOOK_EULER.y > MAX_YAW || LOOK_EULER.y < -MAX_YAW) {
      LOOK_EULER.y = Math.max(-MAX_YAW, Math.min(MAX_YAW, LOOK_EULER.y))
      camera.quaternion.setFromEuler(LOOK_EULER)
    }
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

export function SpaceScene({ onLock, onUnlock }) {
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

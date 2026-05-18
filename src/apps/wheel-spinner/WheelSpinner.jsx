import { useState, useEffect, useRef, useCallback } from 'react'

const COLORS = [
  '#e74c3c', '#e67e22', '#f1c40f', '#27ae60', '#1abc9c',
  '#2980b9', '#8e44ad', '#e91e63', '#00bcd4', '#8bc34a',
  '#ff5722', '#795548', '#607d8b', '#ff9800', '#cddc39',
  '#03a9f4', '#673ab7', '#c0392b', '#16a085', '#2c3e50',
]

function easeOutQuint(t) {
  return 1 - Math.pow(1 - t, 5)
}

const SIZE = 300
const CX = SIZE / 2        // 150
const CY = SIZE / 2 + 8   // 158  — slight offset down to fit pointer above
const R = CY - 25          // 133

function drawWheel(canvas, names, rotation) {
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, SIZE, SIZE)

  const count = names.length
  const seg = (2 * Math.PI) / count
  const fontSize = Math.max(9, Math.min(14, (2 * Math.PI * R * 0.58) / count / 1.6))

  for (let i = 0; i < count; i++) {
    const a0 = rotation + i * seg
    const a1 = rotation + (i + 1) * seg
    const mid = rotation + (i + 0.5) * seg

    // Segment fill
    ctx.beginPath()
    ctx.moveTo(CX, CY)
    ctx.arc(CX, CY, R, a0, a1)
    ctx.closePath()
    ctx.fillStyle = COLORS[i % COLORS.length]
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.22)'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Label along radius direction
    ctx.save()
    ctx.translate(CX, CY)
    ctx.rotate(mid)
    ctx.fillStyle = '#fff'
    ctx.shadowColor = 'rgba(0,0,0,0.7)'
    ctx.shadowBlur = 3
    ctx.font = `bold ${fontSize}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const label = names[i].length > 9 ? names[i].slice(0, 8) + '…' : names[i]
    ctx.fillText(label, R * 0.62, 0)
    ctx.restore()
  }

  // Centre hub
  ctx.beginPath()
  ctx.arc(CX, CY, 9, 0, 2 * Math.PI)
  ctx.fillStyle = 'rgba(255,255,255,0.18)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'
  ctx.lineWidth = 2
  ctx.stroke()

  // Pointer — downward triangle sitting just above the wheel edge
  const tipY = CY - R - 2
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(CX, tipY)
  ctx.lineTo(CX - 9, tipY - 18)
  ctx.lineTo(CX + 9, tipY - 18)
  ctx.closePath()
  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = 'rgba(0,0,0,0.65)'
  ctx.shadowBlur = 7
  ctx.fill()
  ctx.restore()
}

export default function WheelSpinner() {
  const [screen, setScreen] = useState('setup')
  const [countInput, setCountInput] = useState('')
  const [nameInputs, setNameInputs] = useState([])
  const [spinning, setSpinning] = useState(false)
  const [winner, setWinner] = useState(null)

  const canvasRef = useRef(null)
  const rotRef = useRef(-Math.PI / 2)
  const animRef = useRef(null)
  const namesRef = useRef([])

  const redraw = useCallback((rot) => {
    const canvas = canvasRef.current
    if (canvas && namesRef.current.length) drawWheel(canvas, namesRef.current, rot)
  }, [])

  useEffect(() => {
    if (screen === 'wheel') redraw(rotRef.current)
  }, [screen, redraw])

  useEffect(() => () => { if (animRef.current) cancelAnimationFrame(animRef.current) }, [])

  function handleCountChange(val) {
    setCountInput(val)
    const n = parseInt(val, 10)
    if (n >= 2 && n <= 20) {
      setNameInputs(prev => Array.from({ length: n }, (_, i) => prev[i] ?? ''))
    }
  }

  function handleStart(e) {
    e.preventDefault()
    const n = parseInt(countInput, 10)
    if (!n || n < 2 || n > 20) return
    namesRef.current = nameInputs.map((v, i) => v.trim() || String(i + 1))
    setWinner(null)
    setSpinning(false)
    rotRef.current = -Math.PI / 2
    setScreen('wheel')
  }

  function spin() {
    if (spinning) return
    const names = namesRef.current
    const count = names.length
    const seg = (2 * Math.PI) / count
    const winIdx = Math.floor(Math.random() * count)

    // Center of winIdx segment must land at the pointer (top = -PI/2).
    // canvas angle of that center = rotation + (winIdx + 0.5) * seg
    // solve for rotation: rotation = -PI/2 - (winIdx + 0.5) * seg  (mod 2*PI)
    const targetR = -Math.PI / 2 - (winIdx + 0.5) * seg
    const R0 = rotRef.current
    let delta = ((targetR - R0) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)
    delta += 2 * Math.PI * (5 + Math.floor(Math.random() * 4)) // 5–8 extra full spins
    const endR = R0 + delta
    const dur = 3000 + Math.random() * 1500

    setSpinning(true)
    setWinner(null)

    const t0 = performance.now()
    function frame(now) {
      const t = Math.min((now - t0) / dur, 1)
      const rot = R0 + delta * easeOutQuint(t)
      rotRef.current = rot
      redraw(rot)
      if (t < 1) {
        animRef.current = requestAnimationFrame(frame)
      } else {
        rotRef.current = endR
        redraw(endR)
        setSpinning(false)
        setWinner(winIdx)
      }
    }
    animRef.current = requestAnimationFrame(frame)
  }

  const count = parseInt(countInput, 10)
  const validCount = count >= 2 && count <= 20

  // ── Setup screen ──────────────────────────────────────────────────────────────
  if (screen === 'setup') {
    return (
      <div className="wheel-spinner">
        <h3>Setup</h3>
        <form onSubmit={handleStart}>
          <label>
            Number of people{' '}
            <span className="ws-hint">(2–20)</span>
          </label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="e.g. 6"
            value={countInput}
            onChange={e => handleCountChange(e.target.value)}
          />
          {validCount && (
            <>
              <label>
                Names{' '}
                <span className="ws-hint">— leave blank to use numbers</span>
              </label>
              <div className="ws-name-grid">
                {nameInputs.map((name, i) => (
                  <div key={i} className="ws-name-row">
                    <span className="ws-dot" style={{ background: COLORS[i % COLORS.length] }} />
                    <input
                      type="text"
                      placeholder={`Person ${i + 1}`}
                      value={name}
                      onChange={e => {
                        const next = [...nameInputs]
                        next[i] = e.target.value
                        setNameInputs(next)
                      }}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
          <button type="submit" style={{ marginTop: '0.9em' }} disabled={!validCount}>
            Build Wheel
          </button>
        </form>
      </div>
    )
  }

  // ── Wheel screen ──────────────────────────────────────────────────────────────
  const names = namesRef.current
  return (
    <div className="wheel-spinner">
      <div className="ws-canvas-wrap">
        <canvas ref={canvasRef} width={SIZE} height={SIZE} />
      </div>
      <div className="ws-controls">
        <button className="ws-spin-btn" onClick={spin} disabled={spinning}>
          {spinning ? 'Spinning…' : 'Spin!'}
        </button>
        <button onClick={() => { setWinner(null); setScreen('setup') }} disabled={spinning}>
          Edit
        </button>
      </div>
      {winner !== null && !spinning && (
        <div
          className="ws-result"
          style={{ borderColor: COLORS[winner % COLORS.length] }}
        >
          <span className="ws-result-dot" style={{ background: COLORS[winner % COLORS.length] }} />
          <span className="ws-result-name">{names[winner]}</span>
        </div>
      )}
    </div>
  )
}

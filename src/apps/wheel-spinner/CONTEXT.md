# Wheel Spinner — App Context

## Hosting context

This app is a self-contained React component launched inside the **"Me & Agents"** panel
(`src/components/panels/Agents.jsx`) of a static GitHub Pages personal portfolio site
(amdeilami.github.io). The site is built with Vite and served statically — no backend,
no SSR, no dynamic routing. The app is loaded and unmounted entirely in the browser via
React state in Agents.jsx.

---

## Purpose

A canvas-based group picker wheel. Users enter names, spin the wheel, and get a random
winner displayed in a colour-matched result card.

## Files

```
src/apps/wheel-spinner/
  WheelSpinner.jsx   ← single component, all logic + canvas drawing here
```

SCSS for this app lives in `src/styles/layout/_site.scss`, scoped inside `.wheel-spinner {}`.

---

## Technology

- React 19 (hooks only)
- HTML5 Canvas API — no external charting/animation libraries
- `requestAnimationFrame` + `easeOutQuint` easing for spin animation
- No localStorage — stateless (resets on every mount)

---

## Behaviour

- **Setup**: user enters headcount (2–20) and optional names per slot.
- **Canvas**: 300×300 px wheel, each segment colour-coded.
- **Spin**: 3–4.5 s duration, 5–8 full rotations, decelerates via `easeOutQuint`.
- **Winner**: displayed below canvas in a colour-matched `.ws-result` card with a pop-in animation.

---

## SCSS classes (all scoped inside `.wheel-spinner` in `_site.scss`)

| Class            | Purpose                                              |
|------------------|------------------------------------------------------|
| `.ws-name-grid`  | 2-column grid for name inputs; collapses to 1 col on `<=small` |
| `.ws-name-row`   | Flex row per name entry; `input { margin-bottom: 0 }` override |
| `.ws-dot`        | 11 px colour dot beside each name                   |
| `.ws-canvas-wrap`| Centred container for the canvas element            |
| `.ws-controls`   | Flex row for spin / edit buttons                    |
| `.ws-spin-btn`   | Min-width + font styling on the spin button         |
| `.ws-result`     | Winner card; `border: 2px solid` (colour via inline style) |
| `.ws-result-dot` | Colour dot in winner card                           |
| `.ws-result-name`| Winner name display                                 |
| `@keyframes ws-pop` | Pop-in animation for the winner card            |

---

## Testing

```bash
npm run dev      # hot-reload dev server at http://localhost:5173
npm run build    # compile to docs/
npm run preview  # serve docs/ at http://localhost:4173
```

Open the site → click "Me & Agents" → click the Wheel Spinner card.

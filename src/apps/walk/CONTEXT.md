# Walk — App Context

## Hosting context

This app is a self-contained React component launched inside the **"Me & Agents"** panel
(`src/components/panels/Agents.jsx`) of a static GitHub Pages personal portfolio site
(amdeilami.github.io). The site is built with Vite and served statically — no backend,
no SSR, no dynamic routing. The app is loaded and unmounted entirely in the browser via
React state in Agents.jsx.

---

## Purpose

A first-person 3D walking simulation rendered in the browser. WASD movement + mouse look
(Pointer Lock API). Desktop-only; mobile devices see a fallback message.

## Files

```
src/apps/walk/
  Walk.jsx   ← single component; Three.js scene, controls, and overlays
```

SCSS for this app lives in `src/styles/layout/_site.scss` (walk overlay classes, NOT
scoped under `.walk-app` — they are top-level classes).

---

## Technology

| Dep | Version | Role |
|-----|---------|------|
| `@react-three/fiber` | latest | React renderer for Three.js |
| `@react-three/drei` | latest | `PointerLockControls`, helpers |
| Three.js | (peer dep) | 3D engine |

**Bundle size**: these deps add ~900 kB to the JS bundle (minified, before gzip). The
Vite chunk-size warning at build time is expected and non-fatal.

No localStorage — stateless.

---

## Scene

- 20×20 unit yard with a ground plane and boundary walls.
- Camera at position `[0, 1.7, 0]` (eye height).
- WASD keys move the player; mouse controls look direction via Pointer Lock.
- ESC key intercepted at capture phase to prevent it from closing the panel.

---

## Critical gotchas

### r3f v9 — camera lookAt bug in production

r3f v9 calls `camera.lookAt(0, 0, 0)` on init when position ≠ origin. From `[0, 1.7, 0]`
that is straight down → entire canvas renders as solid ground green in production builds.

`rotation: [0, 0, 0]` in the camera prop looks like a fix and masks the bug in dev
(React StrictMode's double-render resets it), but it does NOT work in production.

**Fix:** use `onCreated` to reset the quaternion after r3f creates the camera but before
the first frame renders:

```jsx
<Canvas
  camera={{ fov: 75, near: 0.1, far: 100, position: [0, EYE_HEIGHT, 0] }}
  onCreated={({ camera }) => camera.quaternion.identity()}
>
```

`camera.quaternion.identity()` = no rotation = camera looks along −Z (correct default).
Do NOT pass `rotation` in the camera prop — it doesn't override `lookAt` in production.

### PointerLockControls — use `selector=".walk-app"`

`Panel.jsx`'s `<article>` has `onClick={e => e.stopPropagation()}` to prevent panel-close
on inner clicks. This blocks every click from reaching `document`, where drei normally
attaches the `controls.lock()` trigger.

Fix: pass `selector=".walk-app"` to `<PointerLockControls>`. This moves the handler onto
the container element, which fires before the article's `stopPropagation` kills the event.

---

## Styling

### Container div
Uses inline Tailwind utilities (safe — the template has no rules for standalone divs):
`relative w-full aspect-video max-h-[420px] bg-black rounded overflow-hidden`

Also has className `walk-app` for the `.walk-app canvas` SCSS rule.

### Overlay SCSS classes (top-level in `_site.scss`, NOT scoped)

| Class               | Purpose                                                    |
|---------------------|------------------------------------------------------------|
| `.walk-click-prompt`| Fullscreen centred prompt overlay; `p { text-align !important }` |
| `.walk-overlay`     | Bottom-anchored ESC hint; `span { bg + color + size }`    |
| `.walk-mobile-hint` | Fallback `<p>` shown on mobile devices                     |
| `.walk-app canvas`  | Three.js canvas fill override (`!important` required)      |

### Tailwind design tokens used (defined in `src/styles/tailwind.css`)

| Token                  | Value                        | Used in         |
|------------------------|------------------------------|-----------------|
| `--color-overlay-bg`   | `rgba(0,0,0,0.50)`           | `.walk-click-prompt` |
| `--color-prompt-bg`    | `rgba(0,0,0,0.35)`           | `.walk-overlay` |

---

## Testing

```bash
npm run dev      # hot-reload dev server at http://localhost:5173
npm run build    # compile to docs/
npm run preview  # serve docs/ at http://localhost:4173
```

Open the site → click "Me & Agents" → click the Walk card.
Test on desktop only (Pointer Lock requires a non-touch device).
Click inside the canvas to lock the pointer, WASD to move, ESC to release without closing the panel.

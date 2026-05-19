# Gas Calculator — App Context

## Hosting context

This app is a self-contained React component launched inside the **"Me & Agents"** panel
(`src/components/panels/Agents.jsx`) of a static GitHub Pages personal portfolio site
(amdeilami.github.io). The site is built with Vite and served statically — there is no
backend, no server-side rendering, and no dynamic routing. The app is loaded and unmounted
entirely in the browser via React state in Agents.jsx.

---

## Purpose

Tracks car refuels, computes average fuel consumption (L/100 km), and estimates remaining
range based on tank level and consumption history.

## Files

```
src/apps/gas-calculator/
  GasCalculator.jsx   ← single component, all logic here
```

SCSS for this app lives in `src/styles/layout/_site.scss`, scoped inside `.gas-calc {}`.

---

## Technology

- React 19 (hooks only — no external libraries)
- localStorage for persistence
- No canvas, no third-party deps

---

## State & persistence

| localStorage key     | Shape                                              |
|----------------------|----------------------------------------------------|
| `gas-calc-settings`  | `{ tankMax, defaultConsumption, initialFuel }`     |
| `gas-calc-log`       | Array of refuel entries                            |

`initialFuel` defaults to `tankMax` for backward compatibility with older stored data.

### Screens

- **Setup screen** — shown when no settings saved yet; user enters tank size, consumption, initial fuel.
- **Main screen** — shown after setup; log + estimates + reset controls.
  - **Reset Log** button: visible only when log has entries.
  - **Reset All** button: always visible; clears settings and returns to setup screen.

---

## SCSS classes (all scoped inside `.gas-calc` in `_site.scss`)

| Class              | Purpose                                               |
|--------------------|-------------------------------------------------------|
| `.gc-settings-bar` | Glass background bar; `button { margin-left: auto }` |
| `.calc-row`        | Side-by-side inputs; stacks on `<=small`              |
| `.fuel-bar-wrap`   | Progress bar container                                |
| `.fuel-bar`        | Green fill bar using `var(--color-fuel-bar)`          |
| `.gc-estimate`     | Flex row for fuel/range readout                       |
| `.gc-danger-row`   | Flex row for reset buttons; wraps on `<=xsmall`       |
| `.gc-reset-all`    | Danger styling — box-shadow + color (both `!important`) |
| `.history-table`   | Refuel log table                                      |

### Tailwind design tokens used (defined in `src/styles/tailwind.css`)

| Token                    | Value / use                          |
|--------------------------|--------------------------------------|
| `--color-fuel-bar`       | `#5cb85c` — green progress bar fill  |
| `--color-fuel-bg`        | `rgba(255,255,255,0.10)` — bar track |
| `--color-danger-border`  | Red outline for Reset All button     |
| `--color-danger-text`    | Red text for Reset All button        |
| `--color-danger-border-hover` | Hover state                    |
| `--color-danger-text-hover`   | Hover state                    |

---

## Key conventions

### Numeric inputs
Use `type="text" inputMode="decimal"` — NOT `type="number"`. The HTML5 UP template only
styles `input[type="text"]`; numeric fields need this to get the correct border/background.

### Button outlines
The template sets `border: 0` on all buttons and uses `box-shadow: inset 0 0 0 2px` for
the visual outline. To colour a button's outline, override `box-shadow` — never
`border-color` (it has no effect when border-width is 0).

```scss
// correct
box-shadow: inset 0 0 0 2px var(--color-danger-border) !important;
color: var(--color-danger-text) !important;
```

---

## Testing

```bash
npm run dev      # hot-reload dev server at http://localhost:5173
npm run build    # compile to docs/
npm run preview  # serve docs/ at http://localhost:4173
```

Open the site → click "Me & Agents" → click the Gas Calculator card.

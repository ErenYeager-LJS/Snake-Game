# Neon Arcade Snake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a high-effect neon arcade Snake game entirely inside `Game/`.

**Architecture:** Use a pure browser app with `index.html`, `style.css`, and `script.js`. Keep core grid logic in pure JavaScript functions exported for Node tests, while browser-only rendering uses Canvas and DOM HUD updates.

**Tech Stack:** HTML, CSS, vanilla JavaScript, Canvas 2D, Node built-in `node:test` and `assert`.

---

## File Structure

- `Game/index.html`: App shell, canvas layers, HUD, overlay, and mobile controls.
- `Game/style.css`: Responsive neon arcade styling, HUD, buttons, and visual polish.
- `Game/script.js`: Pure game logic, browser input, Canvas rendering, particles, persistence, and initialization.
- `Game/game.test.js`: Node tests for core snake rules.
- `Game/IMPLEMENTATION_PLAN.md`: This implementation plan.

### Task 1: Core Logic Tests

**Files:**
- Create: `Game/game.test.js`
- Create: `Game/script.js`

- [ ] **Step 1: Write failing tests**

Create `Game/game.test.js` with tests that import pure helpers from `script.js` and verify food generation, reverse prevention, eating, level progression, wall collision, self collision, pause, and restart.

- [ ] **Step 2: Run tests to verify failure**

Run: `node --test Game/game.test.js`

Expected: FAIL because `Game/script.js` does not exist or does not export the required helpers.

- [ ] **Step 3: Implement minimal pure logic**

Create `Game/script.js` with CommonJS-compatible exports when `module.exports` exists. Include `createInitialState`, `nextDirection`, `createFood`, `stepGame`, `togglePause`, and `restartGame`.

- [ ] **Step 4: Run tests to verify pass**

Run: `node --test Game/game.test.js`

Expected: PASS with all rule tests passing.

### Task 2: Browser App Shell

**Files:**
- Create: `Game/index.html`
- Create: `Game/style.css`
- Modify: `Game/script.js`

- [ ] **Step 1: Add app markup**

Create `Game/index.html` with one canvas, HUD fields, overlay copy, and direction/control buttons.

- [ ] **Step 2: Add neon styling**

Create `Game/style.css` with a full-screen dark arcade layout, responsive board sizing, neon HUD, and mobile controls.

- [ ] **Step 3: Connect browser runtime**

Extend `Game/script.js` so it initializes only when `document` exists, sizes the canvas, handles keyboard and touch input, updates the HUD, and starts the animation loop.

- [ ] **Step 4: Re-run logic tests**

Run: `node --test Game/game.test.js`

Expected: PASS. Browser-only code must not break Node imports.

### Task 3: High-Effect Rendering

**Files:**
- Modify: `Game/script.js`
- Modify: `Game/style.css`

- [ ] **Step 1: Add Canvas visuals**

Render animated background, neon grid, snake glow, pulsing food, scanlines, board bloom, and vignette.

- [ ] **Step 2: Add effects**

Add particles, trailing energy, level-up burst, eat pulse, game-over shockwave, and short screen shake.

- [ ] **Step 3: Re-run logic tests**

Run: `node --test Game/game.test.js`

Expected: PASS.

### Task 4: Verification

**Files:**
- Read: `Game/index.html`
- Read: `Game/style.css`
- Read: `Game/script.js`
- Read: `Game/game.test.js`

- [ ] **Step 1: Automated tests**

Run: `node --test Game/game.test.js`

Expected: PASS.

- [ ] **Step 2: Browser smoke test**

Open `Game/index.html` in a browser or local static server. Confirm the canvas is nonblank, keyboard controls work, pause works, restart works, and mobile controls are visible at narrow widths.

- [ ] **Step 3: Final file boundary check**

Run: `git status --short -- Game docs .superpowers`

Expected: only `Game/` files are listed for this task.

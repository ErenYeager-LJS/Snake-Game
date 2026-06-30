# Snake Game

A standalone neon arcade Snake game built with HTML, CSS, JavaScript, and Canvas.

## Play

Open `index.html` in a modern browser.

No build step, package installation, or development environment is required.

## Controls

- Arrow keys or `WASD`: change direction
- `Space`: pause or resume
- `Enter`: restart
- On mobile: use the on-screen direction buttons

## Features

- Neon arcade visual style
- Canvas-rendered board, snake, food, particles, trails, flashes, and screen shake
- Score, best score, level, and speed HUD
- Progressive speed increase every 5 foods
- Wall and self-collision game-over logic
- Best score saved with `localStorage`
- Responsive layout for desktop and mobile browsers

## Project Files

- `index.html`: game page
- `style.css`: visual design and responsive layout
- `script.js`: game logic, rendering, input, effects, and persistence
- `game.test.js`: Node tests for core game rules
- `IMPLEMENTATION_PLAN.md`: implementation notes

## Run Tests

If Node.js is installed:

```bash
node --test game.test.js
```

## Deploy

This project is a static site. It can be hosted on GitHub Pages, Netlify, Cloudflare Pages, or any static web server.

For GitHub Pages, publish the `main` branch from the repository root.

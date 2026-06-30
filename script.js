(function (root) {
  "use strict";

  const DIRECTIONS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  function sameCell(a, b) {
    return a.x === b.x && a.y === b.y;
  }

  function cloneState(state) {
    return {
      ...state,
      snake: state.snake.map((cell) => ({ ...cell })),
      food: { ...state.food },
      direction: { ...state.direction },
      pendingDirection: { ...state.pendingDirection },
      effects: state.effects ? [...state.effects] : [],
    };
  }

  function nextDirection(current, requested) {
    if (!requested) return { ...current };
    if (current.x + requested.x === 0 && current.y + requested.y === 0) {
      return { ...current };
    }
    return { ...requested };
  }

  function createFood(state, rng = Math.random) {
    const total = state.gridSize * state.gridSize;
    const occupied = new Set(state.snake.map((cell) => `${cell.x},${cell.y}`));

    if (occupied.size >= total) {
      return null;
    }

    for (let attempts = 0; attempts < total * 2; attempts += 1) {
      const index = Math.floor(rng() * total) % total;
      const cell = {
        x: index % state.gridSize,
        y: Math.floor(index / state.gridSize),
      };
      if (!occupied.has(`${cell.x},${cell.y}`)) return cell;
    }

    for (let y = 0; y < state.gridSize; y += 1) {
      for (let x = 0; x < state.gridSize; x += 1) {
        if (!occupied.has(`${x},${y}`)) return { x, y };
      }
    }

    return null;
  }

  function createInitialState(options = {}) {
    const gridSize = options.gridSize || 24;
    const center = Math.floor(gridSize / 2);
    const snake = [
      { x: center + 1, y: center },
      { x: center, y: center },
      { x: center - 1, y: center },
      { x: center - 2, y: center },
    ];
    const state = {
      gridSize,
      mode: "running",
      score: 0,
      bestScore: options.bestScore || 0,
      level: 1,
      foodsEaten: 0,
      speedMs: 130,
      snake,
      direction: { ...DIRECTIONS.right },
      pendingDirection: { ...DIRECTIONS.right },
      food: { x: 0, y: 0 },
      reason: "",
      effects: [],
    };
    state.food = createFood(state, options.rng || Math.random);
    return state;
  }

  function speedForLevel(level) {
    return Math.max(54, 130 - (level - 1) * 10);
  }

  function stepGame(state, rng = Math.random) {
    if (state.mode !== "running") {
      return cloneState(state);
    }

    const next = cloneState(state);
    const direction = nextDirection(next.direction, next.pendingDirection);
    const head = next.snake[0];
    const newHead = {
      x: head.x + direction.x,
      y: head.y + direction.y,
    };

    next.direction = direction;
    next.pendingDirection = direction;

    if (
      newHead.x < 0 ||
      newHead.y < 0 ||
      newHead.x >= next.gridSize ||
      newHead.y >= next.gridSize
    ) {
      next.mode = "gameover";
      next.reason = "wall";
      next.bestScore = Math.max(next.bestScore, next.score);
      return next;
    }

    const ateFood = next.food && sameCell(newHead, next.food);
    const bodyToCheck = ateFood ? next.snake : next.snake.slice(0, -1);
    if (bodyToCheck.some((cell) => sameCell(cell, newHead))) {
      next.mode = "gameover";
      next.reason = "self";
      next.bestScore = Math.max(next.bestScore, next.score);
      return next;
    }

    next.snake.unshift(newHead);

    if (ateFood) {
      next.score += 100 * next.level;
      next.foodsEaten += 1;
      next.bestScore = Math.max(next.bestScore, next.score);
      next.level = Math.floor(next.foodsEaten / 5) + 1;
      next.speedMs = speedForLevel(next.level);
      next.food = createFood(next, rng);
      next.effects.push({ type: "eat", x: newHead.x, y: newHead.y });
      if (next.foodsEaten % 5 === 0) {
        next.effects.push({ type: "level", level: next.level });
      }
    } else {
      next.snake.pop();
    }

    return next;
  }

  function togglePause(state) {
    const next = cloneState(state);
    if (next.mode === "running") next.mode = "paused";
    else if (next.mode === "paused") next.mode = "running";
    return next;
  }

  function restartGame(state = {}, rng = Math.random) {
    return createInitialState({
      gridSize: state.gridSize || 24,
      bestScore: state.bestScore || 0,
      rng,
    });
  }

  const api = {
    DIRECTIONS,
    createInitialState,
    createFood,
    nextDirection,
    stepGame,
    togglePause,
    restartGame,
  };

  function startBrowserGame() {
    const canvas = document.getElementById("gameCanvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const stage = document.getElementById("stage");
    const overlay = document.getElementById("overlay");
    const stateLabel = document.getElementById("stateLabel");
    const stateTitle = document.getElementById("stateTitle");
    const stateText = document.getElementById("stateText");
    const flare = document.getElementById("screenFlare");
    const hud = {
      score: document.getElementById("score"),
      bestScore: document.getElementById("bestScore"),
      level: document.getElementById("level"),
      speed: document.getElementById("speed"),
    };

    const storageKey = "neon-snake-best-score";
    let state = createInitialState({ bestScore: loadBestScore() });
    state.mode = "ready";

    let particles = [];
    let trails = [];
    let shockwaves = [];
    let lastFrame = performance.now();
    let accumulator = 0;
    let viewSize = 900;
    let dpr = 1;

    function loadBestScore() {
      try {
        return Number(localStorage.getItem(storageKey)) || 0;
      } catch (_error) {
        return 0;
      }
    }

    function saveBestScore(value) {
      try {
        localStorage.setItem(storageKey, String(value));
      } catch (_error) {
        // Storage can be unavailable for local files in some browser modes.
      }
    }

    function resizeCanvas() {
      const rect = canvas.getBoundingClientRect();
      viewSize = Math.max(320, Math.floor(Math.min(rect.width, rect.height)));
      dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
      canvas.width = Math.floor(viewSize * dpr);
      canvas.height = Math.floor(viewSize * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function setMode(nextMode) {
      state.mode = nextMode;
      accumulator = 0;
      syncHud();
    }

    function startRound() {
      if (state.mode === "ready" || state.mode === "gameover") {
        const bestScore = state.bestScore;
        state = restartGame({ gridSize: state.gridSize, bestScore });
        particles = [];
        trails = [];
        shockwaves = [];
        burstAt(state.snake[0], "#62f7ff", 34, 1.3);
        pulseScreen();
      } else if (state.mode === "paused") {
        setMode("running");
      }
      syncHud();
    }

    function restartRound() {
      const bestScore = state.bestScore;
      state = restartGame({ gridSize: state.gridSize, bestScore });
      particles = [];
      trails = [];
      shockwaves = [];
      burstAt(state.snake[0], "#9cff4a", 42, 1.45);
      pulseScreen();
      syncHud();
    }

    function pauseRound() {
      if (state.mode === "ready") return;
      state = togglePause(state);
      pulseScreen();
      syncHud();
    }

    function requestDirection(direction) {
      if (state.mode === "ready") startRound();
      if (state.mode !== "running") return;
      state.pendingDirection = nextDirection(state.direction, direction);
    }

    function cellCenter(cell) {
      const cellSize = viewSize / state.gridSize;
      return {
        x: cell.x * cellSize + cellSize / 2,
        y: cell.y * cellSize + cellSize / 2,
      };
    }

    function burstAt(cell, color, count, power) {
      const center = cellCenter(cell);
      for (let i = 0; i < count; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (1.8 + Math.random() * 4.8) * power;
        particles.push({
          x: center.x,
          y: center.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 420 + Math.random() * 480,
          maxLife: 900,
          size: 1.4 + Math.random() * 3.8,
          color,
        });
      }
    }

    function addTrail(cell) {
      const center = cellCenter(cell);
      trails.push({
        x: center.x,
        y: center.y,
        life: 280,
        maxLife: 280,
        radius: viewSize / state.gridSize * 0.48,
      });
      if (trails.length > 80) trails.splice(0, trails.length - 80);
    }

    function pulseScreen() {
      if (!flare) return;
      flare.classList.remove("active");
      void flare.offsetWidth;
      flare.classList.add("active");
    }

    function shakeStage() {
      if (!stage) return;
      stage.classList.remove("shake");
      void stage.offsetWidth;
      stage.classList.add("shake");
    }

    function handleStepEffects(next) {
      for (const effect of next.effects || []) {
        if (effect.type === "eat") {
          burstAt({ x: effect.x, y: effect.y }, "#ff4fd2", 28, 1.15);
          pulseScreen();
        }
        if (effect.type === "level") {
          burstAt(next.snake[0], "#ffd166", 64, 1.6);
          shockwaves.push({ ...cellCenter(next.snake[0]), life: 520, maxLife: 520 });
          shakeStage();
        }
      }
      next.effects = [];
    }

    function updateSimulation(delta) {
      particles = particles
        .map((particle) => ({
          ...particle,
          x: particle.x + particle.vx,
          y: particle.y + particle.vy,
          vx: particle.vx * 0.982,
          vy: particle.vy * 0.982,
          life: particle.life - delta,
        }))
        .filter((particle) => particle.life > 0);

      trails = trails
        .map((trail) => ({ ...trail, life: trail.life - delta }))
        .filter((trail) => trail.life > 0);

      shockwaves = shockwaves
        .map((wave) => ({ ...wave, life: wave.life - delta }))
        .filter((wave) => wave.life > 0);

      if (state.mode !== "running") return;

      accumulator += delta;
      while (accumulator >= state.speedMs) {
        accumulator -= state.speedMs;
        const beforeMode = state.mode;
        const beforeBest = state.bestScore;
        state = stepGame(state);
        addTrail(state.snake[0]);
        handleStepEffects(state);

        if (state.bestScore !== beforeBest) saveBestScore(state.bestScore);
        if (beforeMode === "running" && state.mode === "gameover") {
          burstAt(state.snake[0], "#ff4f68", 90, 1.8);
          shockwaves.push({ ...cellCenter(state.snake[0]), life: 700, maxLife: 700 });
          shakeStage();
          pulseScreen();
        }
      }
    }

    function drawRoundedRect(x, y, width, height, radius) {
      const r = Math.min(radius, width / 2, height / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + width - r, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + r);
      ctx.lineTo(x + width, y + height - r);
      ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
      ctx.lineTo(x + r, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }

    function drawBackground(time) {
      ctx.clearRect(0, 0, viewSize, viewSize);

      const bg = ctx.createLinearGradient(0, 0, viewSize, viewSize);
      bg.addColorStop(0, "#060912");
      bg.addColorStop(0.52, "#101522");
      bg.addColorStop(1, "#070b10");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, viewSize, viewSize);

      const cellSize = viewSize / state.gridSize;
      const drift = (time * 0.018) % cellSize;
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = "rgba(98, 247, 255, 0.15)";
      ctx.lineWidth = 1;
      for (let x = -cellSize + drift; x <= viewSize + cellSize; x += cellSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, viewSize);
        ctx.stroke();
      }
      for (let y = -cellSize + drift; y <= viewSize + cellSize; y += cellSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(viewSize, y);
        ctx.stroke();
      }
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = "rgba(255, 79, 210, 0.22)";
      ctx.lineWidth = 2;
      for (let y = (time * 0.045) % 28; y < viewSize; y += 28) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(viewSize, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawFood(time) {
      if (!state.food) return;
      const center = cellCenter(state.food);
      const cellSize = viewSize / state.gridSize;
      const pulse = 0.5 + Math.sin(time * 0.008) * 0.5;

      ctx.save();
      ctx.shadowColor = "#ff4fd2";
      ctx.shadowBlur = 26 + pulse * 18;
      const gradient = ctx.createRadialGradient(center.x, center.y, 1, center.x, center.y, cellSize * 0.55);
      gradient.addColorStop(0, "#fff7fb");
      gradient.addColorStop(0.38, "#ff4fd2");
      gradient.addColorStop(1, "rgba(255, 79, 210, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(center.x, center.y, cellSize * (0.32 + pulse * 0.08), 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(255, 209, 102, ${0.45 + pulse * 0.35})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(center.x, center.y, cellSize * (0.5 + pulse * 0.16), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    function drawSnake(time) {
      const cellSize = viewSize / state.gridSize;
      const gap = Math.max(2, cellSize * 0.1);

      ctx.save();
      for (const trail of trails) {
        const alpha = trail.life / trail.maxLife;
        ctx.globalAlpha = alpha * 0.34;
        ctx.fillStyle = "#62f7ff";
        ctx.shadowColor = "#62f7ff";
        ctx.shadowBlur = 22;
        ctx.beginPath();
        ctx.arc(trail.x, trail.y, trail.radius * (1.2 - alpha * 0.3), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      state.snake.forEach((cell, index) => {
        const t = index / Math.max(1, state.snake.length - 1);
        const x = cell.x * cellSize + gap;
        const y = cell.y * cellSize + gap;
        const size = cellSize - gap * 2;
        const headPulse = index === 0 ? Math.sin(time * 0.014) * 0.08 + 1 : 1;
        const hue = 178 - t * 80;

        ctx.save();
        ctx.shadowColor = index === 0 ? "#9cff4a" : "#62f7ff";
        ctx.shadowBlur = index === 0 ? 26 : 16;
        ctx.fillStyle = `hsl(${hue} 92% ${58 - t * 12}%)`;
        drawRoundedRect(
          x + (size - size * headPulse) / 2,
          y + (size - size * headPulse) / 2,
          size * headPulse,
          size * headPulse,
          size * 0.32,
        );
        ctx.fill();

        ctx.globalAlpha = 0.38;
        ctx.fillStyle = "#ffffff";
        drawRoundedRect(x + size * 0.18, y + size * 0.16, size * 0.28, size * 0.18, size * 0.1);
        ctx.fill();
        ctx.restore();
      });
    }

    function drawParticles() {
      ctx.save();
      for (const particle of particles) {
        const alpha = Math.max(0, particle.life / particle.maxLife);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = particle.color;
        ctx.shadowColor = particle.color;
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * (0.6 + alpha), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      ctx.save();
      for (const wave of shockwaves) {
        const progress = 1 - wave.life / wave.maxLife;
        ctx.globalAlpha = 1 - progress;
        ctx.strokeStyle = "#ffd166";
        ctx.shadowColor = "#ffd166";
        ctx.shadowBlur = 22;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(wave.x, wave.y, progress * viewSize * 0.38, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawVignette() {
      const gradient = ctx.createRadialGradient(
        viewSize / 2,
        viewSize / 2,
        viewSize * 0.15,
        viewSize / 2,
        viewSize / 2,
        viewSize * 0.72,
      );
      gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0.52)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, viewSize, viewSize);
    }

    function render(time) {
      drawBackground(time);
      drawFood(time);
      drawSnake(time);
      drawParticles();
      drawVignette();
    }

    function syncHud() {
      hud.score.textContent = String(state.score);
      hud.bestScore.textContent = String(state.bestScore);
      hud.level.textContent = String(state.level);
      hud.speed.textContent = `${(130 / state.speedMs).toFixed(1)}x`;

      const visible = state.mode !== "running";
      overlay.classList.toggle("visible", visible);

      if (state.mode === "ready") {
        stateLabel.textContent = "READY";
        stateTitle.textContent = "NEON SNAKE";
        stateText.textContent = "PRESS START";
      } else if (state.mode === "paused") {
        stateLabel.textContent = "PAUSED";
        stateTitle.textContent = "HOLD";
        stateText.textContent = `SCORE ${state.score}`;
      } else if (state.mode === "gameover") {
        stateLabel.textContent = state.reason === "wall" ? "WALL HIT" : "SIGNAL LOST";
        stateTitle.textContent = "GAME OVER";
        stateText.textContent = `SCORE ${state.score}`;
      }
    }

    function loop(now) {
      const delta = Math.min(48, now - lastFrame);
      lastFrame = now;
      updateSimulation(delta);
      render(now);
      syncHud();
      requestAnimationFrame(loop);
    }

    const keyMap = {
      ArrowUp: DIRECTIONS.up,
      KeyW: DIRECTIONS.up,
      ArrowDown: DIRECTIONS.down,
      KeyS: DIRECTIONS.down,
      ArrowLeft: DIRECTIONS.left,
      KeyA: DIRECTIONS.left,
      ArrowRight: DIRECTIONS.right,
      KeyD: DIRECTIONS.right,
    };

    window.addEventListener("keydown", (event) => {
      if (keyMap[event.code]) {
        event.preventDefault();
        requestDirection(keyMap[event.code]);
      } else if (event.code === "Space") {
        event.preventDefault();
        pauseRound();
      } else if (event.code === "Enter") {
        event.preventDefault();
        restartRound();
      }
    });

    document.getElementById("startBtn").addEventListener("click", startRound);
    document.getElementById("pauseBtn").addEventListener("click", pauseRound);
    document.getElementById("restartBtn").addEventListener("click", restartRound);

    document.querySelectorAll("[data-dir]").forEach((button) => {
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        requestDirection(DIRECTIONS[button.dataset.dir]);
      });
    });

    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();
    syncHud();
    requestAnimationFrame(loop);
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.SnakeGame = api;

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", startBrowserGame);
    } else {
      startBrowserGame();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);

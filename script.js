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
      directionQueue: (state.directionQueue || []).map((direction) => ({ ...direction })),
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

  function queueDirection(state, requested) {
    if (!requested) return cloneState(state);
    const next = cloneState(state);
    const queue = next.directionQueue || [];
    const baseDirection = queue.length ? queue[queue.length - 1] : next.direction;
    const accepted = nextDirection(baseDirection, requested);

    if (accepted.x === baseDirection.x && accepted.y === baseDirection.y) {
      return next;
    }

    if (queue.length >= 3) {
      queue.shift();
    }

    queue.push(accepted);
    next.directionQueue = queue;
    next.pendingDirection = queue[0] || accepted;
    return next;
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
      speedMs: 260,
      snake,
      direction: { ...DIRECTIONS.right },
      pendingDirection: { ...DIRECTIONS.right },
      directionQueue: [],
      food: { x: 0, y: 0 },
      reason: "",
      effects: [],
    };
    state.food = createFood(state, options.rng || Math.random);
    return state;
  }

  function speedForLevel(level) {
    return Math.max(108, 260 - (level - 1) * 20);
  }

  function stepGame(state, rng = Math.random) {
    if (state.mode !== "running") {
      return cloneState(state);
    }

    const next = cloneState(state);
    const queuedDirection = next.directionQueue && next.directionQueue.length
      ? next.directionQueue.shift()
      : next.pendingDirection;
    const direction = nextDirection(next.direction, queuedDirection);
    const head = next.snake[0];
    const newHead = {
      x: head.x + direction.x,
      y: head.y + direction.y,
    };

    next.direction = direction;
    next.pendingDirection = next.directionQueue && next.directionQueue.length ? next.directionQueue[0] : direction;

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

  function normalizePlayerName(name) {
    return String(name || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 24);
  }

  function createPlayerKey(name) {
    return normalizePlayerName(name).toLocaleLowerCase();
  }

  function mergeLeaderboardRecord(records, displayName, score, achievedAt = new Date().toISOString()) {
    const normalized = normalizePlayerName(displayName);
    const playerKey = createPlayerKey(normalized);
    if (!playerKey) return [...records];

    const nextRecord = {
      player_key: playerKey,
      display_name: normalized,
      best_score: Math.max(0, Number(score) || 0),
      achieved_at: achievedAt,
    };

    const existing = records.find((record) => record.player_key === playerKey);
    if (existing && existing.best_score >= nextRecord.best_score) {
      return [...records];
    }

    const withoutExisting = records.filter((record) => record.player_key !== playerKey);
    return [...withoutExisting, nextRecord].sort((a, b) => {
      if (b.best_score !== a.best_score) return b.best_score - a.best_score;
      return new Date(b.achieved_at).getTime() - new Date(a.achieved_at).getTime();
    });
  }

  const api = {
    DIRECTIONS,
    createInitialState,
    createFood,
    nextDirection,
    queueDirection,
    stepGame,
    togglePause,
    restartGame,
    normalizePlayerName,
    createPlayerKey,
    mergeLeaderboardRecord,
  };

  function startBrowserGame() {
    const SUPABASE_URL = "https://omjjsiocfiovzbsrnwdi.supabase.co";
    const SUPABASE_KEY = "sb_publishable_O-JOgFyrS4267KpMlUUrZw_ZnFUseb8";
    const canvas = document.getElementById("gameCanvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const stage = document.getElementById("stage");
    const overlay = document.getElementById("overlay");
    const stateLabel = document.getElementById("stateLabel");
    const stateTitle = document.getElementById("stateTitle");
    const stateText = document.getElementById("stateText");
    const flare = document.getElementById("screenFlare");
    const playerModal = document.getElementById("playerModal");
    const confirmPlayerModal = document.getElementById("confirmPlayerModal");
    const recordsModal = document.getElementById("recordsModal");
    const playerNameInput = document.getElementById("playerNameInput");
    const playerStartBtn = document.getElementById("playerStartBtn");
    const playerSuggestions = document.getElementById("playerSuggestions");
    const playerHint = document.getElementById("playerHint");
    const confirmPlayerText = document.getElementById("confirmPlayerText");
    const confirmPlayerBtn = document.getElementById("confirmPlayerBtn");
    const cancelConfirmPlayerBtn = document.getElementById("cancelConfirmPlayerBtn");
    const recordsBtn = document.getElementById("recordsBtn");
    const closeRecordsBtn = document.getElementById("closeRecordsBtn");
    const recordsSearchInput = document.getElementById("recordsSearchInput");
    const recordsTable = document.getElementById("recordsTable");
    const toastLane = document.getElementById("toastLane");
    const hud = {
      score: document.getElementById("score"),
      bestScore: document.getElementById("bestScore"),
      level: document.getElementById("level"),
      speed: document.getElementById("speed"),
    };

    const storageKey = "neon-snake-best-score";
    const playerStorageKey = "neon-snake-current-player";
    const leaderboardStorageKey = "neon-snake-leaderboard";
    let state = createInitialState({ bestScore: loadBestScore() });
    state.mode = "ready";
    let currentPlayer = null;
    let pendingPlayer = null;
    let leaderboard = loadLocalLeaderboard();
    let scoreSubmittedForRound = false;

    let particles = [];
    let trails = [];
    let shockwaves = [];
    let lastFrame = performance.now();
    let accumulator = 0;
    let viewSize = 900;
    let dpr = 1;
    let audioContext = null;

    function getAudioContext() {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return null;
      if (!audioContext) audioContext = new AudioCtor();
      if (audioContext.state === "suspended") audioContext.resume();
      return audioContext;
    }

    function tone(frequency, start, duration, type, gain, endFrequency) {
      const audio = getAudioContext();
      if (!audio) return;

      const oscillator = audio.createOscillator();
      const amp = audio.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      if (endFrequency) {
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
      }
      amp.gain.setValueAtTime(0.0001, start);
      amp.gain.exponentialRampToValueAtTime(gain, start + 0.015);
      amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(amp);
      amp.connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.03);
    }

    function noiseBurst(start, duration, gain) {
      const audio = getAudioContext();
      if (!audio) return;

      const bufferSize = Math.max(1, Math.floor(audio.sampleRate * duration));
      const buffer = audio.createBuffer(1, bufferSize, audio.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i += 1) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }

      const source = audio.createBufferSource();
      const filter = audio.createBiquadFilter();
      const amp = audio.createGain();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(900, start);
      filter.frequency.exponentialRampToValueAtTime(120, start + duration);
      amp.gain.setValueAtTime(gain, start);
      amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      source.buffer = buffer;
      source.connect(filter);
      filter.connect(amp);
      amp.connect(audio.destination);
      source.start(start);
      source.stop(start + duration);
    }

    function playSound(name) {
      const audio = getAudioContext();
      if (!audio) return;
      const now = audio.currentTime;

      if (name === "start") {
        tone(196, now, 0.08, "sine", 0.06, 392);
        tone(392, now + 0.08, 0.09, "triangle", 0.07, 784);
      } else if (name === "eat") {
        tone(540, now, 0.055, "triangle", 0.055, 880);
        tone(980, now + 0.04, 0.07, "sine", 0.04, 1320);
      } else if (name === "level") {
        tone(330, now, 0.08, "square", 0.045, 660);
        tone(495, now + 0.07, 0.08, "square", 0.045, 990);
        tone(740, now + 0.14, 0.12, "triangle", 0.055, 1480);
      } else if (name === "pause") {
        tone(360, now, 0.07, "sine", 0.035, 180);
      } else if (name === "gameover") {
        tone(220, now, 0.24, "sawtooth", 0.07, 130);
        tone(146, now + 0.14, 0.32, "square", 0.055, 74);
        tone(92, now + 0.36, 0.42, "sawtooth", 0.065, 46);
        noiseBurst(now + 0.05, 0.55, 0.12);
      }
    }

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

    function loadLocalLeaderboard() {
      try {
        const parsed = JSON.parse(localStorage.getItem(leaderboardStorageKey) || "[]");
        return Array.isArray(parsed) ? parsed : [];
      } catch (_error) {
        return [];
      }
    }

    function saveLocalLeaderboard(records) {
      leaderboard = records.slice(0, 100);
      try {
        localStorage.setItem(leaderboardStorageKey, JSON.stringify(leaderboard));
      } catch (_error) {
        // Local fallback is best effort only.
      }
    }

    function loadSavedPlayer() {
      try {
        const saved = JSON.parse(localStorage.getItem(playerStorageKey) || "null");
        if (saved && saved.player_key && saved.display_name) return saved;
      } catch (_error) {
        // Ignore invalid saved profile data.
      }
      return null;
    }

    function saveCurrentPlayer(player) {
      try {
        localStorage.setItem(playerStorageKey, JSON.stringify(player));
      } catch (_error) {
        // Player selection is recoverable.
      }
    }

    async function supabaseRequest(path, options = {}) {
      const response = await fetch(`${SUPABASE_URL}${path}`, {
        ...options,
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
      });

      if (!response.ok) {
        throw new Error(`Supabase request failed: ${response.status}`);
      }

      if (response.status === 204) return null;
      return response.json();
    }

    async function fetchRemoteLeaderboard() {
      const rows = await supabaseRequest(
        "/rest/v1/leaderboard?select=player_key,display_name,best_score,achieved_at&order=best_score.desc,achieved_at.desc&limit=100",
      );
      if (Array.isArray(rows)) {
        saveLocalLeaderboard(rows);
      }
      return leaderboard;
    }

    async function submitRemoteScore(displayName, score) {
      const rows = await supabaseRequest("/rest/v1/rpc/submit_score", {
        method: "POST",
        body: JSON.stringify({
          p_display_name: displayName,
          p_score: score,
        }),
      });
      if (Array.isArray(rows) && rows[0]) {
        saveLocalLeaderboard(mergeLeaderboardRecord(leaderboard, rows[0].display_name, rows[0].best_score, rows[0].achieved_at));
      }
      return rows;
    }

    function showToast(message) {
      const toast = document.createElement("div");
      toast.className = "toast";
      toast.textContent = message;
      toastLane.appendChild(toast);
      window.setTimeout(() => toast.remove(), 3000);
    }

    function setModalVisible(modal, visible) {
      modal.classList.toggle("visible", visible);
    }

    function formatDate(value) {
      if (!value) return "-";
      return new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value));
    }

    function matchingPlayers(query) {
      const key = createPlayerKey(query);
      return leaderboard
        .filter((record) => !key || record.player_key.includes(key) || createPlayerKey(record.display_name).includes(key))
        .slice(0, 8);
    }

    function renderPlayerSuggestions() {
      const matches = matchingPlayers(playerNameInput.value);
      playerSuggestions.innerHTML = "";
      for (const record of matches) {
        const button = document.createElement("button");
        button.className = "suggestion";
        button.type = "button";
        button.innerHTML = `<strong>${record.display_name}</strong><span>${record.best_score} · ${formatDate(record.achieved_at)}</span>`;
        button.addEventListener("click", () => askPlayerConfirmation(record));
        playerSuggestions.appendChild(button);
      }
      playerHint.textContent = matches.length ? "点击已有名字需要确认身份。" : "没有找到旧记录，输入后将作为新选手加入。";
    }

    function renderRecords() {
      const query = recordsSearchInput.value;
      const rows = matchingPlayers(query);
      recordsTable.innerHTML = "";

      if (!rows.length) {
        const empty = document.createElement("div");
        empty.className = "empty-records";
        empty.textContent = "暂无记录";
        recordsTable.appendChild(empty);
        return;
      }

      rows.forEach((record, index) => {
        const row = document.createElement("div");
        row.className = "record-row";
        row.innerHTML = `
          <div class="record-rank">#${index + 1}</div>
          <div class="record-name">${record.display_name}</div>
          <div class="record-score">${record.best_score}</div>
          <div class="record-date">${formatDate(record.achieved_at)}</div>
        `;
        recordsTable.appendChild(row);
      });
    }

    function askPlayerConfirmation(record) {
      pendingPlayer = record;
      confirmPlayerText.textContent = `${record.display_name} · 最高分 ${record.best_score}`;
      setModalVisible(confirmPlayerModal, true);
    }

    function applyPlayer(record, returning) {
      currentPlayer = {
        player_key: record.player_key,
        display_name: record.display_name,
      };
      saveCurrentPlayer(currentPlayer);
      setModalVisible(playerModal, false);
      setModalVisible(confirmPlayerModal, false);
      showToast(returning ? "欢迎你，老家伙" : "欢迎你，新来的");
      syncHud();
    }

    function submitPlayerName() {
      const name = normalizePlayerName(playerNameInput.value);
      if (!name) {
        playerHint.textContent = "先留下名字，再进场。";
        return;
      }

      const key = createPlayerKey(name);
      const existing = leaderboard.find((record) => record.player_key === key);
      if (existing) {
        askPlayerConfirmation(existing);
        return;
      }

      const record = {
        player_key: key,
        display_name: name,
        best_score: 0,
        achieved_at: new Date().toISOString(),
      };
      saveLocalLeaderboard(mergeLeaderboardRecord(leaderboard, name, 0, record.achieved_at));
      applyPlayer(record, false);
    }

    async function refreshLeaderboard() {
      try {
        await fetchRemoteLeaderboard();
      } catch (_error) {
        // Keep using locally cached records if the network is unavailable.
      }
      renderPlayerSuggestions();
      renderRecords();
    }

    async function recordFinalScore() {
      if (!currentPlayer || scoreSubmittedForRound) return;
      scoreSubmittedForRound = true;

      const achievedAt = new Date().toISOString();
      saveLocalLeaderboard(mergeLeaderboardRecord(leaderboard, currentPlayer.display_name, state.score, achievedAt));
      renderRecords();

      try {
        await submitRemoteScore(currentPlayer.display_name, state.score);
        await refreshLeaderboard();
      } catch (_error) {
        renderRecords();
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
      if (!currentPlayer) {
        setModalVisible(playerModal, true);
        playerNameInput.focus();
        return;
      }
      if (state.mode === "ready" || state.mode === "gameover") {
        const bestScore = state.bestScore;
        state = restartGame({ gridSize: state.gridSize, bestScore });
        scoreSubmittedForRound = false;
        particles = [];
        trails = [];
        shockwaves = [];
        burstAt(state.snake[0], "#62f7ff", 34, 1.3);
        pulseScreen();
        playSound("start");
      } else if (state.mode === "paused") {
        setMode("running");
        playSound("start");
      }
      syncHud();
    }

    function restartRound() {
      if (!currentPlayer) {
        setModalVisible(playerModal, true);
        playerNameInput.focus();
        return;
      }
      const bestScore = state.bestScore;
      state = restartGame({ gridSize: state.gridSize, bestScore });
      scoreSubmittedForRound = false;
      particles = [];
      trails = [];
      shockwaves = [];
      burstAt(state.snake[0], "#9cff4a", 42, 1.45);
      pulseScreen();
      playSound("start");
      syncHud();
    }

    function pauseRound() {
      if (state.mode === "ready") return;
      state = togglePause(state);
      pulseScreen();
      playSound("pause");
      syncHud();
    }

    function requestDirection(direction) {
      if (state.mode === "ready") startRound();
      if (state.mode !== "running") return;
      state = queueDirection(state, direction);
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
          playSound("eat");
        }
        if (effect.type === "level") {
          burstAt(next.snake[0], "#ffd166", 64, 1.6);
          shockwaves.push({ ...cellCenter(next.snake[0]), life: 520, maxLife: 520 });
          shakeStage();
          playSound("level");
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
          playSound("gameover");
          recordFinalScore();
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
      hud.speed.textContent = `${(260 / state.speedMs).toFixed(1)}x`;

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
        stateTitle.textContent = "菜，就多练";
        stateText.textContent = `SCORE ${state.score} · PRESS ENTER`;
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
    recordsBtn.addEventListener("click", async () => {
      setModalVisible(recordsModal, true);
      recordsSearchInput.value = "";
      renderRecords();
      await refreshLeaderboard();
      recordsSearchInput.focus();
    });
    closeRecordsBtn.addEventListener("click", () => setModalVisible(recordsModal, false));
    playerStartBtn.addEventListener("click", submitPlayerName);
    playerNameInput.addEventListener("input", renderPlayerSuggestions);
    playerNameInput.addEventListener("keydown", (event) => {
      if (event.code === "Enter") submitPlayerName();
    });
    confirmPlayerBtn.addEventListener("click", () => {
      if (pendingPlayer) applyPlayer(pendingPlayer, true);
    });
    cancelConfirmPlayerBtn.addEventListener("click", () => {
      pendingPlayer = null;
      setModalVisible(confirmPlayerModal, false);
      playerNameInput.focus();
    });
    recordsSearchInput.addEventListener("input", renderRecords);

    document.querySelectorAll("[data-dir]").forEach((button) => {
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        requestDirection(DIRECTIONS[button.dataset.dir]);
      });
    });

    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();
    const savedPlayer = loadSavedPlayer();
    if (savedPlayer) {
      playerNameInput.value = savedPlayer.display_name;
    }
    refreshLeaderboard();
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

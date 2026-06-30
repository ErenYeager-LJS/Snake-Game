const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createInitialState,
  createFood,
  nextDirection,
  stepGame,
  togglePause,
  restartGame,
  normalizePlayerName,
  createPlayerKey,
  mergeLeaderboardRecord,
} = require("./script.js");

test("createInitialState creates a valid snake and food", () => {
  const state = createInitialState({ gridSize: 24, rng: () => 0.9 });

  assert.equal(state.gridSize, 24);
  assert.equal(state.mode, "running");
  assert.equal(state.snake.length, 4);
  assert.equal(
    state.snake.some((cell) => cell.x === state.food.x && cell.y === state.food.y),
    false,
  );
});

test("createFood skips cells occupied by the snake", () => {
  const state = {
    gridSize: 4,
    snake: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ],
  };
  const picks = [0 / 16, 1 / 16, 5 / 16];
  const food = createFood(state, () => picks.shift());

  assert.deepEqual(food, { x: 1, y: 1 });
});

test("nextDirection rejects direct reverse movement", () => {
  assert.deepEqual(nextDirection({ x: 1, y: 0 }, { x: -1, y: 0 }), { x: 1, y: 0 });
  assert.deepEqual(nextDirection({ x: 1, y: 0 }, { x: 0, y: -1 }), { x: 0, y: -1 });
});

test("stepGame grows and scores after eating food", () => {
  const state = createInitialState({ gridSize: 8, rng: () => 0.8 });
  state.snake = [
    { x: 2, y: 2 },
    { x: 1, y: 2 },
  ];
  state.direction = { x: 1, y: 0 };
  state.pendingDirection = { x: 1, y: 0 };
  state.food = { x: 3, y: 2 };

  const next = stepGame(state, () => 0.9);

  assert.equal(next.score, 100);
  assert.equal(next.foodsEaten, 1);
  assert.equal(next.snake.length, 3);
  assert.deepEqual(next.snake[0], { x: 3, y: 2 });
});

test("stepGame increases level after every fifth food", () => {
  const state = createInitialState({ gridSize: 8, rng: () => 0.8 });
  state.snake = [
    { x: 2, y: 2 },
    { x: 1, y: 2 },
  ];
  state.direction = { x: 1, y: 0 };
  state.pendingDirection = { x: 1, y: 0 };
  state.food = { x: 3, y: 2 };
  state.foodsEaten = 4;
  state.level = 1;
  state.speedMs = 130;

  const next = stepGame(state, () => 0.9);

  assert.equal(next.foodsEaten, 5);
  assert.equal(next.level, 2);
  assert.ok(next.speedMs < 130);
});

test("stepGame ends the game on wall collision", () => {
  const state = createInitialState({ gridSize: 6, rng: () => 0.8 });
  state.snake = [{ x: 5, y: 2 }];
  state.direction = { x: 1, y: 0 };
  state.pendingDirection = { x: 1, y: 0 };

  const next = stepGame(state);

  assert.equal(next.mode, "gameover");
  assert.equal(next.reason, "wall");
});

test("stepGame ends the game on self collision", () => {
  const state = createInitialState({ gridSize: 8, rng: () => 0.8 });
  state.snake = [
    { x: 3, y: 3 },
    { x: 3, y: 2 },
    { x: 2, y: 2 },
    { x: 2, y: 3 },
    { x: 2, y: 4 },
  ];
  state.direction = { x: 0, y: -1 };
  state.pendingDirection = { x: 0, y: -1 };

  const next = stepGame(state);

  assert.equal(next.mode, "gameover");
  assert.equal(next.reason, "self");
});

test("togglePause stops simulation ticks without resetting state", () => {
  const state = createInitialState({ gridSize: 8, rng: () => 0.8 });
  const paused = togglePause(state);
  const stepped = stepGame(paused);

  assert.equal(paused.mode, "paused");
  assert.deepEqual(stepped, paused);
  assert.equal(togglePause(paused).mode, "running");
});

test("restartGame resets active state and preserves best score", () => {
  const state = createInitialState({ gridSize: 8, rng: () => 0.8 });
  state.score = 700;
  state.bestScore = 900;
  state.mode = "gameover";

  const restarted = restartGame(state, () => 0.7);

  assert.equal(restarted.score, 0);
  assert.equal(restarted.bestScore, 900);
  assert.equal(restarted.mode, "running");
  assert.equal(restarted.gridSize, 8);
});

test("normalizePlayerName trims whitespace and limits length", () => {
  assert.equal(normalizePlayerName("  Neon   Player  "), "Neon Player");
  assert.equal(normalizePlayerName("abcdefghijklmnopqrstuvwxy"), "abcdefghijklmnopqrstuvwx");
});

test("createPlayerKey makes case-insensitive player identities", () => {
  assert.equal(createPlayerKey("  Alice  "), "alice");
  assert.equal(createPlayerKey("ALICE"), "alice");
});

test("mergeLeaderboardRecord creates and updates only better scores", () => {
  const first = mergeLeaderboardRecord([], "Alice", 120, "2026-07-01T10:00:00.000Z");
  assert.deepEqual(first, [
    {
      player_key: "alice",
      display_name: "Alice",
      best_score: 120,
      achieved_at: "2026-07-01T10:00:00.000Z",
    },
  ]);

  const unchanged = mergeLeaderboardRecord(first, "alice", 90, "2026-07-01T11:00:00.000Z");
  assert.deepEqual(unchanged, first);

  const updated = mergeLeaderboardRecord(first, "ALICE", 220, "2026-07-01T12:00:00.000Z");
  assert.deepEqual(updated, [
    {
      player_key: "alice",
      display_name: "ALICE",
      best_score: 220,
      achieved_at: "2026-07-01T12:00:00.000Z",
    },
  ]);
});

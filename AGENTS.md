# Agent Handoff Notes

This directory is a standalone static browser game. Keep all project files inside `Game/`; the parent workspace contains unrelated work and must not be committed or modified for this project.

## Current State

- Main app URL after GitHub Pages deploy: `https://erenyeager-ljs.github.io/Snake-Game/`
- GitHub remote: `git@github.com:ErenYeager-LJS/Snake-Game.git`
- Gitee remote: `git@gitee.com:eren-yeagerljs/snake.git`
- Current main commit at handoff: `0ec43d5 feat: add shared leaderboard`
- GitHub Pages publishes from `main` branch, repository root.

## Files

- `index.html`: page shell, HUD, canvas, player-name modal, confirmation modal, records modal, controls.
- `style.css`: neon arcade styling, enlarged D-pad, modals, records table, toast animation.
- `script.js`: core snake rules, Canvas rendering, effects, Web Audio, player identity flow, Supabase leaderboard, local fallback.
- `game.test.js`: Node `node:test` tests for game rules and leaderboard helper functions.
- `README.md`: user-facing project summary.
- `IMPLEMENTATION_PLAN.md`: original implementation plan, kept for context.
- `AGENTS.md`: this handoff file.

## How To Run Locally

From `Game/`:

```bash
python -m http.server 8765 --bind 127.0.0.1
```

Open:

```text
http://127.0.0.1:8765/
```

Directly opening `index.html` also works for basic play, but use a local server when testing Supabase/network behavior.

## Verification

Run from `Game/`:

```bash
node --test game.test.js
node --check script.js
```

Expected at handoff:

- 12 tests pass.
- `script.js` syntax check exits 0.

For browser smoke tests, verify:

- Initial player modal says `输入你的名字吧，挑战者`.
- New player shows toast `欢迎你，新来的`.
- Existing player search shows confirmation `确认这个是你？`.
- Confirming existing player shows toast `欢迎你，老家伙`.
- Records modal loads shared rows from Supabase.
- Death overlay says `菜，就多练`.
- D-pad buttons are visibly 1.5x larger than the original version.

## Supabase Leaderboard

The game uses Supabase REST/RPC directly from browser code.

Current public config in `script.js`:

```js
SUPABASE_URL = "https://omjjsiocfiovzbsrnwdi.supabase.co"
SUPABASE_KEY = "sb_publishable_O-JOgFyrS4267KpMlUUrZw_ZnFUseb8"
```

This is a publishable browser key, not a secret key. Do not add a `service_role`, `secret`, or JWT secret to this static repo.

Expected database table:

```sql
public.leaderboard (
  id bigserial primary key,
  player_key text unique not null,
  display_name text not null,
  best_score integer not null default 0,
  achieved_at timestamptz not null default now(),
  created_at timestamptz not null default now()
)
```

RLS must allow anonymous read on `public.leaderboard`. Anonymous score writes are done through `public.submit_score(text, integer)` with `security definer`.

The working RPC function was fixed to avoid PL/pgSQL `player_key` ambiguity by using a SQL function and the unique constraint name `leaderboard_player_key_key`.

## Important Behavior

- Player names are normalized by `normalizePlayerName`: trim, collapse whitespace, max 24 chars.
- Player identity is case-insensitive via `createPlayerKey`.
- Returning player selection requires confirmation; saved local player names only prefill the input and do not bypass confirmation.
- Scores only update when the new score is higher than the existing best score.
- Movement input uses `directionQueue`; this preserves rapid valid turns across movement ticks instead of overwriting a single pending direction.
- Initial speed is intentionally slow: `speedMs` starts at `260`, which is half the original game speed. Level speed uses the same doubled timing scale.
- Shared leaderboard reads/writes Supabase. If Supabase/network fails, local `localStorage` fallback keeps the game usable.
- Audio uses Web Audio generated tones/noise; there are no external audio files.
- The app has no build step and no package dependencies.

## Git Notes

This `Game/` directory is its own Git repository nested under a larger unrelated workspace.

Push GitHub with Windows OpenSSH because the default `ssh` on this machine is an old MSYS build that cannot authenticate with GitHub:

```powershell
$env:GIT_SSH='C:\Windows\System32\OpenSSH\ssh.exe'
git push github main
```

Gitee push works with the existing remote:

```bash
git push origin main
```

After pushing GitHub, GitHub Pages starts `pages build and deployment`. The public URL can take a few minutes to update; users may need `Ctrl + F5`.

## Boundaries

- Keep all new files for this project inside `Game/`.
- Do not modify, delete, or commit files from the parent `E:\VS_PY` repository.
- Do not commit generated browser profiles, temporary servers, screenshots, or `.superpowers`/`docs` folders outside `Game/`.
- Do not expose private Supabase keys or GitHub tokens in source.

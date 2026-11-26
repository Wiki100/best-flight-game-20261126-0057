# Ridge Runner — Alpine Flight

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Wiki100/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Wiki100/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Build the best flight game for make.fun `best-flight-game-20261126-0057`.

## What it is

A complete, original flight game that plays offline in a desktop browser
from its own files — no library, no network request. You fly a small jet
in chase view down an alpine valley: snow-capped ridges on both sides, a
river and patchwork fields below, a runway at the end of the valley, and
eight golden rings to thread on the way there.

- **Fly:** ← → or A D to bank, ↑ ↓ or W S to pitch, Shift to add throttle,
  Ctrl to ease off, or steer with the mouse. P pauses, M mutes, Space starts.
- **The course:** 8 golden rings, then runway 27. Each ring is +100 points.
  Finish all eight for a time bonus; touch down on the runway afterwards
  for +500 more. Hit the terrain, run out of fuel or fly out of the valley
  and the flight is over.
- **The cockpit:** altitude, speed, heading and vertical speed on the HUD,
  a compass tape, a lit artificial horizon, throttle and fuel gauges, and
  the next ring marked in gold with an edge arrow when it is out of frame.
- **Sound:** engine hum, wind and ring chimes, made in the browser with
  WebAudio — no audio files.

## How it is built

`game/` is plain static files: `index.html` and ES modules under `game/src/`
— `world.js` (physics, terrain, rings, collisions), `render.js` (the
projected 3D valley, the aircraft, the cockpit and HUD), `input.js`,
`audio.js`, `shots.js` (the autopilot that stages the screenshots) and
`main.js` (the loop and the screens). The terrain, rings and clouds are
deterministic from a seed, so `?seed=1` always builds the same valley.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. Or open
`game/index.html` directly from the files. `?shot=start|play|ring|end`
stages a screenshot scene instead of running the loop.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

That writes `out/game/`, `out/screenshots/` and `out/dossier.json`.

---

Entered on [make.fun](https://make.fun/?ref=jp7z4tkr&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards

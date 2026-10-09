# Pocket Racers

A free, colourful, kid-friendly racing game for phones and tablets, built with
**only HTML, CSS and vanilla JavaScript** — no frameworks, libraries, CDNs or
external services. Everything (cars, scenery, sound) is generated in code.

> **Status: Phase 1 — driving prototype.** One car, one test loop, practice
> traffic, three touch control schemes, infinite nitro, collisions and a HUD.
> Not yet: races/AI opponents, garage, multiple tracks, offline service worker,
> IndexedDB saves (settings use `localStorage` for now).

## Run locally

```sh
npm run serve          # http://localhost:5173  (zero-dependency static server)
```

Any static server works; there is no build step. Tilt steering needs HTTPS
on real devices (use the Vercel deployment).

Developer extras: append `?tune` to the URL for a live handling-tuning panel.
Keyboard (development only): arrows/WASD, Space = nitro, Esc/P = pause.

## Tests

```sh
npm test               # unit tests (Node's built-in test runner)
npm run test:e2e       # headless mobile Chromium, real multi-touch (needs Playwright installed globally)
```

## Structure

```
index.html             app shell, HUD, touch controls, menus
styles/main.css        interface styles (mobile-first, safe areas)
src/main.js            bootstrap + screen flow
src/core/              fixed-timestep loop, settings, math utils
src/data/              car + track definitions (data, not code paths)
src/world/track.js     pseudo-3D track builder (segments, curves, hills, scenery)
src/sim/session.js     driving physics, collisions, traffic, lap timing (pure, testable)
src/input/             touch buttons / steering wheel / tilt / keyboard → one input state
src/render/            road renderer, procedural car + scenery art, particles
src/audio/audio.js     Web Audio synthesised engine, nitro, impacts
src/ui/                HUD, dev tuning panel
tests/                 unit + e2e
tools/                 dev server, icon rasteriser (not shipped)
```

## Rendering approach

Behind-the-car pseudo-3D: the road is a loop of short segments projected to
the screen each frame (the classic arcade technique), with curves and hills.
Physics runs at a fixed 120 Hz so handling is identical at any frame rate.

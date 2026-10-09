# Pocket Racers

A free, colourful, kid-friendly racing game for phones and tablets, built with
**only HTML, CSS and vanilla JavaScript** — no frameworks, libraries, CDNs or
external services. Everything (cars, scenery, sound) is generated in code.

> **Status: Phase 2A — 3D engine.** Real-time 3D (hand-written WebGL) with a
> chase camera, one car, the "Sunny Valley" loop (hills, banked corners, a rock
> tunnel, a bridge over a lake), practice traffic, three touch control
> schemes, infinite nitro, collisions and a HUD.
> Next: 2B garage & cars · 2C races, AI & interactions · 2D more maps ·
> then offline service worker and IndexedDB saves.

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
src/world/track3d.js   closed-spline 3D track → segments (curvature, banking, flags, colliders)
src/sim/session.js     driving physics, collisions, traffic, lap timing (pure, testable)
src/input/             touch buttons / steering wheel / tilt / keyboard → one input state
src/gl/                WebGL helpers, shaders, matrix math, mesh builder
src/render3d/          renderer, terrain, track/scenery meshes, car models, sky, particles
src/audio/audio.js     Web Audio synthesised engine, nitro, impacts
src/ui/                HUD, dev tuning panel
tests/                 unit + e2e
tools/                 dev server, icon rasteriser (not shipped)
```

## Rendering approach

Real 3D with hand-written WebGL (no libraries): flat-shaded, vertex-coloured
low-poly geometry generated in code — terrain, road, tunnels, bridges, trees,
buildings and cars. Static geometry is merged into chunks and culled by
distance/direction. The simulation is track-relative (distance along the
track + lateral offset), so physics stays simple and deterministic; it runs
at a fixed 120 Hz so handling is identical at any frame rate.

Append `?tune` for the handling panel. `window.__pocketRacers.renderer.debugCamera
= { eye: [x, y, z], target: [x, y, z] }` freezes the camera for inspection.

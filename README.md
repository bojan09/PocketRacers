# Pocket Racers

A free, colourful, kid-friendly racing game for phones and tablets, built with
**only HTML, CSS and vanilla JavaScript** — no frameworks, libraries, CDNs or
external services. Everything (cars, scenery, sound) is generated in code.

> **Status: Phase 2B — realism pass.** Real-time 3D (hand-written WebGL):
> sun shadow mapping, glossy clear-coat paint and glass with sky
> reflections, smooth-shaded terrain and trees, procedural asphalt/grass
> detail texture, animated reflective water, shader sky with sun glow, soft
> clouds, smooth lofted car bodies with detailed wheels. One car, the
> "Sunny Valley" loop (hills, banked corners, tunnel hill, bridge over a
> lake), practice traffic, three touch control schemes, infinite nitro.
>
> **Phase 2C — fun & scoring:** jump ramps with airtime, near-miss points,
> collectible stars (rows + arcs over ramps), boost pads, knock-over cones,
> drift points, a ×5 combo multiplier, pop-ups, confetti and trick sounds.
> Points are banked (localStorage for now) for future unlocks.
>
> **Phase 2D — vehicle platform & garage:** 12 vehicles across 9 families
> (race, sports, muscle, hatch, jeep, SUV, pickup, monster truck, cab-over
> cargo truck), each with its own handling and engine sound (8 engine
> profiles incl. diesel with turbo whistle and air brakes). 3D turntable
> garage: unlock with earned points, paint (body/accent/stripes), rims,
> livery and ride height. All vehicle names are invented.
>
> **Phase 2E — tricks & Super Nitro:** steer in the air to spin (360 / 720 /
> 1080), barrel-roll ramps, a mega ramp, corkscrews (roll + spin), always
> wheels-down landings. Tricks fill a gold Super Nitro meter: tap the gold
> button for a faster, free boost with a shockwave that bumps traffic aside.
>
> **Phase 2F — races & AI:** 8-event career (race, knockout, time trial;
> off-road, speed, monster and truck-only cups) unlocked with stars. 5 AI
> opponents drive the same physics (jumps included), with difficulty levels
> and gentle catch-up. Countdown, positions, final lap, results with stars
> and points; loaner vehicles so no event is ever blocked.
>
> **Phase 2G — maps:** five maps — Sunny Valley, Desert Canyon (sunset,
> dust, mesas), Snowy Peaks (snowfall, slippery grip, snowmen), Night City
> (night, rain, wet roads, lit towers, headlights and street-lamp pools) and
> Tropical Coast (islands, sea to the horizon, palms). Map picker for free
> drive; 12 career events spread across all maps.
>
> Next: 2H full 50-vehicle roster & deep customisation · 3 offline,
> achievements, performance pass.

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
src/core/              fixed-timestep loop, settings, points wallet, garage save
src/data/              vehicle families + roster, traffic, events, tracks/ (one file per map)
src/world/track3d.js   closed-spline 3D track → segments (curvature, banking, flags, colliders)
src/sim/session.js     driving physics, jumps, collisions, traffic, lap timing (pure, testable)
src/sim/fun.js         stars, cones, boost pads, near misses, drifts, tricks, combo scoring
src/sim/ai.js          AI racing driver (same inputs and physics as the player)
src/sim/race.js        race director: grid, countdown, laps, positions, elimination, results
src/input/             touch buttons / steering wheel / tilt / keyboard → one input state
src/gl/                WebGL helpers, shaders, matrix math, mesh builder
src/render3d/          renderer, terrain, track/scenery meshes, car models, sky, particles
src/audio/             Web Audio: per-family engine profiles + gearbox, optional recorded loops, effects
src/ui/                HUD, garage screen, dev tuning panel
tests/                 unit + e2e
tools/                 dev server, icon rasteriser (not shipped)
```

## Rendering approach

Real 3D with hand-written WebGL (no libraries): vertex-coloured geometry
generated in code — terrain, road, tunnels, bridges, trees, buildings and
cars — lit by a sun with a shadow map (High/Medium), sky-reflection
specular for paint/glass/water, and a tileable procedural detail texture. Static geometry is merged into chunks and culled by
distance/direction. The simulation is track-relative (distance along the
track + lateral offset), so physics stays simple and deterministic; it runs
at a fixed 120 Hz so handling is identical at any frame rate.

Append `?tune` for the handling panel. `window.__pocketRacers.renderer.debugCamera
= { eye: [x, y, z], target: [x, y, z] }` freezes the camera for inspection.

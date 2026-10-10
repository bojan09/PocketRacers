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
> **Phase 2H — full roster & deep customisation:** 53 vehicles (formula
> racers, prototypes, wedge supercars, muscle, hot hatches, open-top jeeps,
> luxury SUVs, lifted pickups, monster trucks with car/SUV/hatch bodies, box,
> tanker, tipper and flatbed trucks). Body kits (spoilers, GT wings,
> splitters, skirts, scoops/blowers, light bars, bull bars), 7 liveries,
> window tints, neon underglow, and 4 performance upgrades × 5 levels.
>
> **Phase 3 — offline, badges, performance:** a service worker caches the
> whole game, so the installed app plays with no connection (updates download
> in the background and apply on the next visit to the title screen).
> 26 badges with progress bars and point rewards. Graphics "Auto" (the new
> default) watches real frame times while driving and steps High → Medium →
> Low on devices that can't keep up.
>
> **Phase 4A — menus for young children:** "Who's playing?" animal profiles
> (each child has their own cars, stars and badges; an older save becomes
> 🦊's, and more players are added behind the grown-up lock). Home is three picture buttons — ▶ Play (straight into the
> next race), 🗺️ Drive (picture map cards) and 🚗 Garage (icon tabs). Pause
> and results are icon-only. Settings, the full race list and player
> management sit behind a grown-up lock (a two-digit sum). "Not yet" and
> "bought" sounds replace text-only feedback.
>
> **Phase 4B — Little Driver:** per-player driving help, on by default and
> switchable by grown-ups. Corners push the car outward less, the road edge
> gently steers it back, and a car stuck off the road or going nowhere is
> rescued (🛟) after 2.5 s. ▶ Play skips knockout races and AI rivals drop
> one difficulty level.
>
> **Phase 4C — delight without reading:** silly roof toppers (👑 🦆 🦄 🦈,
> free, in the garage's ✨ tab); a 📯 HONK button (or H) that makes traffic
> ahead move over and nearby animals jump; 15 hidden animals, three per map
> (some in tunnels and on bridges), found by driving past them and collected
> in a sticker book on the badges screen; fireworks, a fanfare, a podium with
> the player's animal and confetti for top-three finishes.
>
> **Phase 5 — looks and smashing:** wheel openings are cut as exact arches
> (dark liner, trim lip), fender bulges blend into the body, spoilers and
> roof rails rest on the real roof, plus softly darker lower panels and door
> shut lines. Nitro (trail, flames, sparkles, button ring) glows in the
> car's own colour instead of a rainbow. Each map scatters smashable props
> on its verges (hay bales, fences, crates, barrels, mailboxes, gifts, bins,
> beach balls) that fly off for points and combos; trees, rocks and
> buildings stay solid. In free drive Little Driver no longer pulls the car
> back onto the road, so children can roam and smash; races keep the pull.
>
> **Phase 6 — more vehicles:** tractors with hay or log trailers, big rigs
> towing box, tanker, log and car-carrier semi-trailers (trailers follow the
> path of the hitch, so they swing through corners and never jack-knife),
> motorbikes (scooter, dirt bike, sport bike, chopper) with a helmeted rider
> that lean into turns and wheelie on nitro, buses (city, school,
> double-decker, coach), a fire engine and a cement mixer. Each new type has
> a garage filter chip and a badge.
>
> **Phase 7A — the island (open world, first step):** a 🏝️ Island card in
> 🗺️ Drive opens a seeded island about 3 km across that you can drive
> anywhere on. The landscape is built in 128 m chunks around the car as it
> drives (one per frame, nearest first) and dropped when far away. Free
> driving uses the same handling, nitro, Super Nitro, jumps and tricks as
> the tracks; cresting hills at speed launches the car; driving into the sea
> splashes and brings the car back to the last dry spot. Roads, areas,
> props, landmarks and the explore map follow in 7B–7F; an endless world in
> 7G.
>
> **Phase 7B — areas and scenery:** the island has meadows (with houses and
> barns), forests, an eastern desert, snowy peaks and beaches, each with its
> own ground colour and scenery placed from the seed (the same every time).
> Trees, rocks and buildings are solid; hay bales, fences, crates, barrels,
> gifts and beach balls fly off for points. Little Driver turns a wedged car
> free, and the camera slides in rather than ending up inside a tree.
>
> **Phase 7C — roads:** a winding ring road round the island and five roads
> from the middle out to it, cut into the land (flat across, the ground
> blending into the road bed, raised where they cross water), with edge and
> centre lines. Roads are the fastest surface and stay clear of scenery; the
> drive starts on one.
>
> **Phase 7D — things to find:** a stunt park of six ramps beside the start,
> kicker ramps along the ring road, a castle on a meadow hilltop, a
> lighthouse with a cottage on the coast and windmills near the start. Five
> island animals (bunny, owl, camel, penguin, crab) hide in their own areas;
> driving up to one says hello and the first visit adds a sticker (the
> sticker book has a new Island row). Honking makes nearby animals hop.
>
> **Phase 7E — island map:** a small round map in the corner turns with the
> car; land you have not driven near yet is under clouds, and the 🏠 on its
> rim points the way home. Tap it for the whole island (the car waits) with
> how much is uncovered, found animals, landmarks seen and a 🏠 button that
> drives you straight home. Each player's map is saved separately; badges
> for uncovering 25% and 80%.

## Tests

GitHub Actions runs the unit tests (`npm test`) and the headless-Chromium
end-to-end test (`npm run test:e2e`) on every push; screenshots are uploaded
as a build artifact.

## Run locally

```sh
npm run serve          # http://localhost:5173  (zero-dependency static server)
```

Any static server works; there is no build step. Tilt steering needs HTTPS
on real devices (use the Vercel deployment).

Offline: the service worker only registers over HTTPS (append `?sw` to test
it on localhost). After changing any shipped file run `npm run sw` to restamp
`sw.js`; a unit test fails if it is stale.

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

// End-to-end smoke test in headless Chromium with mobile emulation and real
// multi-touch (CDP touch events). Development-only: uses the globally
// installed Playwright; the game itself has no dependencies.
//
//   node tests/e2e/smoke.mjs [screenshotDir]

import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { startServer } from '../../tools/serve.mjs';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}

const shots = process.argv[2];
if (shots) mkdirSync(shots, { recursive: true });

const server = await startServer(0);
const base = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();
const results = [];
let failed = 0;

async function check(name, fn) {
  try {
    await fn();
    results.push(`  ok   ${name}`);
  } catch (e) {
    failed++;
    results.push(`  FAIL ${name}\n       ${e.message.split('\n')[0]}`);
  }
  console.log(results[results.length - 1]);
}

async function open(viewport, query = '', quality = 'low') {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  // Headless Chromium rasterises WebGL in software, so functional checks run
  // on the Low preset to stay fast; rendering cost is measured separately.
  await context.addInitScript((q) => {
    if (!localStorage.getItem('pocketracers.settings')) {
      localStorage.setItem('pocketracers.settings', JSON.stringify({ v: 1, data: { graphics: q } }));
    }
    // One player (🦊), so the game opens on the home screen.
    if (!localStorage.getItem('pocketracers.profiles')) {
      localStorage.setItem('pocketracers.profiles', JSON.stringify({ v: 1, list: ['fox'], current: 'fox' }));
    }
  }, quality);
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + query);
  await page.waitForFunction(() => window.__pocketRacers);
  const cdp = await context.newCDPSession(page);
  return { context, page, errors, cdp };
}

const center = (page, sel) =>
  page.$eval(sel, (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  });

const touch = (cdp, type, points) =>
  cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: p.id ?? i + 1 })) });

const state = (page) =>
  page.evaluate(() => {
    const g = window.__pocketRacers;
    const p = g.session.player;
    return { mode: g.mode, z: p.z, x: p.x, speed: p.speed, steer: p.steer, nitro: p.nitro, touch: { ...g.input.touch.state }, scheme: g.settings.controlScheme };
  });

/** Home → Drive → tap a map card (the current one by default). */
async function drive(page, map = null) {
  await page.click('#btn-drive');
  await page.click(map ? `.map-card[data-map="${map}"]` : '.map-card[aria-current="true"]');
  await page.waitForFunction(() => window.__pocketRacers.mode === 'driving');
  await page.waitForTimeout(200);
}

/** Answer the grown-up sum and open the grown-up panel from home. */
async function grownup(page) {
  await page.click('#btn-grownup');
  const q = await page.textContent('#gate-q');
  const [a, b] = q.split('+').map(Number);
  for (const d of String(a + b)) await page.click(`#gate-keys [data-key="${d}"]`);
  await page.waitForSelector('#screen-grownup:not([hidden])');
}

/** Pause and go back to the home screen. */
async function home(page) {
  await page.click('#btn-pause');
  await page.click('#btn-menu');
  await page.waitForFunction(() => window.__pocketRacers.mode === 'title');
}

const PLAYER = (key) => `pocketracers.${key}@fox`;

// ------------------------------------------------------------- landscape
{
  const { context, page, errors, cdp } = await open({ width: 844, height: 390 });

  await check('title screen renders without errors', async () => {
    assert.equal((await state(page)).mode, 'title');
    if (shots) await page.screenshot({ path: `${shots}/landscape-title.png` });
  });

  await drive(page);
  await check('auto-accelerate drives forward', async () => {
    await page.waitForTimeout(1500);
    const s = await state(page);
    assert.ok(s.speed > 4000, `speed ${s.speed}`);
  });

  const right = await center(page, '.steer-buttons [data-control="right"]');
  const left = await center(page, '.steer-buttons [data-control="left"]');
  const nitro = await center(page, '[data-control="nitro"]');

  await check('multi-touch: steer right + nitro simultaneously', async () => {
    const x0 = (await state(page)).x;
    await touch(cdp, 'touchStart', [right]);
    await touch(cdp, 'touchStart', [right, nitro]);
    await page.waitForTimeout(400);
    const s = await state(page);
    if (shots) await page.screenshot({ path: `${shots}/landscape-nitro-steer.png` });
    assert.ok(s.touch.right && s.touch.nitro, JSON.stringify(s.touch));
    assert.ok(s.nitro, 'nitro active');
    assert.ok(s.steer > 0.5, `steer ${s.steer}`);
    assert.ok(s.x > x0, 'moved right');
    await touch(cdp, 'touchEnd', []);
    await page.waitForTimeout(50);
    const after = await state(page);
    assert.ok(!after.touch.right && !after.touch.nitro, 'released');
  });

  await check('sliding a thumb from left to right switches buttons', async () => {
    await touch(cdp, 'touchStart', [left]);
    await page.waitForTimeout(50);
    assert.ok((await state(page)).touch.left);
    await touch(cdp, 'touchMove', [{ x: (left.x + right.x) / 2, y: left.y }]);
    await touch(cdp, 'touchMove', [right]);
    await page.waitForTimeout(50);
    const s = await state(page);
    assert.ok(s.touch.right && !s.touch.left, JSON.stringify(s.touch));
    await touch(cdp, 'touchEnd', []);
  });

  await check('touch cancel releases controls', async () => {
    await touch(cdp, 'touchStart', [left, nitro]);
    await page.waitForTimeout(50);
    await touch(cdp, 'touchCancel', []);
    await page.waitForTimeout(50);
    const s = await state(page);
    assert.ok(!s.touch.left && !s.touch.nitro, JSON.stringify(s.touch));
  });

  await check('losing focus releases controls and pauses', async () => {
    await touch(cdp, 'touchStart', [left]);
    await page.waitForTimeout(50);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.waitForTimeout(50);
    const s = await state(page);
    assert.equal(s.mode, 'paused');
    assert.ok(!s.touch.left);
    await touch(cdp, 'touchEnd', []);
    if (shots) await page.screenshot({ path: `${shots}/landscape-pause.png` });
  });

  await check('switch to steering wheel (grown-up settings) and drag to steer', async () => {
    await page.click('#btn-menu');
    await grownup(page);
    await page.click('#screen-grownup [data-setting="controlScheme"] [data-value="wheel"]');
    await page.click('#grownup-done');
    await drive(page);
    await page.waitForTimeout(150);
    const w = await center(page, '[data-control="wheel"]');
    assert.ok(w.w > 50, 'wheel visible');
    const top = { x: w.x, y: w.y - w.h * 0.4 };
    await touch(cdp, 'touchStart', [top]);
    for (let i = 1; i <= 6; i++) {
      const a = -Math.PI / 2 + (i / 6) * 0.9;
      await touch(cdp, 'touchMove', [{ x: w.x + Math.cos(a) * w.w * 0.4, y: w.y + Math.sin(a) * w.h * 0.4 }]);
    }
    await page.waitForTimeout(200);
    const s = await state(page);
    if (shots) await page.screenshot({ path: `${shots}/landscape-wheel.png` });
    assert.ok(s.touch.wheel > 0.3, `wheel ${s.touch.wheel}`);
    assert.ok(s.steer > 0.3, `steer ${s.steer}`);
    await touch(cdp, 'touchEnd', []);
    await page.waitForTimeout(50);
    assert.equal((await state(page)).touch.wheel, 0, 'wheel recentres');
  });

  await check('settings persist across reload', async () => {
    await page.reload();
    await page.waitForFunction(() => window.__pocketRacers);
    assert.equal((await state(page)).scheme, 'wheel');
  });

  await check('no console errors (landscape)', async () => assert.deepEqual(errors, []));
  await context.close();
}

// -------------------------------------------------------------- portrait
{
  // Phones play landscape only: portrait shows a blocking prompt and pauses.
  const { context, page, errors } = await open({ width: 390, height: 844 });
  await check('portrait phone: rotate prompt covers the game', async () => {
    assert.ok(await page.isVisible('#rotate-screen'));
    assert.match(await page.textContent('#rotate-screen'), /sideways/);
    const top = await page.evaluate(() => document.elementFromPoint(195, 600)?.closest('#rotate-screen') !== null);
    assert.ok(top, 'prompt is on top of everything');
  });
  await check('turning to landscape hides the prompt; back to portrait pauses', async () => {
    await page.setViewportSize({ width: 844, height: 390 });
    assert.ok(await page.isHidden('#rotate-screen'));
    await drive(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => window.__pocketRacers.mode === 'paused');
    assert.ok(await page.isVisible('#rotate-screen'));
    if (shots) await page.screenshot({ path: `${shots}/portrait-blocked.png` });
  });
  await check('no console errors (portrait)', async () => assert.deepEqual(errors, []));
  await context.close();
}
{
  // Desktop browsers (mouse) are never blocked, whatever the window shape.
  const context = await browser.newContext({ viewport: { width: 500, height: 800 } });
  const page = await context.newPage();
  await page.goto(base);
  await page.waitForFunction(() => window.__pocketRacers);
  await check('desktop narrow window: no rotate prompt', async () => assert.ok(await page.isHidden('#rotate-screen')));
  await context.close();
}

// ------------------------------------------------------------------ tilt
{
  const { context, page, errors } = await open({ width: 844, height: 390 });
  await check('tilt without sensor data falls back to buttons with a message', async () => {
    await grownup(page);
    await page.click('#screen-grownup [data-setting="controlScheme"] [data-value="tilt"]');
    await page.waitForTimeout(1800);
    const s = await state(page);
    assert.equal(s.scheme, 'buttons');
    assert.match(await page.textContent('#toast'), /buttons/i);
    await page.click('#grownup-done');
  });

  await check('tilt with sensor data: calibrates to neutral and steers', async () => {
    // Simulate a device held at a slight angle (the calibration offset),
    // then rotated like a wheel. Which Euler angle that changes depends on
    // the emulated screen rotation, so pick the matching one.
    const angle = await page.evaluate(() => screen.orientation?.angle ?? 0);
    await page.evaluate((angle) => {
      window.__fakeRoll = 5;
      setInterval(() => {
        const r = window.__fakeRoll;
        const o = angle === 90 ? { beta: r, gamma: -60 } : angle === 270 ? { beta: -r, gamma: 60 } : { beta: 30, gamma: r };
        window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 0, ...o }));
      }, 16);
    }, angle);
    await grownup(page);
    await page.click('#screen-grownup [data-setting="controlScheme"] [data-value="tilt"]');
    await page.waitForFunction(() => window.__pocketRacers.settings.controlScheme === 'tilt', null, { timeout: 3000 });
    await page.click('#grownup-done');
    await drive(page);
    let s = await state(page);
    assert.equal(s.scheme, 'tilt');
    await page.waitForTimeout(300);
    s = await state(page);
    assert.ok(Math.abs(s.steer) < 0.1, `neutral steer ${s.steer}`);
    await page.evaluate(() => (window.__fakeRoll = 25));
    // Sensor events are timer-driven, so allow for a busy headless renderer.
    await page.waitForFunction(() => window.__pocketRacers.session.player.steer > 0.4, null, { timeout: 2000 }).catch(() => {});
    s = await state(page);
    assert.ok(s.steer > 0.4, `tilted steer ${s.steer}`);
    if (shots) await page.screenshot({ path: `${shots}/landscape-tilt.png` });
  });
  await check('no console errors (tilt)', async () => assert.deepEqual(errors, []));
  await context.close();
}

// ------------------------------------------------------ players + lock
{
  // An older save (from before profiles) becomes 🦊's; 🐼 is added fresh.
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  await context.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('pocketracers.settings', JSON.stringify({ v: 1, data: { graphics: 'low' } }));
    localStorage.setItem('pocketracers.progress', JSON.stringify({ v: 1, points: 5000 }));
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(base);
  await page.waitForFunction(() => window.__pocketRacers);
  const pts = () => page.evaluate(() => window.__pocketRacers.progress.points);
  await check('old progress goes to the first player only; one player opens on home', async () => {
    assert.deepEqual(await page.evaluate(() => window.__pocketRacers.profiles.list), ['fox']);
    assert.equal(await page.evaluate(() => window.__pocketRacers.mode), 'title');
    assert.equal(await pts(), 5000);
  });
  await check("a second player starts fresh; launch then asks who's playing", async () => {
    await page.click('#btn-profile');
    await page.click('#profile-row .add');
    const q = await page.textContent('#gate-q');
    const [a, b] = q.split('+').map(Number);
    for (const d of String(a + b)) await page.click(`#gate-keys [data-key="${d}"]`);
    await page.click('[data-profile=panda]');
    await page.waitForFunction(() => window.__pocketRacers.mode === 'title');
    assert.equal(await pts(), 0);
    await page.reload();
    await page.waitForFunction(() => window.__pocketRacers);
    assert.equal(await page.evaluate(() => window.__pocketRacers.mode), 'profiles');
    assert.deepEqual(await page.$$eval('#profile-row [data-profile]', (b) => b.map((x) => x.dataset.profile)), ['fox', 'panda']);
  });
  await check('each player has their own points and cars', async () => {
    await page.click('[data-profile=fox]');
    assert.equal(await pts(), 5000);
    await page.evaluate(() => window.__pocketRacers.garage.unlock('trailhound', window.__pocketRacers.progress));
    assert.ok((await pts()) < 5000);
    await page.click('#btn-profile');
    await page.click('[data-profile=panda]');
    assert.equal(await pts(), 0, 'panda untouched');
    assert.ok(!(await page.evaluate(() => window.__pocketRacers.garage.owns('trailhound'))));
    await page.click('#btn-profile');
    await page.click('[data-profile=fox]');
    assert.ok(await page.evaluate(() => window.__pocketRacers.garage.owns('trailhound')));
  });
  await check('a wrong answer keeps the grown-up panel locked', async () => {
    await page.click('#btn-grownup');
    const q = await page.textContent('#gate-q');
    const [a, b] = q.split('+').map(Number);
    const wrong = String(a + b + 1);
    for (const d of wrong) await page.click(`#gate-keys [data-key="${d}"]`);
    await page.waitForTimeout(400);
    assert.ok(await page.isHidden('#screen-gate'));
    assert.ok(await page.isHidden('#screen-grownup'));
  });
  await check('adding a player needs the lock and starts fresh', async () => {
    await page.click('#btn-profile');
    await page.click('#profile-row .add');
    assert.ok(await page.isVisible('#screen-gate'));
    const q = await page.textContent('#gate-q');
    const [a, b] = q.split('+').map(Number);
    for (const d of String(a + b)) await page.click(`#gate-keys [data-key="${d}"]`);
    await page.click('[data-profile=unicorn]');
    await page.waitForFunction(() => window.__pocketRacers.mode === 'title');
    assert.equal(await page.evaluate(() => window.__pocketRacers.profiles.current), 'unicorn');
    assert.equal(await pts(), 0);
    assert.equal(await page.textContent('#home-avatar'), '🦄');
  });
  await check('grown-ups can remove a player (two taps)', async () => {
    await grownup(page);
    await page.click('[data-remove=unicorn]');
    assert.ok(await page.evaluate(() => window.__pocketRacers.profiles.list.includes('unicorn')), 'first tap only asks');
    await page.click('[data-remove=unicorn]');
    assert.deepEqual(await page.evaluate(() => window.__pocketRacers.profiles.list), ['fox', 'panda']);
    assert.equal(await page.evaluate(() => localStorage.getItem('pocketracers.progress@unicorn')), null);
    await page.click('#grownup-done');
  });
  await check('no console errors (players)', async () => assert.deepEqual(errors, []));
  await context.close();
}

// --------------------------------------------------------- Little Driver
{
  const { context, page, errors } = await open({ width: 844, height: 390 });
  const next = () => page.evaluate(() => window.__pocketRacers.nextEvent().id);
  await check('Little Driver is on by default and skips knockout races in ▶ Play', async () => {
    await page.evaluate(() => {
      for (const id of ['rookie', 'trial', 'islands', 'mud']) window.__pocketRacers.career.record(id, 3, 60);
    });
    assert.equal(await page.evaluate(() => window.__pocketRacers.session.assist), true);
    assert.equal(await next(), 'frosty');
  });
  await check('grown-ups can turn Little Driver off per player', async () => {
    await grownup(page);
    await page.click('[data-little-driver=fox]');
    assert.equal(await page.getAttribute('[data-little-driver=fox]', 'aria-pressed'), 'false');
    await page.click('#grownup-done');
    assert.equal(await page.evaluate(() => window.__pocketRacers.session.assist), false);
    assert.equal(await next(), 'knockout');
  });
  await check('no console errors (Little Driver)', async () => assert.deepEqual(errors, []));
  await context.close();
}

// ------------------------------------------------------- badges + offline
{
  const { context, page, errors } = await open({ width: 844, height: 390 });
  await check('badges screen lists every badge with progress', async () => {
    await page.click('#btn-badges');
    await page.waitForSelector('#screen-badges:not([hidden])');
    const n = await page.$$eval('.badge-card', (c) => c.length);
    assert.ok(n >= 20, `${n} badges`);
    assert.equal(await page.$$eval('.badge-card.earned', (c) => c.length), 0);
    assert.equal(await page.locator('#sticker-book .sticker').count(), 20, 'sticker book has every animal');
    assert.equal(await page.locator('#sticker-book .sticker.got').count(), 0);
    await page.click('#badges-back');
    await page.waitForFunction(() => window.__pocketRacers.mode === 'title');
  });
  await check('a jump in free drive earns a badge, pays points and pops up', async () => {
    await drive(page);
    const before = await page.evaluate(() => window.__pocketRacers.progress.points);
    await page.evaluate(() => window.__pocketRacers.session.fun.onLand(0.8, 0, 0));
    await page.waitForSelector('.badge-pop');
    const after = await page.evaluate(() => ({ pts: window.__pocketRacers.progress.points, got: window.__pocketRacers.achievements.earned('jump') }));
    assert.ok(after.got);
    assert.ok(after.pts >= before + 150, `${before} -> ${after.pts}`);
    assert.match(await page.textContent('.badge-pop'), /Lift Off/);
  });
  await check('driving past a hidden animal finds it: points, sticker, badge', async () => {
    const before = await page.evaluate(() => window.__pocketRacers.progress.points);
    await page.evaluate(() => {
      const S = window.__pocketRacers.session;
      const a = S.fun.animals.find((x) => x.id === 'bunny');
      S.player.z = a.z - 12 / S.track.metresPerUnit;
      S.player.x = a.x * 0.8;
    });
    await page.waitForFunction(() => window.__pocketRacers.achievements.found('bunny'), null, { timeout: 5000 });
    const after = await page.evaluate(() => window.__pocketRacers.progress.points);
    assert.ok(after >= before + 500, `${before} -> ${after}`);
    assert.ok(await page.evaluate(() => window.__pocketRacers.achievements.earned('animal')));
  });
  await check('HONK button honks while driving', async () => {
    const t0 = await page.evaluate(() => window.__pocketRacers.session.lastHonk);
    await page.click('#btn-honk');
    const t1 = await page.evaluate(() => window.__pocketRacers.session.lastHonk);
    assert.ok(t1 > t0);
    await home(page);
    await page.click('#btn-badges');
    assert.equal(await page.locator('#sticker-book .sticker.got').count(), 1);
    assert.equal(await page.locator('#sticker-book .sticker.got[data-animal=bunny]').count(), 1);
    await page.click('#badges-back');
    await page.waitForFunction(() => window.__pocketRacers.mode === 'title');
    await drive(page);
  });
  await check('graphics settings offer Auto', async () => {
    await home(page);
    await grownup(page);
    assert.match(await page.textContent('#graphics-auto'), /Auto/);
  });
  await check('no console errors (badges)', async () => assert.deepEqual(errors, []));
  await context.close();
}
{
  const { context, page, errors } = await open({ width: 844, height: 390 }, '?sw');
  await check('installed game works offline', async () => {
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(() => page.reload());
    await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 15000 });
    await context.setOffline(true);
    await page.reload();
    await page.waitForFunction(() => window.__pocketRacers);
    await drive(page);
    await page.waitForTimeout(500);
    assert.ok((await state(page)).speed > 0);
    await context.setOffline(false);
  });
  await check('no console errors (offline)', async () => assert.deepEqual(errors, []));
  await context.close();
}

// ----------------------------------------------------------- performance
{
  // Garage: browse, customise, unlock with earned points, drive the new vehicle.
  const { context, page, errors } = await open({ width: 844, height: 390 });
  await page.evaluate((k) => {
    localStorage.setItem(k, JSON.stringify({ v: 1, points: 2600 }));
  }, PLAYER('progress'));
  await page.reload();
  await page.waitForFunction(() => window.__pocketRacers);
  await check('garage opens on the selected vehicle', async () => {
    await page.click('#btn-garage');
    assert.equal(await page.evaluate(() => window.__pocketRacers.mode), 'garage');
    assert.equal(await page.textContent('#garage-name'), 'Zippy GT');
    assert.match(await page.textContent('#garage-bank'), /2,600/);
  });
  await check('arrows and cards preview other vehicles', async () => {
    await page.click('#garage-next');
    assert.equal(await page.textContent('#garage-name'), 'Comet S');
    await page.click('.car-card:has-text("Trailhound")');
    assert.equal(await page.textContent('#garage-name'), 'Trailhound');
    assert.match(await page.textContent('#garage-action'), /🔓/);
  });
  await check('paint, rims and style change the preview and persist', async () => {
    await page.click('[data-tab=paint]');
    await page.click('.swatches[data-key=body] button[data-value="#ff006e"]');
    await page.click('[data-tab=wheels]');
    await page.click('.choices[data-key=rimStyle] button[data-value=star]');
    await page.click('[data-tab=style]');
    await page.click('.choices[data-key=ride] button[data-value=max]');
    const custom = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).custom.trailhound, PLAYER('garage'));
    assert.deepEqual(custom, { body: '#ff006e', rimStyle: 'star', ride: 'max' });
    assert.equal(await page.evaluate(() => window.__pocketRacers.renderer.carDef.paint.body), '#ff006e');
  });
  await check('unlock spends points; too expensive says "not yet" and shakes', async () => {
    await page.click('#garage-action');
    assert.match(await page.textContent('#garage-bank'), /600/);
    assert.equal(await page.textContent('#garage-action'), '✓');
    await page.click('[data-tab=cars]');
    await page.click('.car-card:has-text("Bolt R")');
    assert.match(await page.getAttribute('#garage-action', 'class'), /cant/);
    await page.click('#garage-action');
    assert.match(await page.getAttribute('#garage-action', 'class'), /shake/);
    assert.ok(!(await page.evaluate(() => window.__pocketRacers.garage.owns('bolt'))));
    await page.click('.car-card:has-text("Trailhound")');
  });
  await check('kit, neon and a performance upgrade', async () => {
    await page.click('[data-tab=style]');
    await page.click('#garage-kit button:has-text("Bull bar")');
    await page.click('.swatches[data-key=neon] button[data-value="#8ac926"]');
    const custom = await page.evaluate(() => window.__pocketRacers.garage.custom('trailhound'));
    assert.equal(custom.bullbar, 'bullbar');
    assert.equal(custom.neon, '#8ac926');
    assert.equal(await page.locator('.toppers button').count(), 5);
    await page.click('.toppers button[data-value=duck]');
    assert.equal(await page.evaluate(() => window.__pocketRacers.garage.custom('trailhound').topper), 'duck');
    assert.equal(await page.getAttribute('.toppers button[data-value=duck]', 'aria-pressed'), 'true');
    await page.click('[data-tab=tune]');
    const before = await page.evaluate(() => window.__pocketRacers.progress.points);
    await page.click('.tune-buy[data-upgrade=tyres]');
    const st = await page.evaluate(() => ({ up: window.__pocketRacers.garage.upgrades('trailhound'), pts: window.__pocketRacers.progress.points }));
    assert.equal(st.up.tyres, 1);
    assert.ok(st.pts < before);
    await page.click('[data-tab=cars]');
  });
  await check('✓ picks the vehicle and goes home; it drives', async () => {
    await page.click('#garage-action');
    await page.waitForFunction(() => window.__pocketRacers.mode === 'title');
    await drive(page);
    const car = await page.evaluate(() => ({ id: window.__pocketRacers.car.id, session: window.__pocketRacers.session.car.id }));
    assert.deepEqual(car, { id: 'trailhound', session: 'trailhound' });
    await page.waitForTimeout(600);
    assert.ok(await page.evaluate(() => window.__pocketRacers.session.player.speed > 0));
  });
  await check('selection survives a reload', async () => {
    await page.reload();
    await page.waitForFunction(() => window.__pocketRacers);
    assert.equal(await page.evaluate(() => window.__pocketRacers.car.id), 'trailhound');
    assert.match(await page.textContent('#title-car'), /Trailhound/);
  });
  await check('no console errors (garage)', async () => assert.deepEqual(errors, []));
  await context.close();
}

{
  // Races: events list, countdown, AI opponents, finish, results, career save.
  const { context, page, errors } = await open({ width: 844, height: 390 });
  await check('grown-ups can open the full race list', async () => {
    await grownup(page);
    await page.click('#gu-races');
    assert.equal(await page.evaluate(() => window.__pocketRacers.mode), 'events');
    assert.equal(await page.locator('.event-card').count(), 12);
    assert.ok((await page.locator('.event-card.locked').count()) >= 5);
    await page.click('#events-back');
  });
  await check('▶ Play starts the first race straight away, with 5 AI opponents', async () => {
    await page.click('#btn-races', { force: true }); // it gently pulses
    await page.waitForFunction(() => window.__pocketRacers.mode === 'driving');
    assert.equal(await page.evaluate(() => window.__pocketRacers.race && window.__pocketRacers.nextEvent().id), 'rookie');
    const st = await page.evaluate(() => ({ phase: window.__pocketRacers.race.phase, racers: window.__pocketRacers.session.racers.length }));
    assert.deepEqual(st, { phase: 'countdown', racers: 5 });
    await page.waitForFunction(() => window.__pocketRacers.race.phase === 'racing', null, { timeout: 8000 });
    await page.waitForTimeout(1500);
    const moving = await page.evaluate(() => window.__pocketRacers.session.racers.every((r) => r.p.speed > 2000));
    assert.ok(moving, 'AI cars are racing');
    assert.match(await page.textContent('#hud-pos'), /^\d\/6$/);
    assert.equal(await page.textContent('#hud-lap'), '1/3');
  });
  await check('finishing shows results, pays points and saves stars', async () => {
    const before = await page.evaluate(() => window.__pocketRacers.progress.points);
    await page.evaluate(() => (window.__pocketRacers.session.player.lap = 4));
    await page.waitForFunction(() => window.__pocketRacers.mode === 'results', null, { timeout: 8000 });
    assert.ok(await page.isVisible('#screen-results'));
    assert.equal(await page.locator('#results-standings li').count(), 6);
    const after = await page.evaluate(() => window.__pocketRacers.progress.points);
    assert.ok(after > before);
    const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).events.rookie.stars, PLAYER('career'));
    assert.ok(saved >= 1);
    assert.ok(await page.isVisible('#results-next'), 'next race offered');
    assert.equal(await page.locator('#results-podium .step').count(), 3, 'podium with the top three');
    const place = await page.evaluate(() => window.__pocketRacers.race.results.place);
    if (place <= 3) {
      assert.equal(await page.textContent('#results-podium .me .who'), '🦊');
      assert.ok((await page.locator('#results-confetti i').count()) > 0, 'confetti for a podium finish');
    }
    assert.ok((await page.locator('#results-badges .badge-chip').count()) >= 1, 'badges shown inside the results');
  });
  await check('retry restarts the race; menu returns to free drive', async () => {
    await page.click('#results-retry');
    await page.waitForFunction(() => window.__pocketRacers.mode === 'driving' && window.__pocketRacers.race?.phase === 'countdown');
    await page.click('#btn-pause');
    await page.click('#btn-menu');
    const st = await page.evaluate(() => ({ mode: window.__pocketRacers.mode, race: !!window.__pocketRacers.race, racers: window.__pocketRacers.session.racers.length }));
    assert.deepEqual(st, { mode: 'title', race: false, racers: 0 });
  });
  await check('no console errors (races)', async () => assert.deepEqual(errors, []));
  await context.close();
}

{
  // Maps: picture cards; every map loads and drives.
  const { context, page, errors } = await open({ width: 844, height: 390 });
  await check('every map card loads its map and drives', async () => {
    const all = await page.$$eval('.map-card', (c) => c.map((b) => b.dataset.map));
    assert.deepEqual(all, ['island', 'bigland', 'sunny-valley', 'desert-canyon', 'snowy-peaks', 'night-city', 'tropical-coast']);
    const ids = all.slice(1);
    for (const id of ids) {
      await drive(page, id);
      await page.waitForTimeout(700);
      assert.equal(await page.evaluate(() => window.__pocketRacers.trackId), id);
      assert.ok(await page.evaluate(() => window.__pocketRacers.session.player.speed > 1000), `${id} drives`);
      await home(page);
    }
  });
  await check('the island: drive anywhere, then home leaves it', async () => {
    await drive(page, 'island');
    await page.waitForTimeout(900);
    const st = await page.evaluate(() => ({ world: window.__pocketRacers.worldMode, speed: window.__pocketRacers.free.player.speed }));
    assert.ok(st.world, 'in the open world');
    assert.ok(st.speed > 1000, `drives (${st.speed})`);
    // The island map: small map shows, tapping opens the big one (driving
    // stops), the house button drives home and closes it.
    assert.ok(await page.isVisible('#minimap'));
    assert.ok(!(await page.isVisible('#hud-lap')), 'no laps on the island');
    assert.ok(await page.evaluate(() => window.__pocketRacers.explore.percent >= 1), 'map uncovered near the start');
    // A flag race starts just ahead of the start: gates pill and an arrow.
    await page.waitForFunction(() => window.__pocketRacers.free.flag.race, null, { timeout: 5000 });
    assert.ok(await page.isVisible('#hud-flag'), 'flag race pill');
    assert.match(await page.textContent('#hud-flag'), /\d+\/\d+/);
    assert.ok(await page.isVisible('#road-arrow'), 'arrow to the next gate');
    await page.tap('#minimap');
    assert.ok(await page.isVisible('#world-map'));
    assert.match(await page.textContent('#world-map-pct'), /^\d+%$/);
    const z0 = await page.evaluate(() => window.__pocketRacers.free.player.z);
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.__pocketRacers.free.player.z), z0, 'paused while the map is open');
    await page.tap('#btn-go-home');
    assert.ok(!(await page.isVisible('#world-map')));
    assert.equal(await page.evaluate(() => window.__pocketRacers.free.flag.race), null, 'going home ends the race');
    await page.waitForSelector('#hud-flag', { state: 'hidden', timeout: 1000 });
    await home(page);
    assert.ok(!(await page.isVisible('#minimap')));
    assert.equal(await page.evaluate(() => window.__pocketRacers.worldMode), false);
    await drive(page, 'tropical-coast');
    await home(page);
  });
  await check('Big Land: endless roads, distance from home, map', async () => {
    await drive(page, 'bigland');
    await page.waitForTimeout(1500);
    const st = await page.evaluate(() => ({ world: window.__pocketRacers.worldMode, endless: window.__pocketRacers.free.world.endless, speed: window.__pocketRacers.free.player.speed }));
    assert.ok(st.world && st.endless, 'in Big Land');
    assert.ok(st.speed > 1000, `drives (${st.speed})`);
    assert.ok(await page.isVisible('#hud-far'), 'distance pill');
    assert.match(await page.textContent('#hud-far'), /\d+\.\d km/);
    assert.ok(await page.isVisible('#minimap'));
    await page.tap('#minimap');
    assert.match(await page.textContent('#world-map-pct'), /^\d+\.\d km$/);
    await page.tap('#btn-go-home');
    await home(page);
    assert.ok(!(await page.isVisible('#hud-far')));
    assert.equal(await page.evaluate(() => window.__pocketRacers.worldMode), false);
  });
  await check('chosen map is remembered', async () => {
    await page.reload();
    await page.waitForFunction(() => window.__pocketRacers);
    assert.equal(await page.evaluate(() => window.__pocketRacers.trackId), 'tropical-coast');
    await page.click('#btn-drive');
    assert.equal(await page.getAttribute('.map-card[aria-current="true"]', 'data-map'), 'tropical-coast');
  });
  await check('no console errors (maps)', async () => assert.deepEqual(errors, []));
  await context.close();
}

{
  const { context, page, cdp } = await open({ width: 844, height: 390 }, '', 'high');
  await drive(page);
  // Time only our render() call (headless Chromium rasterises in software,
  // so wall-clock frame time says little about a phone's GPU canvas).
  const measure = () =>
    page.evaluate(async () => {
      const g = window.__pocketRacers;
      let total = 0;
      let n = 0;
      for (let i = 0; i < 20; i++) {
        const t0 = performance.now();
        g.renderer.render(g.session, 1, 1 / 60);
        total += performance.now() - t0;
        n++;
        await new Promise((r) => setTimeout(r, 0));
      }
      return total / n;
    });
  const plain = await measure();
  results.push(`  info High preset render() submit time: ${plain.toFixed(2)} ms (headless, software raster; device FPS must be measured on a phone)`);
  void cdp;
  await context.close();
}

await browser.close();
server.close();
console.log(results.join('\n'));
console.log(failed ? `\n${failed} check(s) failed` : '\nall e2e checks passed');
process.exit(failed ? 1 : 0);

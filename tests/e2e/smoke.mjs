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
}

async function open(viewport, query = '') {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
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

async function drive(page) {
  await page.click('#btn-drive');
  await page.waitForFunction(() => window.__pocketRacers.mode === 'driving');
  await page.waitForTimeout(200);
}

// ------------------------------------------------------------- landscape
{
  const { context, page, errors, cdp } = await open({ width: 844, height: 390 });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.__pocketRacers);

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

  await check('switch to steering wheel and drag to steer', async () => {
    await page.click('[data-setting="controlScheme"] [data-value="wheel"]');
    await page.click('#btn-resume');
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
  const { context, page, errors } = await open({ width: 390, height: 844 });
  await drive(page);
  await check('portrait: controls fit on screen without overlapping', async () => {
    const rects = await page.$$eval('#controls [data-control]', (els) =>
      els
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.width > 0)
        .map((r) => ({ l: r.left, r: r.right, t: r.top, b: r.bottom })),
    );
    assert.ok(rects.length >= 4);
    for (const r of rects) assert.ok(r.l >= 0 && r.r <= 390 && r.b <= 844 && r.t >= 0, JSON.stringify(r));
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const overlap = a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
        assert.ok(!overlap, `overlap ${JSON.stringify(a)} ${JSON.stringify(b)}`);
      }
    await page.waitForTimeout(1500);
    if (shots) await page.screenshot({ path: `${shots}/portrait-drive.png` });
  });
  await check('no console errors (portrait)', async () => assert.deepEqual(errors, []));
  await context.close();
}

// ------------------------------------------------------------------ tilt
{
  const { context, page, errors } = await open({ width: 844, height: 390 });
  await check('tilt without sensor data falls back to buttons with a message', async () => {
    await page.click('.scheme[data-scheme="tilt"]');
    await page.click('#btn-drive');
    await page.waitForTimeout(1800);
    const s = await state(page);
    assert.equal(s.scheme, 'buttons');
    assert.equal(s.mode, 'title');
    const hint = await page.textContent('#title-hint');
    assert.match(hint, /buttons/i);
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
    await page.click('.scheme[data-scheme="tilt"]');
    await page.click('#btn-drive');
    await page.waitForFunction(() => window.__pocketRacers.mode === 'driving', null, { timeout: 3000 });
    let s = await state(page);
    assert.equal(s.scheme, 'tilt');
    await page.waitForTimeout(300);
    s = await state(page);
    assert.ok(Math.abs(s.steer) < 0.1, `neutral steer ${s.steer}`);
    await page.evaluate(() => (window.__fakeRoll = 25));
    await page.waitForTimeout(500);
    s = await state(page);
    assert.ok(s.steer > 0.4, `tilted steer ${s.steer}`);
    if (shots) await page.screenshot({ path: `${shots}/landscape-tilt.png` });
  });
  await check('no console errors (tilt)', async () => assert.deepEqual(errors, []));
  await context.close();
}

// ----------------------------------------------------------- performance
{
  const { context, page, cdp } = await open({ width: 844, height: 390 });
  await drive(page);
  // Time only our render() call (headless Chromium rasterises in software,
  // so wall-clock frame time says little about a phone's GPU canvas).
  const measure = () =>
    page.evaluate(async () => {
      const g = window.__pocketRacers;
      let total = 0;
      let n = 0;
      for (let i = 0; i < 120; i++) {
        const t0 = performance.now();
        g.renderer.render(g.session, 1, 1 / 60);
        total += performance.now() - t0;
        n++;
        await new Promise((r) => setTimeout(r, 0));
      }
      return total / n;
    });
  const plain = await measure();
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const throttled = await measure();
  results.push(`  info render() CPU time: ${plain.toFixed(2)} ms, with 4x CPU throttle: ${throttled.toFixed(2)} ms (headless, software raster)`);
  await context.close();
}

await browser.close();
server.close();
console.log(results.join('\n'));
console.log(failed ? `\n${failed} check(s) failed` : '\nall e2e checks passed');
process.exit(failed ? 1 : 0);

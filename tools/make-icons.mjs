// Dev tool: rasterise icons/icon.svg into the PNG sizes the manifest and iOS
// need. Uses the globally installed Playwright (development only).
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(path.join(root, 'icons/icon.svg'), 'utf8');

const browser = await chromium.launch();
// Rounded icons for browsers; full-bleed (square) versions for iOS and
// Android maskable icons, which apply their own corner mask.
const square = svg.replace('rx="112"', 'rx="0"');
for (const [name, size, src] of [
  ['icon-180.png', 180, square],
  ['icon-192.png', 192, svg],
  ['icon-512.png', 512, svg],
  ['icon-maskable-512.png', 512, square],
]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${src}`);
  await page.screenshot({ path: path.join(root, `icons/${name}`), omitBackground: true });
  await page.close();
}
await browser.close();
console.log('icons written');

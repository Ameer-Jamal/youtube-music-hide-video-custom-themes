import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
const browser = await chromium.launch({ ...(process.env.CI ? {} : { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }), headless: true });
try {
 const page = await browser.newPage({ viewport: { width: 390, height: 1100 }, deviceScaleFactor: 2 });
 await page.route('https://extension.test/**', route => {
  const path = new URL(route.request().url()).pathname.slice(1) || 'popup.html';
  route.fulfill({ body: readFileSync(path), contentType: path.endsWith('.js') ? 'application/javascript' : path.endsWith('.css') ? 'text/css' : path.endsWith('.png') ? 'image/png' : 'text/html' });
 });
 await page.addInitScript(() => {
  window.savedSettings = null;
  window.chrome = { storage: { sync: { get: async () => ({}), set: async ({ settings }) => { window.savedSettings = settings; } } } };
 });
 await page.goto('https://extension.test/popup.html');
 await page.locator('[data-theme="GalaxyPurple"]').click();
 await page.waitForFunction(() => window.savedSettings?.theme === 'GalaxyPurple');
 assert.equal(await page.locator('#preview').evaluate(el => el.style.getPropertyValue('--canvas')), '#10001b');
 await page.locator('#hideVideo').uncheck();
 await page.waitForFunction(() => window.savedSettings?.hideVideo === false);
 await page.locator('#background').evaluate(el => { el.value = '#112233'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
 await page.waitForFunction(() => window.savedSettings?.theme === 'UserDefined' && window.savedSettings?.background === '#112233');
 await page.locator('#file').setInputFiles({ name: 'settings.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ schemaVersion: 1, settings: { theme: 'MidnightBlue', queueWidth: 999 } })) });
 await page.waitForFunction(() => window.savedSettings?.theme === 'MidnightBlue' && window.savedSettings?.queueWidth === 100);
 await page.locator('#reset').click();
 await page.waitForFunction(() => window.savedSettings?.theme === 'MaterialDark');
 assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
 mkdirSync('docs/screenshots', { recursive: true });
 await page.screenshot({ path: 'docs/screenshots/popup.png', fullPage: true });
 const host = await browser.newPage();
 await host.setContent('<ytmusic-player-page><div class="content"><div id="main-panel">VIDEO</div><div id="side-panel"><div id="tab-renderer">QUEUE</div></div></div></ytmusic-player-page><ytmusic-player-bar><div class="volume-slider" aria-valuenow="80"></div></ytmusic-player-bar>');
 await host.evaluate(() => {
  window.chrome = { storage: { sync: { get: async () => ({ settings: { hideVideo: true, theme: 'MidnightBlue' } }) }, onChanged: { addListener: listener => { window.settingsListener = listener; } } } };
 });
 await host.addScriptTag({ path: 'src/settings.js' });
 await host.addScriptTag({ path: 'src/content.js' });
 await host.waitForFunction(() => getComputedStyle(document.querySelector('#main-panel')).display === 'none');
 assert.equal(await host.locator('ytmusic-player-bar').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(22, 41, 69)');
 await host.evaluate(() => window.settingsListener({ settings: { newValue: { enabled: false } } }, 'sync'));
 assert.notEqual(await host.locator('#main-panel').evaluate(el => getComputedStyle(el).display), 'none');
 assert.equal(await host.locator('#ytm-custom-themes').textContent(), '');
 await host.evaluate(() => window.settingsListener({ settings: { newValue: { hideVideo: true } } }, 'sync'));
 await host.locator('ytmusic-player-page').evaluate(el => { el.querySelector('#main-panel').remove(); const panel = document.createElement('div'); panel.id = 'main-panel'; el.append(panel); });
 assert.equal(await host.locator('#main-panel').evaluate(el => getComputedStyle(el).display), 'none');
 console.log('Browser checks passed: theme preview, live saves, custom colors, backup import, reset, layout, host styling, power toggle and SPA markup replacement.');
} finally { await browser.close(); }

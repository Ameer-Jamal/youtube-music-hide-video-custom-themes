import { chromium } from "playwright";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
const profile = mkdtempSync(resolve(tmpdir(), "ytm-extension-"));
const extension = resolve("dist/extension");
const context = await chromium.launchPersistentContext(profile, {
  channel: "chromium",
  headless: true,
  args: [
    `--disable-extensions-except=${extension}`,
    `--load-extension=${extension}`,
  ],
});
try {
  const manager = await context.newPage();
  await manager.goto("chrome://extensions");
  const item = manager
    .locator("extensions-item")
    .filter({ hasText: "YouTube Music - Hide Video & Custom Themes" });
  await item.waitFor();
  const id = await item.getAttribute("id");
  assert.ok(id);
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${id}/popup.html`);
  await popup.locator('[data-theme="MidnightBlue"]').click();
  await popup.waitForFunction(
    async () =>
      (await chrome.storage.sync.get("settings")).settings?.theme ===
      "MidnightBlue",
  );
  const music = await context.newPage();
  await music.route("https://music.youtube.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<html><body><ytmusic-player-page><div class="content"><div id="main-panel">VIDEO</div><div id="side-panel">QUEUE</div></div></ytmusic-player-page><ytmusic-player-bar>PLAYER</ytmusic-player-bar></body></html>',
    }),
  );
  await music.goto("https://music.youtube.com/");
  await music.waitForFunction(
    () =>
      getComputedStyle(document.querySelector("#main-panel")).display ===
      "none",
  );
  assert.equal(
    await music
      .locator("ytmusic-player-bar")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
    "rgb(22, 41, 69)",
  );
  await popup.locator("#enabled").uncheck();
  await music.waitForFunction(
    () =>
      getComputedStyle(document.querySelector("#main-panel")).display !==
      "none",
  );
  await popup.locator("#enabled").check();
  await music.waitForFunction(
    () =>
      getComputedStyle(document.querySelector("#main-panel")).display ===
      "none",
  );
  await music.reload();
  await music.waitForFunction(
    () =>
      getComputedStyle(document.querySelector("#main-panel")).display ===
      "none",
  );
  console.log(
    "Installed MV3 smoke test passed: manifest loads, real sync storage, automatic scoped injection, cross-tab updates, power toggle and reload persistence.",
  );
} finally {
  await context.close();
  rmSync(profile, { recursive: true, force: true });
}

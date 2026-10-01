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
  await popup.setViewportSize({ width: 390, height: 1100 });
  await popup.goto(`chrome-extension://${id}/popup.html`);
  await popup.waitForFunction(() =>
    document.querySelector("#version").textContent.includes("v"),
  );
  await popup.screenshot({
    path: "docs/screenshots/popup.png",
    fullPage: true,
  });
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
      body: '<html><body><ytmusic-browse-response id="browse-page" has-background><div id="background" style="background:linear-gradient(red,black);height:540px"><ytmusic-fullbleed-thumbnail-renderer>Decorative artwork</ytmusic-fullbleed-thumbnail-renderer></div><div class="background-gradient"><div id="content-wrapper"><ytmusic-section-list-renderer><div id="contents"><ytmusic-carousel-shelf-renderer style="background:black">First shelf</ytmusic-carousel-shelf-renderer><ytmusic-carousel-shelf-renderer style="background:darkred">Second shelf</ytmusic-carousel-shelf-renderer><ytmusic-fullbleed-thumbnail-renderer id="album-art">Album hero</ytmusic-fullbleed-thumbnail-renderer></div></ytmusic-section-list-renderer></div></div></ytmusic-browse-response><ytmusic-player-page><div class="content"><div id="main-panel">VIDEO</div><div id="side-panel">QUEUE</div></div></ytmusic-player-page><ytmusic-player-bar>PLAYER</ytmusic-player-bar></body></html>',
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
  await music.waitForFunction(() =>
    document.documentElement.hasAttribute("data-ytm-home"),
  );
  assert.equal(
    await music
      .locator("#browse-page > #background")
      .evaluate((el) => getComputedStyle(el).display),
    "none",
  );
  assert.notEqual(
    await music
      .locator("#album-art")
      .evaluate((el) => getComputedStyle(el).display),
    "none",
  );
  assert.ok(
    (
      await music
        .locator("ytmusic-browse-response")
        .evaluate((el) => getComputedStyle(el).backgroundImage)
    ).includes("linear-gradient"),
  );
  for (const shelf of await music
    .locator("ytmusic-carousel-shelf-renderer")
    .all())
    assert.equal(
      await shelf.evaluate((el) => getComputedStyle(el).backgroundColor),
      "rgba(0, 0, 0, 0)",
    );
  await music.evaluate(() => {
    history.pushState({}, "", "/browse/album");
    document.dispatchEvent(new Event("yt-navigate-finish"));
  });
  await music.waitForFunction(
    () => !document.documentElement.hasAttribute("data-ytm-home"),
  );
  assert.notEqual(
    await music
      .locator("#browse-page > #background")
      .evaluate((el) => getComputedStyle(el).display),
    "none",
  );
  await music.evaluate(() => {
    history.pushState({}, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await music.waitForFunction(() =>
    document.documentElement.hasAttribute("data-ytm-home"),
  );
  await popup.locator('[data-theme="YoutubeMusicDefault"]').click();
  await music.waitForFunction(
    () => !document.documentElement.hasAttribute("data-ytm-home"),
  );
  await popup.locator('[data-theme="MidnightBlue"]').click();
  await music.waitForFunction(() =>
    document.documentElement.hasAttribute("data-ytm-home"),
  );
  await popup.locator('[data-theme="Paper"]').click();
  await music.waitForFunction(
    () =>
      getComputedStyle(document.querySelector("ytmusic-player-bar"))
        .backgroundColor === "rgb(238, 234, 226)",
  );
  assert.equal(
    await music
      .locator("ytmusic-player-bar")
      .evaluate((e) => getComputedStyle(e).color),
    "rgb(17, 17, 17)",
  );
  await popup.locator("#wideHome").check();
  await music.waitForFunction(() =>
    document.documentElement.hasAttribute("data-ytm-wide-home"),
  );
  await music.reload();
  await music.waitForFunction(() =>
    document.documentElement.hasAttribute("data-ytm-wide-home"),
  );
  await popup.locator("#wideHome").uncheck();
  await music.waitForFunction(
    () => !document.documentElement.hasAttribute("data-ytm-wide-home"),
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

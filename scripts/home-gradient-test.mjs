import { chromium } from "playwright";
import { PNG } from "pngjs";
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1000, height: 800 },
  });
  await page.route("https://music.youtube.com/**", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: readFileSync("tests/fixtures/home-gradient.html", "utf8"),
    }),
  );
  await page.goto("https://music.youtube.com/");
  const jump = (buffer) => {
    const png = PNG.sync.read(buffer);
    const at = (y) => [
      ...png.data.subarray(
        (y * png.width + 10) * 4,
        (y * png.width + 10) * 4 + 3,
      ),
    ];
    return Math.max(...at(399).map((v, i) => Math.abs(v - at(400)[i])));
  };
  mkdirSync("dist/verification", { recursive: true });
  const before = await page.screenshot({
    path: "dist/verification/home-before.png",
  });
  assert.ok(
    jump(before) > 20,
    "Native repeated 50vh gradient must reproduce a visible seam",
  );
  await page.evaluate(() => {
    window.chrome = {
      storage: {
        sync: {
          get: async () => ({
            settings: {
              theme: "UserDefined",
              background: "#560b0b",
              accent: "#ff0000",
            },
          }),
        },
        onChanged: { addListener: (fn) => (window.settingsListener = fn) },
      },
    };
  });
  await page.addScriptTag({ path: "src/settings.js" });
  await page.addScriptTag({ path: "src/content.js" });
  await page.waitForFunction(() =>
    document.documentElement.hasAttribute("data-ytm-home"),
  );
  assert.ok(
    (
      await page
        .locator("#browse-page")
        .evaluate((e) => getComputedStyle(e).backgroundImage)
    ).includes("linear-gradient"),
    "Actual browse-page element must own the gradient",
  );
  for (const settings of [
    { theme: "UserDefined", background: "#560b0b", accent: "#ff0000" },
    { theme: "MidnightBlue" },
    { theme: "EmeraldShadow" },
    { theme: "MaterialDark" },
    { theme: "Paper" },
    { theme: "Mint" },
    { theme: "Lavender" },
  ]) {
    await page.evaluate(
      (s) => window.settingsListener({ settings: { newValue: s } }, "sync"),
      settings,
    );
    assert.ok(
      jump(await page.screenshot()) <= 2,
      `No shelf-boundary seam for ${settings.theme}`,
    );
  }
  // Validate rendered controls rather than only the generated CSS strings.
  await page.evaluate(() =>
    window.settingsListener(
      { settings: { newValue: { theme: "Mint" } } },
      "sync",
    ),
  );
  assert.equal(
    await page
      .locator(".play-pause-button")
      .evaluate((e) => getComputedStyle(e).backgroundColor),
    "rgb(39, 115, 79)",
  );
  assert.equal(
    await page
      .locator(".play-pause-button yt-icon")
      .evaluate((e) => getComputedStyle(e).color),
    "rgb(255, 255, 255)",
  );
  assert.equal(
    await page
      .locator('a[title="Save"] yt-formatted-string')
      .evaluate((e) => getComputedStyle(e).color),
    "rgb(17, 17, 17)",
  );
  await page.setViewportSize({ width: 1600, height: 800 });
  const standardWidth = await page
    .locator(".ytmusic-shelf")
    .first()
    .evaluate((e) => e.getBoundingClientRect().width);
  await page.evaluate(() =>
    window.settingsListener(
      { settings: { newValue: { theme: "Mint", wideHome: true } } },
      "sync",
    ),
  );
  await page.waitForFunction(() =>
    document.documentElement.hasAttribute("data-ytm-wide-home"),
  );
  assert.ok(
    (await page
      .locator(".ytmusic-shelf")
      .first()
      .evaluate((e) => e.getBoundingClientRect().width)) >
      standardWidth + 400,
  );
  await page.evaluate(() => {
    history.pushState({}, "", "/browse/album");
    document.dispatchEvent(new Event("yt-navigate-finish"));
  });
  assert.equal(
    await page.locator("html").getAttribute("data-ytm-wide-home"),
    null,
  );
  await page.evaluate(() => {
    history.pushState({}, "", "/");
    document.dispatchEvent(new Event("yt-navigate-finish"));
    window.settingsListener(
      { settings: { newValue: { theme: "Mint", wideHome: false } } },
      "sync",
    );
  });
  assert.equal(
    await page
      .locator(".ytmusic-shelf")
      .first()
      .evaluate((e) => e.getBoundingClientRect().width),
    standardWidth,
  );
  await page.screenshot({ path: "dist/verification/home-light.png" });
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.evaluate(() =>
    window.settingsListener(
      {
        settings: {
          newValue: {
            theme: "UserDefined",
            background: "#560b0b",
            accent: "#ff0000",
          },
        },
      },
      "sync",
    ),
  );
  await page.screenshot({ path: "dist/verification/home-after.png" });
  await page.evaluate(() =>
    window.settingsListener(
      { settings: { newValue: { enabled: false } } },
      "sync",
    ),
  );
  assert.ok(
    jump(await page.screenshot()) > 20,
    "Power off restores native background",
  );
  console.log(
    "Pixel regression passed: reproduced native 50vh seam, verified continuous feed in light and dark themes, and checked restoration.",
  );
} finally {
  await browser.close();
}

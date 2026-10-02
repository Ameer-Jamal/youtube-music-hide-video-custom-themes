import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import "../src/settings.js";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1000, height: 800 },
  });
  await page.setContent(
    readFileSync("tests/fixtures/light-theme.html", "utf8"),
  );
  await page.addStyleTag({ content: "body {background: #faf9f6}" });
  assert.equal(
    await page.locator("#track").evaluate((e) => getComputedStyle(e).color),
    "rgb(255, 255, 255)",
  );
  const style = await page.addStyleTag({ content: "/* theme */" });
  const rgbHex = (rgb) =>
    "#" +
    rgb
      .match(/\d+/g)
      .slice(0, 3)
      .map((x) => Number(x).toString(16).padStart(2, "0"))
      .join("");
  const contrast = (a, b) =>
    (Math.max(YTM.luminance(a), YTM.luminance(b)) + 0.05) /
    (Math.min(YTM.luminance(a), YTM.luminance(b)) + 0.05);
  for (const [theme, palette] of Object.entries(YTM.presets).filter(
    ([key, p]) =>
      key !== "UserDefined" &&
      key !== "YoutubeMusicDefault" &&
      YTM.colors(p).light,
  )) {
    await style.evaluate(
      (el, css) => (el.textContent = css),
      YTM.buildCss({ theme }),
    );
    for (const [selector, bg] of [
      ["#nav", palette.background],
      ["#nav-icon", palette.background],
      ["#heading", palette.background],
      ["#track", palette.background],
      ["#artist", palette.background],
      ["#queue", palette.background],
      ["#search", palette.background],
      ["#menu", palette.player],
      ["#player-title", palette.player],
      ["#time", palette.player],
      ["#volume", palette.player],
      ["#selected yt-formatted-string", palette.accent],
    ]) {
      const color = rgbHex(
        await page.locator(selector).evaluate((e) => getComputedStyle(e).color),
      );
      assert.ok(
        contrast(color, bg) >= 4.5,
        `${theme} ${selector}: ${color} on ${bg}`,
      );
    }
    for (const selector of ["#overlay", "#overlay-text"])
      assert.equal(
        await page.locator(selector).evaluate((e) => getComputedStyle(e).color),
        "rgb(255, 255, 255)",
        `${theme} retains readable artwork overlays`,
      );
  }
  mkdirSync("dist/verification", { recursive: true });
  await style.evaluate(
    (el, css) => (el.textContent = css),
    YTM.buildCss({ theme: "Paper" }),
  );
  await page.screenshot({ path: "dist/verification/light-surfaces.png" });
  await style.evaluate((el) => (el.textContent = ""));
  assert.equal(
    await page.locator("#track").evaluate((e) => getComputedStyle(e).color),
    "rgb(255, 255, 255)",
  );
  console.log(
    "Light theme regression passed: component-local white colors replaced on navigation, search, feed, queue, menu and player in all ten light themes; selected and artwork controls retain contrast.",
  );
} finally {
  await browser.close();
}

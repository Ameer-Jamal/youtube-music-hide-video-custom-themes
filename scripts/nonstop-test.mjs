import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.route("https://music.youtube.com/**", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: "<html><body><video></video></body></html>",
    }),
  );
  await page.goto("https://music.youtube.com/");
  await page.evaluate(() => {
    window.clicks = 0;
    window.chrome = {
      storage: {
        sync: { get: async () => ({}) },
        onChanged: {
          addListener(fn) {
            window.settingsListener = fn;
          },
        },
      },
    };
    window.addPrompt = ({
      hidden = false,
      button = true,
      translated = false,
    } = {}) => {
      const dialog = document.createElement("tp-yt-paper-dialog");
      dialog.hidden = hidden;
      dialog.innerHTML = `<ytmusic-you-there-renderer><div class="actions"><yt-button-renderer dialog-confirm>${button ? `<button aria-label="${translated ? "Oui" : "Yes"}">Confirm</button>` : ""}</yt-button-renderer></div></ytmusic-you-there-renderer>`;
      dialog.addEventListener("click", () => {
        window.clicks++;
      });
      document.body.append(dialog);
      return dialog;
    };
    window.addPrompt(); // Prompt already present at initialization.
  });
  await page.addScriptTag({ path: "src/settings.js" });
  await page.addScriptTag({ path: "src/content.js" });
  await page.waitForFunction(() => window.clicks === 1);
  await page.evaluate(() =>
    document.body.append(document.createElement("div")),
  );
  await page.waitForTimeout(50);
  assert.equal(
    await page.evaluate(() => window.clicks),
    1,
    "Unrelated mutations must not repeat the confirmation",
  );
  await page.evaluate(
    () => (document.querySelector("tp-yt-paper-dialog").hidden = true),
  );
  await page.waitForTimeout(30);
  await page.evaluate(
    () => (document.querySelector("tp-yt-paper-dialog").hidden = false),
  );
  await page.waitForFunction(() => window.clicks === 2);
  await page.evaluate(() => {
    window.later = window.addPrompt({ hidden: true, translated: true });
  });
  await page.waitForTimeout(30);
  assert.equal(
    await page.evaluate(() => window.clicks),
    2,
    "Hidden dialogs must be ignored",
  );
  await page.evaluate(() => (window.later.hidden = false));
  await page.waitForFunction(() => window.clicks === 3);
  await page.evaluate(() => {
    window.delayed = window.addPrompt({ button: false });
  });
  await page.evaluate(() => {
    window.delayed.querySelector("[dialog-confirm]").innerHTML =
      '<button aria-disabled="true">Yes</button>';
  });
  await page.waitForTimeout(30);
  assert.equal(await page.evaluate(() => window.clicks), 3);
  await page.evaluate(() =>
    window.delayed
      .querySelector("button")
      .setAttribute("aria-disabled", "false"),
  );
  await page.waitForFunction(() => window.clicks === 4);
  await page.evaluate(() => {
    window.settingsListener(
      { settings: { newValue: { nonstop: false } } },
      "sync",
    );
    window.off = window.addPrompt();
  });
  await page.waitForTimeout(30);
  assert.equal(await page.evaluate(() => window.clicks), 4);
  await page.evaluate(() => {
    document.querySelectorAll("tp-yt-paper-dialog").forEach((d) => d.remove());
    window.settingsListener(
      { settings: { newValue: { enabled: false, nonstop: true } } },
      "sync",
    );
    window.addPrompt();
  });
  await page.waitForTimeout(30);
  assert.equal(
    await page.evaluate(() => window.clicks),
    4,
    "Master power must disable nonstop",
  );
  await page.evaluate(() =>
    window.settingsListener(
      { settings: { newValue: { enabled: true, nonstop: true } } },
      "sync",
    ),
  );
  await page.waitForFunction(() => window.clicks === 5);
  await page.evaluate(() => {
    document.querySelectorAll("tp-yt-paper-dialog").forEach((d) => d.remove());
    const other = document.createElement("tp-yt-paper-dialog");
    other.innerHTML = "<button dialog-confirm>Delete playlist</button>";
    other.addEventListener("click", () => window.clicks++);
    document.body.append(other);
    document.querySelector("video").pause();
  });
  await page.waitForTimeout(50);
  assert.equal(
    await page.evaluate(() => window.clicks),
    5,
    "Unrelated dialogs must be ignored",
  );
  assert.equal(
    await page.locator("video").evaluate((v) => v.paused),
    true,
    "Manual pause must be preserved",
  );
  console.log(
    "Nonstop checks passed: startup, reuse, hidden and delayed prompts, translations, toggles, unrelated dialogs and manual pause.",
  );
} finally {
  await browser.close();
}
